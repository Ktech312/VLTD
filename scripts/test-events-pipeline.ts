// Tests for the scheduled event refreshes and the Home banner, 2026-10-21 banner/events pass.
//   npm run test:events
//
// The REAL route handlers (api/cron/refresh-events and api/cron/refresh-major-events) run here against a pretend internet: global fetch answers SerpApi,
// Ticketmaster and the AI endpoint with canned replies (no key is used, no credit is spent), and the Supabase service client talks to a small in-memory
// stand-in for the collector_events table (unique slug, atomic inserts, a check that rejects a row named BAD, and the Postgres refusal of an upsert that
// names one slug twice). Nothing leaves the machine. The clock is fixed at 2026-10-21 17:30 Pacific so dates in the tests never go stale.

process.env.TZ = "America/Los_Angeles";

const RealDate = Date;
let FIXED = new RealDate("2026-10-21T17:30:00-07:00").getTime();
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
process.env.EVENTS_REFRESH_ENABLED = "true"; // the jobs are OFF in production; these tests run them as if the owner had switched them on (the off state is tested separately)
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
import { AI_MAX_OUTPUT_TOKENS, monthlyWindows, planCounts, worstCase } from "../src/lib/events/monthlyRefreshPlan";
import { pickMetaImage, isPublicHttpUrl, fillBannerArt, artKind, withArtKind, pngHasAlpha } from "../src/lib/events/eventArt";
import { pickBannerEvents } from "../src/lib/bannerEvents";
import { eventPhase, eventCountdown, daysUntilStart, earliestStoredEnd, eventBounds } from "../src/lib/eventDates";
import { eventTimeZone } from "../src/lib/eventTimeZone";
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

// ───────────────────────── pretend refresh memory (SQL file 8) ─────────────────────────
type StoreTables = { event_refresh_candidates: Row[]; event_refresh_steps: Row[] };
let store: StoreTables | null = null; // null = the tables do not exist yet
const STORE_KEY: Record<string, string> = { event_refresh_candidates: "slug", event_refresh_steps: "step_key" };
function freshStore(): StoreTables {
  return { event_refresh_candidates: [], event_refresh_steps: [] };
}
function storeMatch(row: Row, params: URLSearchParams): boolean {
  for (const [key, raw] of params.entries()) {
    if (["select", "order", "limit", "on_conflict", "columns"].includes(key)) continue;
    const dot = raw.indexOf(".");
    const op = raw.slice(0, dot);
    const val = raw.slice(dot + 1);
    const cell = row[key];
    if (op === "eq" && String(cell) !== val) return false;
    if (op === "is" && val === "null" && cell !== null && cell !== undefined) return false;
    if (op === "in" && !val.slice(1, -1).split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(cell))) return false;
    if (op === "like" && !new RegExp("^" + val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$").test(String(cell))) return false;
    if (op === "lt" && !(String(cell) < val)) return false;
  }
  return true;
}
function restStore(url: URL, init: RequestInit, name: keyof StoreTables): Response {
  if (!store) return jsonResponse(404, { code: "PGRST205", message: `Could not find the table 'public.${name}' in the schema cache` });
  const rows = store[name];
  const pk = STORE_KEY[name];
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  if (method === "GET") {
    let out = rows.filter((r) => storeMatch(r, url.searchParams));
    const order = url.searchParams.get("order");
    if (order) { const col = order.split(".")[0]; out = [...out].sort((a, b) => String(a[col]).localeCompare(String(b[col]))); }
    out = out.slice(0, Number(url.searchParams.get("limit") ?? 1000));
    const cols = (url.searchParams.get("select") ?? "*").split(",").map((c) => c.trim());
    return jsonResponse(200, out.map((r) => (cols[0] === "*" ? r : Object.fromEntries(cols.map((c) => [c, r[c] ?? null])))));
  }
  if (method === "POST") {
    const incoming: Row[] = Array.isArray(body) ? body : [body];
    const upsert = url.searchParams.has("on_conflict");
    for (const r of incoming) {
      const i = rows.findIndex((x) => x[pk] === r[pk]);
      if (i >= 0 && !upsert) return jsonResponse(409, { code: "23505", message: "duplicate key value violates unique constraint" });
      if (i >= 0) rows[i] = { ...rows[i], ...r };
      else rows.push(name === "event_refresh_candidates" ? { verdict: "pending", saved_at: null, judged_at: null, last_seen_at: new RealDate(FIXED).toISOString(), ...r } : { created_at: new RealDate(FIXED).toISOString(), ...r });
    }
    return jsonResponse(201, undefined);
  }
  if (method === "PATCH") {
    for (const r of rows) if (storeMatch(r, url.searchParams)) Object.assign(r, body);
    return jsonResponse(204, undefined);
  }
  if (method === "DELETE") {
    for (let i = rows.length - 1; i >= 0; i--) if (storeMatch(rows[i], url.searchParams)) rows.splice(i, 1);
    return jsonResponse(204, undefined);
  }
  return jsonResponse(405, { message: "not supported" });
}

// ───────────────────────── pretend internet ─────────────────────────
type World = {
  serp: "ok" | "fail" | "empty-error";
  tm: "ok" | "fail";
  ai: "ok" | "fail" | "nocredit";
  aiOmit: string[]; // names the AI leaves out of its answer
  aiNames: string[][]; // the names put to the AI on each call
  serpEvents: Array<Record<string, unknown>>; // returned for the convention and gallery searches alike (so one event arrives twice)
  tmEvents: Array<Record<string, unknown>>;
  majorAnswers: Record<string, Record<string, unknown>>; // by show name; anything missing is unconfident
  majorSerp: "ok" | "fail";
  calls: { serp: number; tm: number; ai: number };
  tmUrls: string[]; // the Ticketmaster searches made, as sent
  aiMaxTokens: number[]; // the output limit sent with each AI call
  serpQueries: string[];
};
let world: World;
function freshWorld(): World {
  return { serp: "ok", tm: "ok", ai: "ok", aiOmit: [], aiNames: [], serpEvents: [], tmEvents: [], majorAnswers: {}, majorSerp: "ok", calls: { serp: 0, tm: 0, ai: 0 }, tmUrls: [], aiMaxTokens: [], serpQueries: [] };
}

async function fakeFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.host === "fake.supabase.co" && url.pathname === "/rest/v1/collector_events") return restCollectorEvents(url, init);
  if (url.host === "fake.supabase.co" && (url.pathname === "/rest/v1/event_refresh_candidates" || url.pathname === "/rest/v1/event_refresh_steps")) return restStore(url, init, url.pathname.split("/").pop() as keyof StoreTables);
  if (url.host === "serpapi.com") {
    world.calls.serp += 1;
    const engine = url.searchParams.get("engine");
    const q = url.searchParams.get("q") ?? "";
    if (engine === "google_events") {
      if (world.serp === "fail") return jsonResponse(500, { error: "Internal error" });
      if (world.serp === "empty-error") return jsonResponse(200, { error: "Google hasn't returned any results for this query." });
      world.serpQueries.push(q);
      const wanted = /comic con convention|collector gallery/.test(q);
      return jsonResponse(200, { events_results: wanted ? world.serpEvents : [] });
    }
    // plain google (the weekly job): one search per show, snippets name the show
    if (world.majorSerp === "fail") return jsonResponse(429, { error: "Your account has run out of searches." });
    return jsonResponse(200, { organic_results: [{ title: q, snippet: `${q} snippet`, link: "https://example.test/" }] });
  }
  if (url.host === "app.ticketmaster.com") {
    world.calls.tm += 1;
    world.tmUrls.push(url.search);
    if (world.tm === "fail") return jsonResponse(401, { fault: "invalid key" });
    const keyword = url.searchParams.get("keyword");
    return jsonResponse(200, keyword === "comic con" ? { _embedded: { events: world.tmEvents } } : {});
  }
  if (url.host === "api.anthropic.com") {
    world.calls.ai += 1;
    if (world.ai === "fail") return jsonResponse(529, { error: { type: "overloaded_error" } });
    if (world.ai === "nocredit") return jsonResponse(400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits." } });
    world.aiMaxTokens.push(JSON.parse(String(init.body)).max_tokens);
    const prompt: string = JSON.parse(String(init.body)).messages[0].content;
    const lines = prompt.split("\n");
    const payload = JSON.parse(lines[lines.length - 1]) as Array<Record<string, unknown>>;
    let answer: unknown;
    world.aiNames.push(payload.map((c) => String(c.name)));
    if (prompt.includes("screening event listings")) {
      answer = payload.filter((c) => !world.aiOmit.includes(String(c.name))).map((c) => ({ i: c.i, relevant: !/plumbing/i.test(String(c.name)) }));
    } else {
      answer = payload.map((s) => world.majorAnswers[String(s.name)] ?? { name: s.name, confident: false, startDate: null, endDate: null, city: null, link: null });
    }
    return jsonResponse(200, { content: [{ type: "text", text: JSON.stringify(answer) }], usage: { input_tokens: 1000, output_tokens: 100 } });
  }
  if (url.host === "organiser.test") {
    const page = (head: string) => new Response(`<html><head>${head}</head><body/></html>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    if (url.pathname === "/with-art") return page(`<meta property="og:title" content="X"><meta content="/img/banner.jpg" property="og:image">`);
    if (url.pathname === "/twitter-art") return page(`<meta name="twitter:image" content="https://img.test/a.jpg?x=1&amp;y=2">`);
    if (url.pathname === "/not-image") return page(`<meta property="og:image" content="https://img.test/page.html">`);
    if (url.pathname === "/svg") return page(`<meta property="og:image" content="https://img.test/logo.svg">`);
    if (url.pathname === "/no-meta") return page("<title>nothing</title>");
    if (url.pathname === "/gone") return new Response("nope", { status: 404 });
    if (url.pathname === "/graphic-art") return page(`<meta property="og:image" content="https://img.test/logo.png">`);
  }
  if (url.host === "img.test" || url.host === "organiser.test") {
    if (url.pathname === "/logo.png") {
      // a PNG whose header says "colour type 6": RGB with transparency
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]), { status: 206, headers: { "content-type": "image/png" } });
    }
    const isImage = /.(jpg|png)$/.test(url.pathname) || url.pathname === "/img/banner.jpg";
    return new Response(isImage ? "x" : "<html/>", { status: 206, headers: { "content-type": isImage ? "image/jpeg" : "text/html" } });
  }
  throw new Error(`test tried to reach the real internet: ${url.href}`);
}
(globalThis as { fetch: typeof fetch }).fetch = fakeFetch as typeof fetch;

// ───────────────────────── harness ─────────────────────────
const results: Array<{ name: string; ok: boolean; err?: string }> = [];
const START = FIXED;
async function test(name: string, fn: () => Promise<void> | void) {
  table = [];
  store = null;
  FIXED = START;
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
  const { GET: refreshMonthly } = await import("../src/app/api/cron/refresh-events-monthly/route");
  const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

  // ───────── scheduling and access ─────────
  await test("the daily and weekly Events schedules are removed from vercel.json (nothing calls the paid jobs on its own)", async () => {
    const cfg = JSON.parse((await import("node:fs")).readFileSync("vercel.json", "utf8")) as { crons?: Array<{ path: string }> };
    assert.deepEqual(cfg.crons ?? [], []);
  });
  await test("switched off (the default): a call with the right secret does nothing - zero searches, zero AI calls, zero database calls - and says so", async () => {
    const saved = process.env.EVENTS_REFRESH_ENABLED;
    try {
      delete process.env.EVENTS_REFRESH_ENABLED;
      const before = JSON.stringify(world.calls);
      for (const [name, handler] of [["refresh-events", refreshEvents], ["refresh-major-events", refreshMajor]] as const) {
        const res = await silenceLogs(() => call(handler));
        assert.equal(res.status, 200, name);
        assert.equal((res.body as { disabled?: boolean }).disabled, true, name);
      }
      assert.equal(JSON.stringify(world.calls), before, "no outside call of any kind was made");
      process.env.EVENTS_REFRESH_ENABLED = "false";
      assert.equal(((await silenceLogs(() => call(refreshEvents))).body as { disabled?: boolean }).disabled, true, "only the exact word true switches it on");
    } finally {
      process.env.EVENTS_REFRESH_ENABLED = saved;
    }
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

  // ───────── monthly refresh (disabled until its cost is approved) ─────────
  const APPROVED = { EVENTS_MONTHLY_REFRESH_ENABLED: "true", EVENTS_MONTHLY_APPROVED_MAX_USD: "1.00", EVENTS_MONTHLY_APPROVED_MAX_SEARCHES: "24" };
  const withEnv = async (vars: Record<string, string | undefined>, fn: () => Promise<void>) => {
    const keys = ["EVENTS_MONTHLY_REFRESH_ENABLED", "EVENTS_MONTHLY_APPROVED_MAX_USD", "EVENTS_MONTHLY_APPROVED_MAX_SEARCHES", "SERPAPI_USD_PER_SEARCH"];
    const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    try {
      for (const k of keys) delete process.env[k];
      for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v;
      await fn();
    } finally {
      for (const k of keys) {
        if (before[k] === undefined) delete process.env[k];
        else process.env[k] = before[k];
      }
    }
  };
  const noOutsideCall = () => assert.equal(world.calls.serp + world.calls.tm + world.calls.ai, 0, "no search and no AI call was made");

  await test("monthly plan: 24 Google Events searches, 24 Ticketmaster searches, 6 AI calls, and a worst case of $0.69 that the limits themselves enforce", () => {
    const c = planCounts();
    assert.deepEqual(c, { windows: 4, categories: 6, serpSearches: 24, ticketmasterSearches: 24, aiCalls: 6, maxCandidatesForAi: 300 });
    const w = worstCase();
    assert.equal(round4(w.serpUsd), 0.6, "24 searches at the dearest verified plan, $0.025 each");
    assert.equal(round4(w.aiUsd), 0.093, "6 calls x (8,000 input tokens x $1 + 1,500 output tokens x $5) per million");
    assert.equal(round4(w.totalUsd), 0.693);
    assert.equal(AI_MAX_OUTPUT_TOKENS, 1500);
    assert.equal(round4(worstCase(0.01).totalUsd), 0.333, "on the cheapest plan the same plan costs less");
  });
  await test("monthly plan: the coming year is four windows that start today and then on the first of a month, and the last one ends a year out", () => {
    const w = monthlyWindows(new Date());
    assert.deepEqual(w.map((x) => [x.startDay, x.endDay]), [["2026-10-22", "2027-01-01"], ["2027-01-01", "2027-04-01"], ["2027-04-01", "2027-07-01"], ["2027-07-01", "2027-10-01"]]);
    assert.equal(w[0].months, "October 2026 November 2026 December 2026");
    assert.equal(w[3].label, "July 2027 to September 2027");
  });
  await test("monthly: with nothing set it is OFF - zero searches, zero AI calls, zero database writes - and says what is missing", async () => {
    await withEnv({}, async () => {
      const { status, body } = await silenceLogs(() => call(refreshMonthly));
      assert.equal(status, 200);
      assert.equal(body.disabled, true);
      assert.ok(body.refusedBecause.length >= 3, JSON.stringify(body.refusedBecause));
      assert.equal(body.worstCaseUsd.total, 0.693);
      noOutsideCall();
      assert.equal(table.length, 0);
    });
  });
  await test("monthly: every approval is needed on its own - not enabled, no cost approved, a cost below the worst case, too few searches, an unreadable price: each sends nothing", async () => {
    const cases: Array<[string, Record<string, string | undefined>, RegExp]> = [
      ["not enabled", { ...APPROVED, EVENTS_MONTHLY_REFRESH_ENABLED: "yes" }, /EVENTS_MONTHLY_REFRESH_ENABLED/],
      ["no cost approved", { ...APPROVED, EVENTS_MONTHLY_APPROVED_MAX_USD: undefined }, /no cost has been approved/],
      ["cost below the worst case", { ...APPROVED, EVENTS_MONTHLY_APPROVED_MAX_USD: "0.50" }, /below this plan's worst case/],
      ["search count too low", { ...APPROVED, EVENTS_MONTHLY_APPROVED_MAX_SEARCHES: "10" }, /approved search count 10/],
      ["no search count", { ...APPROVED, EVENTS_MONTHLY_APPROVED_MAX_SEARCHES: undefined }, /no search count has been approved/],
      ["a dearer price makes the same ceiling too low", { ...APPROVED, SERPAPI_USD_PER_SEARCH: "0.05" }, /below this plan's worst case/],
      ["an unreadable price", { ...APPROVED, SERPAPI_USD_PER_SEARCH: "cheap" }, /not a positive number/],
    ];
    for (const [name, vars, why] of cases) {
      await withEnv(vars, async () => {
        const { status, body } = await silenceLogs(() => call(refreshMonthly));
        assert.equal(status, 200, name);
        assert.equal(body.disabled, true, name);
        assert.ok(body.refusedBecause.some((r: string) => why.test(r)), `${name}: ${JSON.stringify(body.refusedBecause)}`);
        noOutsideCall();
      });
    }
    assert.equal(table.length, 0);
  });
  await test("monthly: it needs the secret like the others, and ?plan=1 shows the plan and the cost with no outside request even when approved", async () => {
    await withEnv(APPROVED, async () => {
      assert.equal((await call(refreshMonthly, null)).status, 401);
      assert.equal((await call(refreshMonthly, "Bearer nope")).status, 401);
      const res = await refreshMonthly(new NextRequest("http://localhost/api/cron/refresh-events-monthly?plan=1", { headers: { authorization: "Bearer test-secret" } }));
      const body = (await res.json()) as Json;
      assert.equal(res.status, 200);
      assert.equal(body.enabled, true);
      assert.equal(body.plan.googleEventsSearches, 24);
      assert.equal(body.plan.retries, 0);
      assert.equal(body.worstCaseUsd.total, 0.693);
      noOutsideCall();
    });
  });
  await test("monthly: an approved run makes exactly the planned requests once each - 24 + 24 + 1 here - with the date window on every Ticketmaster search and the AI answer capped", async () => {
    await withEnv(APPROVED, async () => {
      world.serpEvents = [serpEvent("Stan Lee Fest", "Nov 14", "Sat, Nov 14 – Sun, Nov 15", ["Convention Center", "Los Angeles, CA"])];
      world.tmEvents = [tmEvent("Stan Lee Fest", "2026-11-14", "2026-11-15", "Los Angeles", "CA"), tmEvent("Plumbing Trade Expo", "2026-11-20", "2026-11-20", "Reno", "NV"), tmEvent("Reno Card Show", "2027-03-06", "2027-03-07", "Reno", "NV")];
      const { status, body } = await silenceLogs(() => call(refreshMonthly));
      assert.equal(status, 200, JSON.stringify(body));
      assert.deepEqual([world.calls.serp, world.calls.tm, world.calls.ai], [24, 24, 1]);
      assert.equal(body.usage.retries, 0);
      assert.deepEqual(world.aiMaxTokens, [1500]);
      const windows = world.tmUrls.map((u) => new URLSearchParams(u)).map((p) => `${p.get("startDateTime")}..${p.get("endDateTime")}`);
      assert.deepEqual([...new Set(windows)].sort(), ["2026-10-22T00:00:00Z..2027-01-01T00:00:00Z", "2027-01-01T00:00:00Z..2027-04-01T00:00:00Z", "2027-04-01T00:00:00Z..2027-07-01T00:00:00Z", "2027-07-01T00:00:00Z..2027-10-01T00:00:00Z"]);
      assert.ok(world.serpQueries.every((q) => /20(26|27)$/.test(q)), "every Google Events query names its months");
      assert.deepEqual(table.map((r) => r.name).sort(), ["Reno Card Show", "Stan Lee Fest"], "the AI gate dropped the unrelated show; the same show from two sources is one row");
      // what it reports: the planned numbers, from the usage the services themselves reported
      assert.deepEqual(body.usage.googleEventsSearches, { made: 24, succeeded: 24 });
      assert.equal(body.usage.aiCalls.inputTokens, 1000);
      assert.equal(body.estimatedUsd.googleEventsSearches, 0.6);
      assert.equal(body.estimatedUsd.aiChecks, 0.0015);
      assert.equal(body.estimatedUsd.basis, "estimate, not billing");
      assert.ok(body.estimatedUsd.total <= 0.693, "never above the ceiling that was approved");
    });
  });
  await test("monthly: nothing is ever repeated - a failing Google Events source is still asked 24 times, not more, and Ticketmaster's events are kept", async () => {
    await withEnv(APPROVED, async () => {
      world.serp = "fail";
      world.tmEvents = [tmEvent("Reno Card Show", "2027-03-06", "2027-03-07", "Reno", "NV")];
      const { status, body } = await silenceLogs(() => call(refreshMonthly));
      assert.equal(status, 200, JSON.stringify(body));
      assert.deepEqual([world.calls.serp, world.calls.tm, world.calls.ai], [24, 24, 1]);
      assert.deepEqual(body.usage.googleEventsSearches, { made: 24, succeeded: 0 });
      assert.equal(body.estimatedUsd.googleEventsSearches, 0, "failed searches are not billed");
      assert.equal(table.length, 1);
    });
  });
  await test("monthly: when the AI is refused (no credit) it is asked once per group and not again, nothing is published, and the run fails loudly", async () => {
    await withEnv(APPROVED, async () => {
      world.ai = "nocredit";
      world.tmEvents = [tmEvent("Reno Card Show", "2027-03-06", "2027-03-07", "Reno", "NV")];
      const { status, body } = await silenceLogs(() => call(refreshMonthly));
      assert.equal(status, 502);
      assert.equal(world.calls.ai, 1, "one group, one call, no second try");
      assert.equal(world.calls.serp, 24);
      assert.equal(table.length, 0);
      assert.ok(body.errors.some((e: string) => /credit balance is too low/.test(e)));
    });
  });
  await test("monthly: with no AI key nothing is searched at all (a search with nothing to judge it would be paid for in vain)", async () => {
    await withEnv(APPROVED, async () => {
      const saved = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      try {
        const { status } = await silenceLogs(() => call(refreshMonthly));
        assert.equal(status, 503);
        noOutsideCall();
      } finally {
        process.env.ANTHROPIC_API_KEY = saved;
      }
    });
  });
  await test("monthly: the 300-event cap holds - 320 found, 300 put to the AI in 6 calls of at most 50, 20 left out and reported", async () => {
    await withEnv(APPROVED, async () => {
      world.tmEvents = Array.from({ length: 320 }, (_, i) => tmEvent(`Card Show ${i}`, `2027-01-${String(1 + (i % 28)).padStart(2, "0")}`, `2027-01-${String(1 + (i % 28)).padStart(2, "0")}`, "Reno", "NV"));
      const { body } = await silenceLogs(() => call(refreshMonthly));
      assert.equal(world.calls.ai, 6);
      assert.ok(world.aiNames.every((n) => n.length <= 50));
      assert.equal(world.aiNames.reduce((n, g) => n + g.length, 0), 300);
      assert.equal(body.putToTheAi, 300);
      assert.equal(body.leftOutByTheCap, 20);
      assert.ok(body.problems.some((p: string) => /beyond the 300 cap/.test(p)));
      assert.ok(body.estimatedUsd.total <= 0.693);
    });
  });
  await test("monthly: nothing from the monthly job is scheduled, and with every refresh off the banner, countdown and expiry still work from stored rows with no outside request", async () => {
    const cfg = JSON.parse((await import("node:fs")).readFileSync("vercel.json", "utf8")) as { crons?: unknown[] };
    assert.deepEqual(cfg.crons ?? [], []);
    const saved = process.env.EVENTS_REFRESH_ENABLED;
    try {
      delete process.env.EVENTS_REFRESH_ENABLED;
      await withEnv({}, async () => {
        const span = (a: string, b: string) => ({ starts_at: `${a}T00:00:00.000Z`, ends_at: `${b}T23:59:59.000Z` });
        const rows = [
          { id: "over", slug: "over", is_featured: true, ...span("2026-10-10", "2026-10-12") },
          { id: "soon", slug: "soon", is_featured: true, ...span("2026-10-30", "2026-11-01") },
          { id: "later", slug: "later", is_featured: false, ...span("2026-12-05", "2026-12-06") },
        ];
        const now = new Date();
        let picked = pickBannerEvents(rows.filter((r) => r.is_featured), rows, now).map((e) => e.id);
        assert.deepEqual(picked, ["soon", "later"], "the finished event is not shown; the rest stay in date order");
        FIXED = new RealDate("2026-11-03T12:00:00-08:00").getTime(); // days later, no refresh has run
        picked = pickBannerEvents(rows.filter((r) => r.is_featured), rows, new Date()).map((e) => e.id);
        assert.deepEqual(picked, ["later"], "an event expires on its own date, with no paid request");
        assert.equal(eventPhase(rows[1], new Date()), "past");
        noOutsideCall();
      });
    } finally {
      process.env.EVENTS_REFRESH_ENABLED = saved;
    }
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

  // ───────── a retry does not pay twice (the refresh memory, SQL file 8) ─────────
  const stan = () => serpEvent("Stan Lee Fest", "Nov 14", "Sat, Nov 14 – Sun, Nov 15", ["Convention Center", "Los Angeles, CA"]);
  const reno = () => tmEvent("Reno Card Show", "2026-11-21", "2026-11-21", "Reno", "NV");
  const plumbing = () => tmEvent("Plumbing Trade Expo", "2026-11-20", "2026-11-20", "Reno", "NV");
  const daily = () => silenceLogs(() => call(refreshEvents));
  const weekly = () => silenceLogs(() => call(refreshMajor));
  const mark = () => ({ ...world.calls });
  const since = (m: { serp: number; tm: number; ai: number }) => ({ serp: world.calls.serp - m.serp, tm: world.calls.tm - m.tm, ai: world.calls.ai - m.ai });
  const cands = () => (store as StoreTables).event_refresh_candidates;

  await test("memory: before SQL file 8 is run the refresh works as it did and says the memory is not set up", async () => {
    world.tmEvents = [reno()];
    const { status, body } = await daily();
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.memory.available, false);
    assert.match(body.memory.note, /not set up/);
    assert.equal(table.length, 1);
  });
  await test("memory: when the AI check is refused, what was found is kept; a retry the same day repeats no search and asks the AI only what it has not judged", async () => {
    store = freshStore();
    world.ai = "nocredit";
    world.serpEvents = [stan()];
    world.tmEvents = [reno(), plumbing()];
    const first = await daily();
    assert.equal(first.status, 502);
    assert.match(String(first.body.aiFilterError), /credit balance is too low/);
    assert.equal(first.body.memory.askedTheAiAbout, 3);
    assert.equal(first.body.searchesRun, 12);
    assert.equal(table.length, 0, "nothing saved without the AI check");
    assert.equal(cands().length, 3, "the three parsed events are kept");
    assert.ok(cands().every((c) => c.verdict === "pending" && !c.saved_at));
    assert.equal(store!.event_refresh_steps.length, 12, "every search that succeeded is recorded");

    let m = mark();
    const retry = await daily();
    assert.equal(retry.status, 502, "still refused");
    assert.deepEqual(since(m), { serp: 0, tm: 0, ai: 1 }, "no search repeated; one AI call");
    assert.equal(retry.body.searchesRun, 0);
    assert.equal(retry.body.searchesReusedFromToday, 12);
    assert.equal(cands().length, 3, "kept, not duplicated");

    world.ai = "ok";
    m = mark();
    const third = await daily();
    assert.equal(third.status, 200, JSON.stringify(third.body));
    assert.deepEqual(since(m), { serp: 0, tm: 0, ai: 1 });
    assert.deepEqual([...world.aiNames[world.aiNames.length - 1]].sort(), ["Plumbing Trade Expo", "Reno Card Show", "Stan Lee Fest"]);
    assert.deepEqual(table.map((r) => r.name).sort(), ["Reno Card Show", "Stan Lee Fest"], "the approved ones are saved, the plumbing show is not");
    assert.equal(third.body.inserted, 2);
    const verdict = (name: string) => cands().find((c) => (c.row_data as { name: string }).name === name);
    assert.equal(verdict("Plumbing Trade Expo")?.verdict, "rejected");
    assert.ok(verdict("Stan Lee Fest")?.saved_at && verdict("Reno Card Show")?.saved_at);

    m = mark();
    const fourth = await daily();
    assert.equal(fourth.status, 200);
    assert.deepEqual(since(m), { serp: 0, tm: 0, ai: 0 }, "nothing left to judge: no AI call, no search");
    assert.equal(fourth.body.inserted, 0);
    assert.equal(table.length, 2);
  });
  await test("memory: an event the AI left out of its answer stays not-yet-judged and is the only one asked about next time", async () => {
    store = freshStore();
    world.serpEvents = [stan()];
    world.tmEvents = [reno(), plumbing()];
    world.aiOmit = ["Reno Card Show"];
    const first = await daily();
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.memory.stillNotJudged, 1);
    assert.deepEqual(table.map((r) => r.name), ["Stan Lee Fest"]);
    world.aiOmit = [];
    const second = await daily();
    assert.deepEqual(world.aiNames[world.aiNames.length - 1], ["Reno Card Show"], "only the one it had not judged");
    assert.deepEqual(table.map((r) => r.name).sort(), ["Reno Card Show", "Stan Lee Fest"]);
    assert.equal(second.body.memory.askedTheAiAbout, 1);
  });
  await test("memory: an event approved but not saved is saved on the next run without asking the AI again", async () => {
    store = freshStore();
    world.tmEvents = [tmEvent("BAD", "2026-11-22", "2026-11-22", "Reno", "NV"), reno()];
    const first = await daily();
    assert.equal(first.status, 502);
    assert.equal(first.body.failed, 1);
    const bad = () => cands().find((c) => (c.row_data as { name: string }).name === "BAD");
    assert.equal(bad()?.verdict, "approved");
    assert.equal(bad()?.saved_at ?? null, null, "approved but not saved");
    const m = mark();
    const second = await daily();
    assert.equal(since(m).ai, 0, "no AI call: it is already approved");
    assert.equal(second.body.memory.alreadyApprovedNowSaved, 1);
    assert.equal(second.body.failed, 1, "the save is tried again (and the pretend table still refuses this name)");
    assert.deepEqual(table.map((r) => r.name), ["Reno Card Show"], "the good one was not saved a second time");
  });
  await test("memory: the next day the searches run again, and events still waiting from yesterday are judged with the new ones", async () => {
    store = freshStore();
    world.ai = "nocredit";
    world.tmEvents = [reno(), plumbing()];
    await daily();
    assert.equal(cands().length, 2);
    FIXED += 24 * 3_600_000;
    world.ai = "ok";
    const m = mark();
    const next = await daily();
    assert.equal(since(m).serp, 6, "a new day: the searches are repeated");
    assert.equal(next.body.searchesReusedFromToday, 0);
    assert.equal(cands().length, 2, "the same events are not stored twice");
    assert.equal(next.status, 200, JSON.stringify(next.body));
    assert.deepEqual(table.map((r) => r.name), ["Reno Card Show"]);
  });
  await test("memory: old candidates and finished steps are cleared out", async () => {
    store = freshStore();
    const old = new RealDate(FIXED - 40 * 86_400_000).toISOString();
    cands().push({ slug: "old-1", category: "x", source: "serp", row_data: { name: "Old" }, verdict: "rejected", saved_at: null, last_seen_at: old });
    store.event_refresh_steps.push({ step_key: "search|2026-09-01|serp|convention", payload: {}, created_at: old });
    world.tmEvents = [reno()];
    await daily();
    assert.equal(cands().some((c) => c.slug === "old-1"), false);
    assert.equal(store.event_refresh_steps.some((r) => String(r.step_key).startsWith("search|2026-09-01")), false);
  });
  await test("memory (weekly major shows): a refused AI call keeps the searches; a retry the same day costs one AI call and no search, and a finished day costs none", async () => {
    store = freshStore();
    world.ai = "nocredit";
    world.majorAnswers = { "LA Comic Con": LA_OFFICIAL };
    const first = await weekly();
    assert.equal(first.status, 502);
    assert.equal(world.calls.serp, MAJOR_SHOWS.length, "one search per show, once");
    assert.equal(store!.event_refresh_steps.filter((r) => String(r.step_key).startsWith("major-snippets")).length, MAJOR_SHOWS.length);
    let m = mark();
    const retry = await weekly();
    assert.equal(retry.status, 502);
    assert.deepEqual(since(m), { serp: 0, tm: 0, ai: 1 });
    assert.equal(retry.body.reusedFromToday.searches, MAJOR_SHOWS.length);
    world.ai = "ok";
    m = mark();
    const third = await weekly();
    assert.equal(third.status, 200, JSON.stringify(third.body));
    assert.deepEqual(since(m), { serp: 0, tm: 0, ai: 1 });
    assert.equal(world.aiNames[world.aiNames.length - 1].length, MAJOR_SHOWS.length, "asked about every show once");
    assert.equal(table.length, 1);
    assert.equal(table[0].starts_at, "2026-10-30T00:00:00.000Z");
    m = mark();
    const fourth = await weekly();
    assert.equal(fourth.status, 200);
    assert.deepEqual(since(m), { serp: 0, tm: 0, ai: 0 }, "every show already answered: no search, no AI");
    assert.equal(fourth.body.reusedFromToday.aiAnswers, MAJOR_SHOWS.length);
    assert.equal(table.length, 1, "still one row for LA Comic Con");
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
    assert.equal(img("a-fills"), "https://organiser.test/img/banner.jpg#photo");
    assert.equal(img("b-twitter"), "https://img.test/a.jpg?x=1&y=2#photo");
    assert.equal(img("c-has-one"), "https://img.test/mine.jpg#photo", "a picture that is there is never replaced; it is only labelled with its kind");
    for (const slug of ["d-not-image", "e-svg", "f-nometa", "g-gone", "h-private", "i-nosite", "j-disabled"]) assert.equal(img(slug), null, slug);
    assert.equal(result.filled, 2);
    assert.deepEqual(result.filledSlugs.sort(), ["a-fills", "b-twitter"]);
    assert.equal(result.errors.length, 0);
  });
  await test("art: a transparent PNG (a logo or title lettering) is marked as a graphic, other pictures as photos; older pictures are classified once", async () => {
    const base = { starts_at: "2026-10-30T00:00:00.000Z", ends_at: "2026-11-01T23:59:59.000Z" };
    seed({ ...base, slug: "g-logo", name: "G", website_url: "https://organiser.test/graphic-art" });
    seed({ ...base, slug: "o-old-logo", name: "O", website_url: null, image_url: "https://img.test/logo.png" });
    seed({ ...base, slug: "p-old-photo", name: "P", website_url: null, image_url: "https://img.test/photo.jpg" });
    seed({ ...base, slug: "q-done", name: "Q", website_url: null, image_url: "https://img.test/photo.jpg#photo" });
    const result = await fillBannerArt(getServiceClient()!, fakeFetch as typeof fetch);
    const img = (slug: string) => table.find((r) => r.slug === slug)?.image_url;
    assert.equal(img("g-logo"), "https://img.test/logo.png#graphic");
    assert.equal(img("o-old-logo"), "https://img.test/logo.png#graphic");
    assert.equal(img("p-old-photo"), "https://img.test/photo.jpg#photo");
    assert.equal(img("q-done"), "https://img.test/photo.jpg#photo");
    assert.equal(result.filled, 1);
    assert.equal(result.classified, 2);
    assert.equal(artKind("https://x.test/a.png#graphic"), "graphic");
    assert.equal(artKind("https://x.test/a.png"), null);
    assert.equal(withArtKind("https://x.test/a.png#photo", "graphic"), "https://x.test/a.png#graphic");
    assert.equal(pngHasAlpha(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])), false, "colour type 2 = no transparency");
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

  // ───────── expiry in the event's own time zone ─────────
  await test("zones: the event's place names its time zone (state code, state name, province, city-with-state, country)", () => {
    assert.equal(eventTimeZone({ city: "Los Angeles", state_region: "CA", country: "US" }), "America/Los_Angeles");
    assert.equal(eventTimeZone({ city: "Miami", state_region: "Florida", country: "US" }), "America/New_York");
    assert.equal(eventTimeZone({ city: "Anaheim, CA", state_region: null, country: "US" }), "America/Los_Angeles");
    assert.equal(eventTimeZone({ city: "Toronto", state_region: "ON", country: "CA" }), "America/Toronto");
    assert.equal(eventTimeZone({ city: "London", state_region: null, country: "GB" }), "Europe/London");
    assert.equal(eventTimeZone({ city: "Honolulu", state_region: "HI", country: "US" }), "Pacific/Honolulu");
    assert.equal(eventTimeZone({ city: null, state_region: null, country: "Not listed" }), null);
    assert.equal(eventTimeZone({ city: null, state_region: null, country: "US" }), null);
  });
  await test("zones: an LA event stays on through its final local evening and ends at local midnight, wherever the viewer is; others likewise", () => {
    const la = { ...span("2026-10-30", "2026-11-01"), city: "Los Angeles", state_region: "CA", country: "US" };
    const fl = { ...span("2026-10-30", "2026-11-01"), city: "Miami", state_region: "FL", country: "US" };
    const hi = { ...span("2026-10-30", "2026-11-01"), city: "Honolulu", state_region: "HI", country: "US" };
    const uk = { ...span("2026-10-30", "2026-11-01"), city: "London", state_region: null, country: "GB" };
    const at = (iso: string) => new Date(iso);
    // 2026-11-01 is the day US clocks go back, so Los Angeles is on PST (UTC-8) by the evening
    assert.equal(eventPhase(la, at("2026-11-02T04:00:00Z")), "live", "8 pm in Los Angeles on the last day");
    assert.equal(eventPhase(la, at("2026-11-02T07:59:00Z")), "live", "11:59 pm in Los Angeles");
    assert.equal(eventPhase(la, at("2026-11-02T08:01:00Z")), "past", "just after local midnight");
    assert.equal(eventPhase(fl, at("2026-11-02T04:30:00Z")), "live", "11:30 pm in Miami (EST)");
    assert.equal(eventPhase(fl, at("2026-11-02T05:30:00Z")), "past", "00:30 in Miami");
    assert.equal(eventPhase(hi, at("2026-11-02T09:30:00Z")), "live", "11:30 pm in Honolulu");
    assert.equal(eventPhase(hi, at("2026-11-02T10:30:00Z")), "past");
    assert.equal(eventPhase(uk, at("2026-11-01T23:30:00Z")), "live", "11:30 pm in London (GMT)");
    assert.equal(eventPhase(uk, at("2026-11-02T00:30:00Z")), "past", "00:30 in London: already over, though still the same day in Los Angeles");
    // it starts at local midnight too, not the evening before
    assert.equal(eventPhase(la, at("2026-10-30T06:00:00Z")), "upcoming", "11 pm on Oct 29 in Los Angeles (PDT)");
    assert.equal(eventPhase(la, at("2026-10-30T07:30:00Z")), "live", "00:30 on Oct 30 in Los Angeles");
    assert.equal(eventBounds(la).end.toISOString(), "2026-11-02T08:00:00.000Z");
    assert.equal(eventBounds(la).start.toISOString(), "2026-10-30T07:00:00.000Z");
    assert.equal(daysUntilStart(la, at("2026-10-29T20:00:00-07:00")), 1);
    assert.equal(eventCountdown(la, at("2026-11-02T04:00:00Z")), "Happening now!");
    assert.equal(earliestStoredEnd(at("2026-11-02T04:00:00Z")), "2026-11-01T16:00:00.000Z");
    // the database now lets it through until 12 hours after its stored end; the stored end of the LA event is 2026-11-01T23:59:59Z
    assert.ok(RealDate.parse(la.ends_at) >= RealDate.parse(earliestStoredEnd(at("2026-11-02T04:00:00Z"))));
  });
  await test("zones: the banner keeps an LA event in its ten during its final local evening", () => {
    const la = { id: "la", slug: "la", is_featured: true, ...span("2026-10-30", "2026-11-01"), city: "Los Angeles", state_region: "CA", country: "US" };
    const noZone = { id: "x", slug: "x", is_featured: false, ...span("2026-11-01", "2026-11-01") };
    const picked = pickBannerEvents([la], [la, noZone], new RealDate("2026-11-02T04:00:00Z"));
    assert.ok(picked.some((e) => e.id === "la"), "still shown at 8 pm in Los Angeles, though its stored end has passed");
    const later = pickBannerEvents([la], [la], new RealDate("2026-11-02T08:30:00Z"));
    assert.equal(later.length, 0, "gone after local midnight");
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
