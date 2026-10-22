// Tests for the scheduled event refreshes and the Home banner, 2026-10-21 banner/events pass.
//   npm run test:events
//
// The REAL route handlers (api/cron/refresh-events and api/cron/refresh-major-events) run here against a pretend internet: global fetch answers SerpApi,
// Ticketmaster and the AI endpoint with canned replies (no key is used, no credit is spent), and the Supabase service client talks to a small in-memory
// stand-in for the collector_events table (unique slug, atomic inserts, a check that rejects a row named BAD, and the Postgres refusal of an upsert that
// names one slug twice). Nothing leaves the machine. The clock is fixed at 2026-10-21 17:30 Pacific so dates in the tests never go stale.

process.env.TZ = "America/Los_Angeles";

const RealDate = Date;
const FIXED = new RealDate("2026-10-21T17:30:00-07:00").getTime();
class FakeDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(FIXED);
    else super(...(args as [string]));
  }
  static now() {
    return FIXED;
  }
}
(globalThis as { Date: DateConstructor }).Date = FakeDate as unknown as DateConstructor;

process.env.CRON_SECRET = "test-secret";
process.env.SERPAPI_KEY = "serp-test";
process.env.TICKETMASTER_API_KEY = "tm-test";
process.env.ANTHROPIC_API_KEY = "ai-test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-key";

import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { getServiceClient } from "../src/lib/serverAdmin";
import { persistEvents, dedupeRows, normalizeEventName, eventSlug, dayStamps, isIsoDay } from "../src/lib/events/eventPipeline";
import { MAJOR_SHOWS } from "../src/lib/events/majorShows";
import { pickMetaImage, isPublicHttpUrl, fillBannerArt } from "../src/lib/events/eventArt";
import { pickBannerEvents } from "../src/lib/bannerEvents";
import { eventPhase, eventCountdown, daysUntilStart } from "../src/lib/eventDates";
import {
  SEASONAL_CHANGE_EVENT,
  acceptTheme,
  applyAcceptedTheme,
  applySeasonalOverlay,
  declineTheme,
  getThemePrefs,
} from "../src/lib/seasonalConsent";
import type { SeasonalTheme } from "../src/lib/seasonalTheme";

// ───────────────────────── pretend collector_events ─────────────────────────
type Row = Record<string, unknown>;
let table: Row[] = [];

function jsonResponse(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [key, raw] of params.entries()) {
    if (["select", "order", "limit", "on_conflict", "columns"].includes(key)) continue;
    const dot = raw.indexOf(".");
    const op = raw.slice(0, dot);
    const val = raw.slice(dot + 1);
    const cell = row[key];
    const isTime = key === "starts_at" || key === "ends_at";
    const a = isTime ? RealDate.parse(String(cell)) : String(cell);
    const b = isTime ? RealDate.parse(val) : val;
    if (op === "eq" && a !== b) return false;
    if (op === "gte" && !(a >= b)) return false;
    if (op === "lte" && !(a <= b)) return false;
    if (op === "gt" && !(a > b)) return false;
    if (op === "lt" && !(a < b)) return false;
  }
  return true;
}

function checkRows(rows: Row[], existing: Row[]): { code: string; message: string } | null {
  const seen = new Set(existing.map((r) => r.slug));
  for (const r of rows) {
    if (r.name === "BAD") return { code: "23514", message: 'new row for relation "collector_events" violates check constraint "name_ok"' };
    if (seen.has(r.slug)) return { code: "23505", message: `duplicate key value violates unique constraint "collector_events_slug_key" (${String(r.slug)})` };
    seen.add(r.slug);
  }
  return null;
}

function restCollectorEvents(url: URL, init: RequestInit): Response {
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  if (method === "GET") {
    const cols = (url.searchParams.get("select") ?? "*").split(",").map((c) => c.trim());
    const limit = Number(url.searchParams.get("limit") ?? 1000);
    const out = table
      .filter((r) => matches(r, url.searchParams))
      .slice(0, limit)
      .map((r) => (cols[0] === "*" ? r : Object.fromEntries(cols.map((c) => [c, r[c] ?? null]))));
    return jsonResponse(200, out);
  }
  if (method === "POST") {
    const rows: Row[] = Array.isArray(body) ? body : [body];
    if (url.searchParams.has("on_conflict")) {
      const slugs = rows.map((r) => r.slug);
      if (new Set(slugs).size !== slugs.length) return jsonResponse(500, { code: "21000", message: "ON CONFLICT DO UPDATE command cannot affect row a second time", hint: "Ensure that no rows proposed for insertion within the same command have duplicate constrained values." });
      for (const r of rows) {
        const i = table.findIndex((t) => t.slug === r.slug);
        if (i >= 0) table[i] = { ...table[i], ...r };
        else table.push({ enabled: true, is_featured: false, ...r });
      }
      return jsonResponse(201, undefined);
    }
    const err = checkRows(rows, table);
    if (err) return jsonResponse(err.code === "23505" ? 409 : 400, err);
    for (const r of rows) table.push({ enabled: true, is_featured: false, event_type: "national", ...r });
    return jsonResponse(201, undefined);
  }
  if (method === "PATCH") {
    for (const r of table) if (matches(r, url.searchParams)) Object.assign(r, body);
    return jsonResponse(204, undefined);
  }
  return jsonResponse(405, { message: "not supported by the pretend table" });
}

// ───────────────────────── pretend internet ─────────────────────────
type World = {
  serp: "ok" | "fail" | "empty-error";
  tm: "ok" | "fail";
  ai: "ok" | "fail";
  serpEvents: Array<Record<string, unknown>>; // returned for the convention and gallery searches alike (so one event arrives twice)
  tmEvents: Array<Record<string, unknown>>;
  majorAnswers: Record<string, Record<string, unknown>>; // by show name; anything missing is unconfident
  majorSerp: "ok" | "fail";
  calls: { serp: number; tm: number; ai: number };
};
let world: World;
function freshWorld(): World {
  return { serp: "ok", tm: "ok", ai: "ok", serpEvents: [], tmEvents: [], majorAnswers: {}, majorSerp: "ok", calls: { serp: 0, tm: 0, ai: 0 } };
}

async function fakeFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.host === "fake.supabase.co" && url.pathname === "/rest/v1/collector_events") return restCollectorEvents(url, init);
  if (url.host === "serpapi.com") {
    world.calls.serp += 1;
    const engine = url.searchParams.get("engine");
    const q = url.searchParams.get("q") ?? "";
    if (engine === "google_events") {
      if (world.serp === "fail") return jsonResponse(500, { error: "Internal error" });
      if (world.serp === "empty-error") return jsonResponse(200, { error: "Google hasn't returned any results for this query." });
      const wanted = /comic con convention|collector gallery/.test(q);
      return jsonResponse(200, { events_results: wanted ? world.serpEvents : [] });
    }
    // plain google (the weekly job): one search per show, snippets name the show
    if (world.majorSerp === "fail") return jsonResponse(429, { error: "Your account has run out of searches." });
    return jsonResponse(200, { organic_results: [{ title: q, snippet: `${q} snippet`, link: "https://example.test/" }] });
  }
  if (url.host === "app.ticketmaster.com") {
    world.calls.tm += 1;
    if (world.tm === "fail") return jsonResponse(401, { fault: "invalid key" });
    const keyword = url.searchParams.get("keyword");
    return jsonResponse(200, keyword === "comic con" ? { _embedded: { events: world.tmEvents } } : {});
  }
  if (url.host === "api.anthropic.com") {
    world.calls.ai += 1;
    if (world.ai === "fail") return jsonResponse(529, { error: { type: "overloaded_error" } });
    const prompt: string = JSON.parse(String(init.body)).messages[0].content;
    const lines = prompt.split("\n");
    const payload = JSON.parse(lines[lines.length - 1]) as Array<Record<string, unknown>>;
    let answer: unknown;
    if (prompt.includes("screening event listings")) {
      answer = payload.map((c) => ({ i: c.i, relevant: !/plumbing/i.test(String(c.name)) }));
    } else {
      answer = payload.map((s) => world.majorAnswers[String(s.name)] ?? { name: s.name, confident: false, startDate: null, endDate: null, city: null, link: null });
    }
    return jsonResponse(200, { content: [{ type: "text", text: JSON.stringify(answer) }] });
  }
  if (url.host === "organiser.test") {
    const page = (head: string) => new Response(`<html><head>${head}</head><body/></html>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    if (url.pathname === "/with-art") return page(`<meta property="og:title" content="X"><meta content="/img/banner.jpg" property="og:image">`);
    if (url.pathname === "/twitter-art") return page(`<meta name="twitter:image" content="https://img.test/a.jpg?x=1&amp;y=2">`);
    if (url.pathname === "/not-image") return page(`<meta property="og:image" content="https://img.test/page.html">`);
    if (url.pathname === "/svg") return page(`<meta property="og:image" content="https://img.test/logo.svg">`);
    if (url.pathname === "/no-meta") return page("<title>nothing</title>");
    if (url.pathname === "/gone") return new Response("nope", { status: 404 });
  }
  if (url.host === "img.test" || url.host === "organiser.test") {
    const isImage = /.(jpg|png)$/.test(url.pathname) || url.pathname === "/img/banner.jpg";
    return new Response(isImage ? "x" : "<html/>", { status: 206, headers: { "content-type": isImage ? "image/jpeg" : "text/html" } });
  }
  throw new Error(`test tried to reach the real internet: ${url.href}`);
}
(globalThis as { fetch: typeof fetch }).fetch = fakeFetch as typeof fetch;

// ───────────────────────── harness ─────────────────────────
const results: Array<{ name: string; ok: boolean; err?: string }> = [];
async function test(name: string, fn: () => Promise<void> | void) {
  table = [];
  world = freshWorld();
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, err: String((e as Error)?.stack ?? e).split("\n").slice(0, 4).join(" | ") });
  }
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(handler: (req: NextRequest) => Promise<Response>, auth: string | null = "Bearer test-secret"): Promise<{ status: number; body: Json }> {
  const headers: Record<string, string> = {};
  if (auth) headers.authorization = auth;
  const res = await handler(new NextRequest("http://localhost/api/cron/x", { headers }));
  return { status: res.status, body: (await res.json()) as Json };
}

function silenceLogs<T>(fn: () => Promise<T>): Promise<T> {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  return fn().finally(() => {
    console.log = log;
    console.error = error;
  });
}

const serpEvent = (title: string, start: string, when: string, address: string[]) => ({ title, date: { start_date: start, when }, address, link: `https://example.test/${encodeURIComponent(title)}`, description: `${title} description` });
const tmEvent = (name: string, start: string, end: string, city?: string, state?: string) => ({
  name,
  url: `https://tm.test/${encodeURIComponent(name)}`,
  dates: { start: { localDate: start }, end: { localDate: end } },
  ...(city ? { _embedded: { venues: [{ name: "Hall", city: { name: city }, state: { stateCode: state } }] } } : {}),
});
const seed = (r: Row) => table.push({ enabled: true, is_featured: false, event_type: "national", country: "US", ...r });

const LA_OFFICIAL = { name: "LA Comic Con", confident: true, startDate: "2026-10-30", endDate: "2026-11-01", city: "Los Angeles", link: "https://www.comicconla.com/" };

async function main() {
  const { GET: refreshEvents } = await import("../src/app/api/cron/refresh-events/route");
  const { GET: refreshMajor } = await import("../src/app/api/cron/refresh-major-events/route");

  // ───────── scheduling and access ─────────
  await test("both cron routes are scheduled in vercel.json (daily events, weekly major shows)", async () => {
    const cfg = JSON.parse((await import("node:fs")).readFileSync("vercel.json", "utf8")) as { crons: Array<{ path: string; schedule: string }> };
    assert.ok(cfg.crons.some((c) => c.path === "/api/cron/refresh-events" && c.schedule === "0 13 * * *"));
    assert.ok(cfg.crons.some((c) => c.path === "/api/cron/refresh-major-events" && c.schedule === "0 14 * * 1"));
  });
  await test("without the right secret nothing runs: 401 for a wrong one, 503 when none is configured", async () => {
    assert.equal((await call(refreshEvents, null)).status, 401);
    assert.equal((await call(refreshEvents, "Bearer nope")).status, 401);
    assert.equal((await call(refreshMajor, "Bearer nope")).status, 401);
    const saved = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    assert.equal((await call(refreshEvents)).status, 503);
    process.env.CRON_SECRET = saved;
    assert.equal(world.calls.serp + world.calls.tm + world.calls.ai, 0, "no outside call was made");
  });

  // ───────── daily job ─────────
  await test("the same event found by two searches and by two sources is saved once, with the stored day convention", async () => {
    world.serpEvents = [serpEvent("Stan Lee Fest", "Nov 14", "Sat, Nov 14 – Sun, Nov 15", ["Convention Center", "Los Angeles, CA"])];
    world.tmEvents = [tmEvent("Stan Lee Fest", "2026-11-14", "2026-11-15", "Los Angeles", "CA"), tmEvent("Plumbing Trade Expo", "2026-11-20", "2026-11-20", "Reno", "NV")];
    const { status, body } = await silenceLogs(() => call(refreshEvents));
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.ok, true);
    assert.equal(table.length, 1, `rows: ${table.map((r) => r.slug).join(", ")}`);
    assert.equal(body.inserted, 1);
    assert.ok(body.duplicatesDropped >= 2, `dropped ${body.duplicatesDropped}`);
    const row = table[0];
    assert.equal(row.starts_at, "2026-11-14T00:00:00.000Z");
    assert.equal(row.ends_at, "2026-11-15T23:59:59.000Z");
    assert.match(String(row.slug), /^stan-lee-fest-2026-11-14-losangeles$/);
    assert.equal(table.some((r) => /plumbing/i.test(String(r.name))), false, "the AI gate dropped the unrelated show");
  });
  await test("a second run changes nothing it should not: no new copies, and nothing is blanked or re-enabled", async () => {
    world.tmEvents = [tmEvent("Matched Expo", "2026-11-20", "2026-11-20")]; // no venue, no city in this source
    seed({ slug: "importer-matched-expo", name: "Matched Expo", starts_at: "2026-11-20T00:00:00.000Z", ends_at: "2026-11-20T23:59:59.000Z", city: "Austin, TX", venue_name: "Kept Hall", long_desc: "manual text", enabled: false, is_featured: true });
    const first = await silenceLogs(() => call(refreshEvents));
    const second = await silenceLogs(() => call(refreshEvents));
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(table.length, 1, "no second copy");
    const row = table[0];
    assert.equal(row.enabled, false, "a manual disable stays");
    assert.equal(row.is_featured, true, "a manual feature stays");
    assert.equal(row.venue_name, "Kept Hall");
    assert.equal(row.city, "Austin, TX");
    assert.equal(row.name, "Matched Expo");
    assert.equal(row.slug, "importer-matched-expo");
    assert.equal(second.body.matchedExisting, 1);
  });
  await test("an event already in the table from a manual importer (different slug, different spelling) is updated, not copied", async () => {
    seed({ slug: "freshcomics-la-comic-con-2026", name: "L.A. Comic Con", starts_at: "2026-10-30T00:00:00+00:00", ends_at: "2026-11-01T23:59:59+00:00", city: "Los Angeles", state_region: "CA" });
    world.tmEvents = [tmEvent("LA Comic Con", "2026-10-30", "2026-11-01", "Los Angeles", "CA")];
    const { status } = await silenceLogs(() => call(refreshEvents));
    assert.equal(status, 200);
    assert.equal(table.length, 1);
    assert.equal(table[0].name, "L.A. Comic Con");
  });
  await test("one bad row does not sink the others, and the run says it failed", async () => {
    world.tmEvents = [tmEvent("Good One Show", "2026-11-21", "2026-11-21", "Reno", "NV"), tmEvent("BAD", "2026-11-22", "2026-11-22", "Reno", "NV"), tmEvent("Another Good Show", "2026-11-23", "2026-11-23", "Reno", "NV")];
    const { status, body } = await silenceLogs(() => call(refreshEvents));
    assert.equal(status, 502);
    assert.equal(body.ok, false);
    assert.equal(body.failed, 1);
    assert.equal(body.inserted, 2);
    assert.deepEqual(table.map((r) => r.name).sort(), ["Another Good Show", "Good One Show"]);
    assert.match(body.saveErrors[0], /BAD|bad|check constraint/i);
  });
  await test("a dead source is reported (502) while the other source's events are still saved", async () => {
    world.serp = "fail";
    world.tmEvents = [tmEvent("Reno Card Show", "2026-11-21", "2026-11-21", "Reno", "NV")];
    const { status, body } = await silenceLogs(() => call(refreshEvents));
    assert.equal(status, 502);
    assert.ok(body.problems.some((p: string) => /SerpApi/.test(p) && /every search failed/.test(p)), JSON.stringify(body.problems));
    assert.ok(body.sourceErrors.length >= 6);
    assert.equal(table.length, 1);
  });
  await test("both sources dead and the AI check down: nothing is saved and the run fails loudly", async () => {
    world.serp = "fail";
    world.tm = "fail";
    const { status, body } = await silenceLogs(() => call(refreshEvents));
    assert.equal(status, 502);
    assert.equal(table.length, 0);
    assert.equal(body.inserted, 0);
  });
  await test("the AI relevance check failing saves nothing (fail closed) and says why", async () => {
    world.ai = "fail";
    world.tmEvents = [tmEvent("Reno Card Show", "2026-11-21", "2026-11-21", "Reno", "NV")];
    const { status, body } = await silenceLogs(() => call(refreshEvents));
    assert.equal(status, 502);
    assert.equal(table.length, 0);
    assert.match(String(body.aiFilterError), /AI request failed: 529/);
  });
  await test("a search with no hits is not a failure (SerpApi's own 'no results' message)", async () => {
    world.serp = "empty-error";
    world.tm = "ok";
    const { status, body } = await silenceLogs(() => call(refreshEvents));
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.sourceErrors.length, 0);
  });
  await test("regression: the old bulk upsert lost a whole batch to one repeated slug; the new save keeps it", async () => {
    const svc = getServiceClient()!;
    const dup = { slug: "dup-2026-11-14", name: "Dup Show", starts_at: "2026-11-14T00:00:00.000Z", ends_at: "2026-11-14T23:59:59.000Z" };
    const other = { slug: "other-2026-11-15", name: "Other Show", starts_at: "2026-11-15T00:00:00.000Z", ends_at: "2026-11-15T23:59:59.000Z" };
    const old = await svc.from("collector_events").upsert([dup, other, dup], { onConflict: "slug" });
    assert.match(String(old.error?.message), /cannot affect row a second time/);
    assert.equal(table.length, 0, "the old way saved nothing from the batch");
    const result = await persistEvents(svc, [dup, other, dup]);
    assert.equal(result.inserted, 2);
    assert.equal(result.duplicatesDropped, 1);
    assert.equal(result.failed, 0);
  });
  await test("saving fails closed when the table cannot be read (no blind inserts)", async () => {
    const realFetch = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.host === "fake.supabase.co" && (init?.method ?? "GET") === "GET") return jsonResponse(503, { message: "down" });
      return fakeFetch(input, init);
    }) as typeof fetch;
    try {
      const result = await persistEvents(getServiceClient()!, [{ slug: "a-2026-11-14", name: "A", starts_at: "2026-11-14T00:00:00.000Z", ends_at: "2026-11-14T23:59:59.000Z" }]);
      assert.equal(result.failed, 1);
      assert.equal(result.inserted, 0);
      assert.equal(table.length, 0);
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = realFetch;
    }
  });
  await test("helpers: names, slugs, day stamps", () => {
    assert.equal(normalizeEventName("L.A. Comic Con"), normalizeEventName("The LA Comic-Con 2026"));
    assert.equal(eventSlug("LA Comic Con", "2026-10-30", "Los Angeles, CA"), "la-comic-con-2026-10-30-losangeles");
    assert.deepEqual(dayStamps("2026-10-30", "2026-11-01"), { starts_at: "2026-10-30T00:00:00.000Z", ends_at: "2026-11-01T23:59:59.000Z" });
    assert.deepEqual(dayStamps("2026-10-30", "2026-10-01"), { starts_at: "2026-10-30T00:00:00.000Z", ends_at: "2026-10-30T23:59:59.000Z" });
    assert.equal(isIsoDay("2026-02-30"), false);
    assert.equal(isIsoDay("2026-10-30"), true);
    const d = dedupeRows([
      { slug: "x-2026-11-14-a", name: "X Show", starts_at: "2026-11-14T00:00:00.000Z", ends_at: "2026-11-14T23:59:59.000Z", city: "Reno, NV" },
      { slug: "x-2026-11-15-b", name: "x show!", starts_at: "2026-11-15T00:00:00.000Z", ends_at: "2026-11-15T23:59:59.000Z", city: "Reno, NV", venue_name: "Hall" },
      { slug: "x-2026-11-14-c", name: "X Show", starts_at: "2026-11-14T00:00:00.000Z", ends_at: "2026-11-14T23:59:59.000Z", city: "Boise, ID" },
    ]);
    assert.equal(d.rows.length, 2, "same show in two places stays two rows");
    assert.equal(d.dropped, 1);
  });

  // ───────── weekly major-show job ─────────
  await test("LA Comic Con is on the maintained list", () => {
    const la = MAJOR_SHOWS.find((s) => s.name === "LA Comic Con");
    assert.ok(la);
    assert.deepEqual(la.universes, ["comics", "toys"]);
  });
  await test("weekly job: LA Comic Con's official October 30 to November 1 dates are stored (new table), featured, with its universes", async () => {
    world.majorAnswers = { "LA Comic Con": LA_OFFICIAL };
    const { status, body } = await silenceLogs(() => call(refreshMajor));
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(table.length, 1);
    const row = table[0];
    assert.equal(row.slug, "la-comic-con-2026-10-30-losangeles");
    assert.equal(row.starts_at, "2026-10-30T00:00:00.000Z");
    assert.equal(row.ends_at, "2026-11-01T23:59:59.000Z");
    assert.equal(row.is_featured, true);
    assert.equal(row.enabled, true);
    assert.deepEqual(row.relevant_universes, ["comics", "toys"]);
    assert.equal(row.website_url, "https://www.comicconla.com/");
    assert.equal(body.skippedUnconfident, MAJOR_SHOWS.length - 1);
  });
  await test("weekly job: with the importer's row already there, it is updated (official dates, featured), not duplicated; name and Disabled stay", async () => {
    seed({ slug: "freshcomics-la-comic-con-2026", name: "L.A. Comic Con", starts_at: "2026-10-30T00:00:00+00:00", ends_at: "2026-11-01T23:59:59+00:00", city: "Los Angeles", state_region: "CA", venue_name: "LA Convention Center", enabled: false });
    world.majorAnswers = { "LA Comic Con": LA_OFFICIAL };
    const { status, body } = await silenceLogs(() => call(refreshMajor));
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(table.length, 1);
    const row = table[0];
    assert.equal(row.name, "L.A. Comic Con");
    assert.equal(row.enabled, false);
    assert.equal(row.is_featured, true);
    assert.equal(row.venue_name, "LA Convention Center");
    assert.equal(row.starts_at, "2026-10-30T00:00:00.000Z");
    assert.equal(row.ends_at, "2026-11-01T23:59:59.000Z");
    assert.equal(body.matchedExisting, 1);
  });
  await test("weekly job: dates already over, impossible, or absurdly long are rejected; unconfident answers are skipped", async () => {
    world.majorAnswers = {
      "San Diego Comic-Con": { name: "San Diego Comic-Con", confident: true, startDate: "2025-07-24", endDate: "2025-07-27", city: "San Diego", link: null }, // last year
      "New York Comic Con": { name: "New York Comic Con", confident: true, startDate: "2026-02-30", endDate: null, city: "New York", link: null }, // not a day
      WonderCon: { name: "WonderCon", confident: true, startDate: "2026-11-10", endDate: "2026-12-30", city: "Anaheim", link: null }, // 50 days long
      "Gen Con": { name: "Gen Con", confident: false, startDate: "2027-08-01", endDate: "2027-08-04", city: "Indianapolis", link: null },
    };
    const { status, body } = await silenceLogs(() => call(refreshMajor));
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(table.length, 0);
    assert.equal(body.rejectedDates, 3);
    assert.equal(body.skippedUnconfident, MAJOR_SHOWS.length - 3);
  });
  await test("weekly job: the AI being down saves nothing and fails loudly", async () => {
    world.ai = "fail";
    const { status, body } = await silenceLogs(() => call(refreshMajor));
    assert.equal(status, 502);
    assert.match(String(body.extractionError), /AI request failed/);
    assert.equal(table.length, 0);
  });
  await test("weekly job: every search failing is reported, and the AI is not asked to date shows it has nothing about", async () => {
    world.majorSerp = "fail";
    const { status, body } = await silenceLogs(() => call(refreshMajor));
    assert.equal(status, 502);
    assert.ok(body.problems.some((p: string) => /every search failed/.test(p)));
    assert.equal(world.calls.ai, 0);
  });

  // ───────── pictures for the banner ─────────
  await test("art: the share picture a page names is found, made absolute, and unusable ones are skipped", () => {
    assert.equal(pickMetaImage(`<meta content="/img/b.jpg" property="og:image">`, "https://x.test/events/a"), "https://x.test/img/b.jpg");
    assert.equal(pickMetaImage(`<meta name="twitter:image" content="http://x.test/t.png">`, "https://x.test/"), "https://x.test/t.png");
    assert.equal(pickMetaImage(`<meta property="og:image" content="https://x.test/logo.svg"><meta name="twitter:image" content="https://x.test/t.png">`, "https://x.test/"), "https://x.test/t.png");
    assert.equal(pickMetaImage("<title>none</title>", "https://x.test/"), null);
    assert.equal(isPublicHttpUrl("http://localhost:3000/x"), false);
    assert.equal(isPublicHttpUrl("http://192.168.1.4/x"), false);
    assert.equal(isPublicHttpUrl("file:///etc/passwd"), false);
    assert.equal(isPublicHttpUrl("https://www.comicconla.com/"), true);
  });
  await test("art: fills only empty pictures, never replaces one, rejects non-images and dead pages, and saves nothing it did not verify", async () => {
    const base = { starts_at: "2026-10-30T00:00:00.000Z", ends_at: "2026-11-01T23:59:59.000Z" };
    seed({ ...base, slug: "a-fills", name: "A", website_url: "https://organiser.test/with-art" });
    seed({ ...base, slug: "b-twitter", name: "B", website_url: "https://organiser.test/twitter-art" });
    seed({ ...base, slug: "c-has-one", name: "C", website_url: "https://organiser.test/with-art", image_url: "https://img.test/mine.jpg" });
    seed({ ...base, slug: "d-not-image", name: "D", website_url: "https://organiser.test/not-image" });
    seed({ ...base, slug: "e-svg", name: "E", website_url: "https://organiser.test/svg" });
    seed({ ...base, slug: "f-nometa", name: "F", website_url: "https://organiser.test/no-meta" });
    seed({ ...base, slug: "g-gone", name: "G", website_url: "https://organiser.test/gone" });
    seed({ ...base, slug: "h-private", name: "H", website_url: "http://localhost/secret" });
    seed({ ...base, slug: "i-nosite", name: "I", website_url: null });
    seed({ ...base, slug: "j-disabled", name: "J", website_url: "https://organiser.test/with-art", enabled: false });
    const result = await fillBannerArt(getServiceClient()!, fakeFetch as typeof fetch);
    const img = (slug: string) => table.find((r) => r.slug === slug)?.image_url ?? null;
    assert.equal(img("a-fills"), "https://organiser.test/img/banner.jpg");
    assert.equal(img("b-twitter"), "https://img.test/a.jpg?x=1&y=2");
    assert.equal(img("c-has-one"), "https://img.test/mine.jpg");
    for (const slug of ["d-not-image", "e-svg", "f-nometa", "g-gone", "h-private", "i-nosite", "j-disabled"]) assert.equal(img(slug), null, slug);
    assert.equal(result.filled, 2);
    assert.deepEqual(result.filledSlugs.sort(), ["a-fills", "b-twitter"]);
    assert.equal(result.errors.length, 0);
  });
  await test("art: a refresh that matches a row keeps the picture already on it", async () => {
    seed({ slug: "keep-art", name: "Keep Art Expo", starts_at: "2026-11-20T00:00:00.000Z", ends_at: "2026-11-20T23:59:59.000Z", city: "Austin, TX", image_url: "https://img.test/mine.jpg" });
    const row = { slug: "keep-art-2026-11-20-austin", name: "Keep Art Expo", starts_at: "2026-11-20T00:00:00.000Z", ends_at: "2026-11-20T23:59:59.000Z", city: "Austin, TX", image_url: "https://img.test/theirs.jpg", venue_name: "Hall" };
    const r = await persistEvents(getServiceClient()!, [row]);
    assert.equal(r.updated, 1);
    assert.equal(table[0].image_url, "https://img.test/mine.jpg");
    assert.equal(table[0].venue_name, "Hall");
  });

  // ───────── the Home banner's ten ─────────
  const day = (iso: string) => ({ starts_at: `${iso}T00:00:00.000Z`, ends_at: `${iso}T23:59:59.000Z` });
  const span = (a: string, b: string) => ({ starts_at: `${a}T00:00:00.000Z`, ends_at: `${b}T23:59:59.000Z` });
  await test("banner: a featured major convention reaches the ten even with 128 earlier local events (the old 'ten earliest' never could)", () => {
    const local = Array.from({ length: 128 }, (_, i) => ({ id: `local-${i}`, slug: `local-${i}`, is_featured: false, ...day(`2026-10-${String(22 + (i % 8)).padStart(2, "0")}`) }));
    const la = { id: "la", slug: "la", is_featured: true, ...span("2026-10-30", "2026-11-01") };
    const nearest = local.slice(0, 30);
    const oldTen = [...local].sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 10);
    assert.equal(oldTen.some((e) => e.id === "la"), false, "the old rule cannot show it");
    const picked = pickBannerEvents([la], [...nearest, la].sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 30), new Date(2026, 9, 21, 17, 30));
    assert.equal(picked.length, 10);
    assert.ok(picked.some((e) => e.id === "la"));
    const starts = picked.map((e) => e.starts_at);
    assert.deepEqual(starts, [...starts].sort(), "shown in date order");
  });
  await test("banner: at most six featured, none beyond 60 days, none already over, no repeats", () => {
    const now = new Date(2026, 9, 21, 17, 30);
    const featured = [
      ...Array.from({ length: 9 }, (_, i) => ({ id: `f${i}`, slug: `f${i}`, is_featured: true, ...day(`2026-11-${String(2 + i).padStart(2, "0")}`) })),
      { id: "far", slug: "far", is_featured: true, ...day("2027-03-01") },
      { id: "over", slug: "over", is_featured: true, ...day("2026-10-20") },
    ];
    const nearest = [
      { id: "f0", slug: "f0", is_featured: true, ...day("2026-11-02") },
      { id: "over2", slug: "over2", is_featured: false, ...day("2026-10-21") }, // ended at 23:59:59Z = Oct 21 4:59pm PDT... still on in the viewer's calendar
      { id: "past", slug: "past", is_featured: false, ...day("2026-10-19") },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, slug: `n${i}`, is_featured: false, ...day(`2026-10-${String(22 + i).padStart(2, "0")}`) })),
    ];
    const picked = pickBannerEvents(featured, nearest, now);
    assert.equal(picked.length, 10);
    assert.equal(picked.filter((e) => e.is_featured).length, 6);
    assert.equal(picked.some((e) => ["far", "over", "past"].includes(e.id)), false);
    assert.equal(new Set(picked.map((e) => e.id)).size, picked.length);
    assert.ok(picked.some((e) => e.id === "over2"), "an event on today's date is still on in the viewer's calendar");
  });

  // ───────── date filters (the viewer's own calendar days) ─────────
  await test("dates: a US event is not 'Happening now!' the evening before it starts, nor over on the evening of its last day", () => {
    assert.equal(new Date(2026, 9, 21, 17, 30).getTimezoneOffset(), 420, "test clock is Pacific daylight time");
    const anaheim = day("2026-10-22");
    const eveningBefore = new Date(2026, 9, 21, 17, 30); // Oct 22 00:30 UTC
    assert.ok(RealDate.parse(anaheim.starts_at) <= eveningBefore.getTime(), "read as instants it would already be on");
    assert.equal(eventPhase(anaheim, eveningBefore), "upcoming");
    assert.equal(daysUntilStart(anaheim, eveningBefore), 1);
    assert.equal(eventPhase(anaheim, new Date(2026, 9, 22, 9, 0)), "live");
    const la = span("2026-10-30", "2026-11-01");
    const lastEvening = new Date(2026, 10, 1, 18, 0); // Nov 2 01:00 UTC
    assert.ok(RealDate.parse(la.ends_at) < lastEvening.getTime(), "read as instants it would already be over");
    assert.equal(eventPhase(la, lastEvening), "live");
    assert.equal(eventPhase(la, new Date(2026, 10, 2, 0, 5)), "past");
    assert.equal(eventCountdown(la, new Date(2026, 10, 1, 18, 0)), "Happening now!");
    assert.equal(eventCountdown({ ...day("2026-11-14"), city: "Reno", state_region: "NV" }, new Date(2026, 9, 21, 17, 30)), "Starts in 24 days — Reno, NV");
    // timed events keep their real instants; the +00:00 spelling from the database counts as the same convention
    assert.equal(eventPhase({ starts_at: "2026-10-22T18:00:00+00:00", ends_at: "2026-10-22T22:00:00+00:00" }, new Date("2026-10-22T20:00:00Z")), "live");
    assert.equal(eventPhase({ starts_at: "2026-10-30T00:00:00+00:00", ends_at: "2026-11-01T23:59:59+00:00" }, lastEvening), "live");
  });

  // ───────── seasonal themes: layered over the base theme, one at a time, fully removed ─────────
  await test("themes: Yes layers the seasonal colours over the base ones, switching replaces, No / Back to normal restores the base exactly", () => {
    const store = new Map<string, string>();
    const attrs = new Map<string, string>();
    const root = {
      style: {
        setProperty: (k: string, v: string) => void store.set(k, v),
        removeProperty: (k: string) => void store.delete(k),
        getPropertyValue: (k: string) => store.get(k) ?? "",
      },
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
      removeAttribute: (k: string) => void attrs.delete(k),
      hasAttribute: (k: string) => attrs.has(k),
      getAttribute: (k: string) => attrs.get(k) ?? null,
    };
    const ls = new Map<string, string>();
    const win = new EventTarget();
    Object.assign(globalThis, {
      document: { documentElement: root },
      window: win,
      localStorage: { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => void ls.set(k, v) },
    });
    // the base theme, as ThemeContext does it: its own inline colours, then the overlay, and again whenever the seasonal theme changes
    const BASE = { "--theme-gold": "#C8CDD2", "--theme-gold-border": "rgba(203, 208, 213, 0.34)", "--accent": "#C8CDD2", "--accent-2": "#C8CDD2", "--theme-gold-gradient": "base-gradient", "--theme-gold-glow": "base-glow", "--theme-gold-subtle": "base-subtle" };
    const applyBase = () => {
      for (const [k, v] of Object.entries(BASE)) root.style.setProperty(k, v);
      applySeasonalOverlay();
    };
    win.addEventListener(SEASONAL_CHANGE_EVENT, applyBase);
    applyBase();
    const theme = (slug: string, accent: string | null): SeasonalTheme => ({ id: slug, name: slug, slug, starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-11-01T23:59:59Z", enabled: true, accent_color: accent, accent_secondary: "#1A0A2E", bg_tint: null, banner_enabled: true, banner_heading: slug, banner_subtext: null, banner_emoji: null, banner_cta_label: null, banner_cta_href: null, featured_category: null, accent_style: "none", created_at: "", updated_at: "" });
    const halloween = theme("halloween-2026", "#FF6B00");
    const fifa = theme("fifa-2026", "#00A551");
    const both = [fifa, halloween];
    const colours = () => Object.fromEntries(Object.keys(BASE).map((k) => [k, root.style.getPropertyValue(k)]));

    assert.equal(applyAcceptedTheme(both), null, "nothing accepted: nothing seasonal");
    assert.deepEqual(colours(), BASE);
    assert.equal(root.getAttribute("data-seasonal"), null);

    acceptTheme(halloween, both);
    assert.equal(root.getAttribute("data-seasonal"), "halloween-2026");
    assert.equal(root.style.getPropertyValue("--theme-gold"), "#FF6B00");
    assert.equal(root.style.getPropertyValue("--accent"), "#FF6B00");
    assert.match(root.style.getPropertyValue("--theme-gold-border"), /#FF6B00/);

    // the base theme re-applying itself (the person changes Dark/Light) keeps the seasonal colours on top
    applyBase();
    assert.equal(root.style.getPropertyValue("--theme-gold"), "#FF6B00");

    acceptTheme(fifa, both);
    assert.equal(root.getAttribute("data-seasonal"), "fifa-2026");
    assert.equal(root.style.getPropertyValue("--theme-gold"), "#00A551");
    assert.equal(getThemePrefs()["halloween-2026"], "dismissed", "the replaced theme is off");
    assert.equal(getThemePrefs()["fifa-2026"], "accepted");
    assert.doesNotMatch(JSON.stringify(colours()), /FF6B00/i, "nothing of the previous theme is left");

    declineTheme(fifa, both);
    assert.equal(root.getAttribute("data-seasonal"), null);
    assert.deepEqual(colours(), BASE, "every base colour is back, exactly");
    assert.equal(root.style.getPropertyValue("--seasonal-accent"), "");

    // a reload: accepted state is read back from storage; a declined one stays off
    ls.set("vltd_theme_overrides", JSON.stringify({ "halloween-2026": "accepted" }));
    assert.equal(applyAcceptedTheme(both)?.slug, "halloween-2026");
    assert.equal(root.style.getPropertyValue("--theme-gold"), "#FF6B00");
    ls.set("vltd_theme_overrides", JSON.stringify({ "halloween-2026": "dismissed" }));
    assert.equal(applyAcceptedTheme(both), null);
    assert.deepEqual(colours(), BASE);

    // a theme without a usable accent never recolors anything
    ls.set("vltd_theme_overrides", JSON.stringify({ x: "accepted" }));
    assert.equal(applyAcceptedTheme([theme("x", null)]), null);
    ls.set("vltd_theme_overrides", JSON.stringify({ y: "accepted" }));
    acceptTheme(theme("y", "red; background:url(x)"), [theme("y", "red; background:url(x)")]);
    assert.deepEqual(colours(), BASE, "an accent that is not a hex colour is never written into a style");
  });

  const failed = results.filter((r) => !r.ok);
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.err ? `\n      ${r.err}` : ""}`);
  console.log(`\n${results.length - failed.length} of ${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

void main();
