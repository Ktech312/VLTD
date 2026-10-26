// Tests for the AI scan gate (api/ai/analyze-item, api/ai/analyze-coa, lib/server/scanGuard.ts, lib/ai/scanRequest.ts).
//   npm run test:ai-scan
//
// The REAL route handlers run here against a pretend internet: global fetch answers Supabase Auth, the allowance functions (reserve_ai_scan, complete_ai_scan and the older
// consume_bulk_scan) and the AI provider. The pretend database mirrors the real permissions, which are proven against a REAL Postgres server, with separate connections, by
// repair-batch-19/scripts/test-sql10-real-postgres.cjs: reserve and complete answer ONLY the server (service key), a member's own token is refused, and a member's own call to
// the older consume_bulk_scan is told 'granted' while the billing-column trigger leaves the counter unchanged (so a route that used the member's token would never move the allowance). Nothing leaves the machine, no key is used, no credit is spent. Every refusal case asserts the pretend provider was called ZERO times.

process.env.ANTHROPIC_API_KEY = "ai-test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-key";

import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { inspectImage, MAX_IMAGE_BYTES, __resetBasicDedupe } from "../src/lib/server/scanGuard";

const ALICE = "00000000-0000-0000-0000-0000000000a1";
const BOB = "00000000-0000-0000-0000-0000000000b2";
const PA = "11111111-1111-1111-1111-111111111111";
const PB = "22222222-2222-2222-2222-222222222222";
const R = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CAROL = "00000000-0000-0000-0000-0000000000c3";
const DAVE = "00000000-0000-0000-0000-0000000000d4";
const PC = "33333333-3333-3333-3333-333333333333";
const PD = "44444444-4444-4444-4444-444444444444";
const TOKENS: Record<string, string> = { "tok-alice": ALICE, "tok-bob": BOB, "tok-carol": CAROL, "tok-dave": DAVE };
// Alice is the owner (the one account with AI access). Bob is an ordinary signed-in account. Carol's address only LOOKS like the owner's. Dave has the owner's address but it was never confirmed.
const IDENTITY: Record<string, { email: string; confirmed: boolean }> = {
  [ALICE]: { email: "eck1679@gmail.com", confirmed: true },
  [BOB]: { email: "bob@example.com", confirmed: true },
  [CAROL]: { email: "eck1679@gmail.com.example.net", confirmed: true },
  [DAVE]: { email: "eck1679@gmail.com", confirmed: false },
};

// ───────────────────────── test images built from bytes ─────────────────────────
const pad = (b: number[], n = 400) => { while (b.length < n) b.push(0); return new Uint8Array(b); };
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const jpeg = (w: number, h: number) => pad([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const png = (w: number, h: number) => pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...u32(13), ...ascii("IHDR"), ...u32(w), ...u32(h), 8, 6, 0, 0, 0]);
const webp = (w: number, h: number) => pad([...ascii("RIFF"), 0, 1, 0, 0, ...ascii("WEBP"), ...ascii("VP8X"), 10, 0, 0, 0, 0, 0, 0, 0, (w - 1) & 255, ((w - 1) >> 8) & 255, ((w - 1) >> 16) & 255, (h - 1) & 255, ((h - 1) >> 8) & 255, ((h - 1) >> 16) & 255]);
const gif = (w: number, h: number) => pad([...ascii("GIF89a"), w & 255, w >> 8, h & 255, h >> 8, 0, 0, 0]);
const text = () => new Uint8Array(ascii("this is not a picture ".repeat(30)));

// ───────────────────────── the pretend world ─────────────────────────
type Profile = { limit: number; used: number; resets: string };
type World = {
  mode: "full" | "basic";
  profiles: Map<string, Profile>;
  members: Set<string>; // `${user}:${profile}`
  ledger: Map<string, "reserved" | "done" | "released">;
  ai: "ok" | "fail" | "busy" | "network" | "badjson";
  authDown: boolean;
  reserveBroken: boolean;
  calls: { anthropic: number; getUser: number; reserve: number; complete: number; consume: number; status: number; members: number; usageLog: number; memberTokenAllowanceCalls: number; deniedToMembers: number };
  hold: Promise<void> | null; // when set, the provider answers only after this resolves (a call 'in flight')
  anthropicBodies: Array<Record<string, unknown>>;
};
let world: World;
function freshWorld(): World {
  return {
    mode: "full",
    profiles: new Map([[PA, { limit: 3, used: 0, resets: "2026-11-24" }], [PB, { limit: 3, used: 0, resets: "2026-11-24" }], [PC, { limit: 3, used: 0, resets: "2026-11-24" }], [PD, { limit: 3, used: 0, resets: "2026-11-24" }]]),
    members: new Set([`${ALICE}:${PA}`, `${BOB}:${PB}`, `${CAROL}:${PC}`, `${DAVE}:${PD}`]),
    ledger: new Map(),
    ai: "ok",
    authDown: false,
    reserveBroken: false,
    calls: { anthropic: 0, getUser: 0, reserve: 0, complete: 0, consume: 0, status: 0, members: 0, usageLog: 0, memberTokenAllowanceCalls: 0, deniedToMembers: 0 },
    hold: null,
    anthropicBodies: [],
  };
}
const json = (status: number, body: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const rpcError = (message: string, code = "P0001") => json(400, { code, message, details: null, hint: null });

async function fakeFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const headers = new Headers(init.headers);
  if (url.host === "fake.supabase.co" && url.pathname === "/auth/v1/user") {
    world.calls.getUser += 1;
    if (world.authDown) throw new TypeError("fetch failed");
    const token = (headers.get("authorization") ?? "").replace(/^Bearer /, "");
    const uid = TOKENS[token];
    return uid ? json(200, { id: uid, aud: "authenticated", email: IDENTITY[uid].email, ...(IDENTITY[uid].confirmed ? { email_confirmed_at: "2026-01-01T00:00:00Z" } : {}) }) : json(401, { msg: "invalid JWT", code: 401 });
  }
  const callerOf = () => {
    const bearer = (headers.get("authorization") ?? "").replace(/^Bearer /, "");
    return bearer === "fake-service-key" ? { role: "service" as const, user: null } : TOKENS[bearer] ? { role: "member" as const, user: TOKENS[bearer] } : { role: "anon" as const, user: null };
  };
  if (url.host === "fake.supabase.co" && url.pathname === "/rest/v1/profile_members") {
    world.calls.members += 1;
    if (callerOf().role !== "service") { world.calls.deniedToMembers += 1; return json(401, { code: "42501", message: "permission denied for table profile_members" }); }
    const profile = (url.searchParams.get("profile_id") ?? "").replace(/^eq\./, "");
    const user = (url.searchParams.get("user_id") ?? "").replace(/^eq\./, "");
    return json(200, world.members.has(`${user}:${profile}`) ? [{ profile_id: profile }] : []);
  }
  if (url.host === "fake.supabase.co" && url.pathname.startsWith("/rest/v1/rpc/")) {
    const fn = url.pathname.split("/").pop()!;
    const caller = callerOf();
    const body = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
    const profile = world.profiles.get(String(body.p_profile));
    const denied = (what: string) => { world.calls.deniedToMembers += 1; return json(403, { code: "42501", message: `permission denied for function ${what}` }); };
    const numbers = (extra: Record<string, unknown>) => ({ scan_limit: profile!.limit, used: profile!.used, remaining: Math.max(profile!.limit - profile!.used, 0), ...extra });
    if (fn === "reserve_ai_scan") {
      world.calls.reserve += 1;
      if (world.mode === "basic") return json(404, { code: "PGRST202", message: "Could not find the function public.reserve_ai_scan(p_kind, p_profile, p_request, p_user) in the schema cache" });
      if (caller.role !== "service") return denied("reserve_ai_scan");
      if (world.reserveBroken) return json(500, { code: "XX000", message: "internal error" });
      const user = String(body.p_user ?? "");
      if (!user) return rpcError("a verified user is required");
      if (!(body.p_profile === user || world.members.has(`${user}:${body.p_profile}`))) return rpcError("not authorized to access this quota");
      if (!profile) return rpcError("profile not found");
      const key = `${body.p_profile}:${body.p_request}`;
      const state = world.ledger.get(key);
      const row = (outcome: string) => json(200, [{ outcome, ...numbers({}), cycle_end: profile.resets }]);
      if (state === "reserved" || state === "done") return row("duplicate");
      if (profile.used >= profile.limit) return row("limit");
      profile.used += 1;
      world.ledger.set(key, "reserved");
      return row("reserved");
    }
    if (fn === "complete_ai_scan") {
      world.calls.complete += 1;
      if (caller.role !== "service") return denied("complete_ai_scan"); // a member can neither complete nor refund
      if (!profile) return rpcError("profile not found");
      const key = `${body.p_profile}:${body.p_request}`;
      const state = world.ledger.get(key);
      let outcome = "unknown";
      if (state === "reserved") {
        if (body.p_succeeded) { world.ledger.set(key, "done"); outcome = "done"; }
        else { profile.used = Math.max(profile.used - 1, 0); world.ledger.set(key, "released"); outcome = "released"; }
      } else if (state) outcome = state;
      return json(200, [{ outcome, ...numbers({}) }]);
    }
    if (fn === "bulk_scan_status") {
      world.calls.status += 1;
      if (!profile) return rpcError("profile not found");
      return json(200, [{ ...numbers({}), cycle_start: "2026-10-24", cycle_end: profile.resets }]);
    }
    if (fn === "consume_bulk_scan") {
      world.calls.consume += 1;
      if (!profile) return rpcError("profile not found");
      if (caller.role === "member") {
        // The member's own session: the guard passes for a member, the answer says 'granted', but the billing-column trigger leaves the counter where it was.
        world.calls.memberTokenAllowanceCalls += 1;
        if (!world.members.has(`${caller.user}:${body.p_profile}`)) return rpcError("not authorized to access this quota");
        const granted = profile.used < profile.limit ? 1 : 0;
        return json(200, [{ granted, scan_limit: profile.limit, used: profile.used + granted, remaining: Math.max(profile.limit - profile.used - granted, 0) }]);
      }
      if (caller.role !== "service") return denied("consume_bulk_scan");
      const granted = profile.used < profile.limit ? 1 : 0;
      profile.used += granted;
      return json(200, [{ granted, ...numbers({}) }]);
    }
  }
  if (url.host === "fake.supabase.co" && url.pathname === "/rest/v1/ai_usage_log") {
    world.calls.usageLog += 1;
    return json(201, undefined);
  }
  if (url.host === "api.anthropic.com") {
    world.calls.anthropic += 1;
    world.anthropicBodies.push(JSON.parse(String(init.body ?? "{}")));
    if (world.hold) await world.hold;
    if (world.ai === "network") throw new TypeError("fetch failed");
    if (world.ai === "busy") return json(429, { type: "error", error: { type: "rate_limit_error" } });
    if (world.ai === "fail") return json(400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } });
    const text = world.ai === "badjson" ? "I cannot tell what this is." : JSON.stringify({ detectedTitle: "Night Courier #4", confidence: 0.8, certNumber: "12345678", grade: "PSA 9", authenticator: "PSA", itemDescription: "Night Courier", signerName: "", authDate: "", notes: "", universe: "Pop Culture", category: "Comics", subcategory: "" });
    return json(200, { content: [{ type: "text", text }], usage: { input_tokens: 1500, output_tokens: 90 } });
  }
  throw new Error(`test tried to reach the real internet: ${url.href}`);
}
(globalThis as { fetch: typeof fetch }).fetch = fakeFetch as typeof fetch;

// ───────────────────────── harness ─────────────────────────
const results: Array<{ name: string; ok: boolean; err?: string }> = [];
async function test(name: string, fn: () => Promise<void> | void) {
  world = freshWorld();
  __resetBasicDedupe();
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, err: String((e as Error)?.stack ?? e).split("\n").slice(0, 4).join(" | ") });
  }
}

type Fields = { token?: string | null; profileId?: string | null; requestId?: string | null; bytes?: Uint8Array | null; claimedType?: string; name?: string; hints?: string; sizeOverride?: number };
function scanRequest(path: "/api/ai/analyze-item" | "/api/ai/analyze-coa", f: Fields = {}) {
  const form = new FormData();
  const bytes = f.bytes === undefined ? jpeg(800, 600) : f.bytes;
  if (bytes) {
    const file = new File([bytes as BlobPart], f.name ?? "photo.jpg", { type: f.claimedType ?? "image/jpeg" });
    form.append("image", file);
  }
  const profileId = f.profileId === undefined ? PA : f.profileId;
  if (profileId) form.append("profileId", profileId);
  const requestId = f.requestId === undefined ? R(1) : f.requestId;
  if (requestId) form.append("requestId", requestId);
  if (f.hints) form.append("hints", f.hints);
  const headers: Record<string, string> = {};
  const token = f.token === undefined ? "tok-alice" : f.token;
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(`http://localhost${path}`, { method: "POST", body: form, headers });
}
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function post(handler: (req: NextRequest) => Promise<Response>, req: NextRequest): Promise<{ status: number; body: Json; headers: Headers }> {
  const res = await handler(req);
  return { status: res.status, body: (await res.json()) as Json, headers: res.headers };
}
const noPaidCall = (why = "") => {
  assert.equal(world.calls.anthropic, 0, `the AI provider was called ${why}`);
};
const spentOn = (p: string) => world.profiles.get(p)!.used;
const silent = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const { log, error } = console;
  console.log = () => {}; console.error = () => {};
  try { return await fn(); } finally { console.log = log; console.error = error; }
};

async function main() {
  const { POST: item } = await import("../src/app/api/ai/analyze-item/route");
  const { POST: coa } = await import("../src/app/api/ai/analyze-coa/route");
  const ITEM = "/api/ai/analyze-item" as const;
  const COA = "/api/ai/analyze-coa" as const;
  const routes: Array<[string, typeof item, typeof ITEM | typeof COA]> = [["item scan", item, ITEM], ["certificate scan", coa, COA]];

  // ───────── image checks (pure) ─────────
  await test("images: JPEG, PNG, WebP and GIF are recognised from their bytes, with their size", () => {
    assert.deepEqual(inspectImage(jpeg(800, 600)), { ok: true, mime: "image/jpeg", width: 800, height: 600 });
    assert.deepEqual(inspectImage(png(1024, 768)), { ok: true, mime: "image/png", width: 1024, height: 768 });
    assert.deepEqual(inspectImage(webp(640, 480)), { ok: true, mime: "image/webp", width: 640, height: 480 });
    assert.deepEqual(inspectImage(gif(320, 200)), { ok: true, mime: "image/gif", width: 320, height: 200 });
  });
  await test("images: wrong, empty, huge, absurdly sized and cut-off files are refused with their own reason", () => {
    const bad = (b: Uint8Array) => inspectImage(b) as { ok: false; code: string; status: number };
    assert.equal(bad(text()).code, "unsupported_type");
    assert.equal(bad(new Uint8Array(ascii("<svg xmlns='http://www.w3.org/2000/svg'>".padEnd(400, " ")))).code, "unsupported_type");
    assert.equal(bad(new Uint8Array(ascii("%PDF-1.7".padEnd(400, " ")))).code, "unsupported_type");
    assert.equal(bad(new Uint8Array(50)).code, "invalid_image", "too small");
    assert.equal(bad(new Uint8Array(MAX_IMAGE_BYTES + 1)).code, "too_large");
    assert.equal(bad(new Uint8Array(MAX_IMAGE_BYTES + 1)).status, 413);
    assert.equal(bad(png(20000, 100)).code, "invalid_image", "too many pixels across");
    assert.equal(bad(jpeg(4, 4)).code, "invalid_image", "too small a picture");
    assert.equal(bad(pad([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...ascii("JFIF")])).code, "invalid_image", "a JPEG with no size in it (cut off)");
  });

  for (const [label, handler, path] of routes) {
    // ───────── who may call ─────────
    await test(`${label}: an anonymous caller (no sign-in) is refused and NOTHING is called`, async () => {
      const res = await post(handler, scanRequest(path, { token: null }));
      assert.equal(res.status, 401);
      assert.equal(res.body.code, "signin");
      noPaidCall();
      assert.deepEqual([world.calls.getUser, world.calls.reserve, world.calls.consume, world.calls.complete], [0, 0, 0, 0], "not even the allowance was touched");
      assert.equal(spentOn(PA), 0);
    });
    await test(`${label}: a token that is not valid (expired, forged) is refused before any allowance or paid call`, async () => {
      const res = await post(handler, scanRequest(path, { token: "forged-token" }));
      assert.equal(res.status, 401);
      noPaidCall();
      assert.deepEqual([world.calls.reserve, world.calls.consume], [0, 0]);
    });
    await test(`${label}: if sign-in cannot be verified (Supabase unreachable) nothing is paid for`, async () => {
      world.authDown = true;
      const res = await silent(() => post(handler, scanRequest(path)));
      assert.equal(res.status, 503);
      assert.equal(res.body.code, "unavailable");
      noPaidCall();
      assert.deepEqual([world.calls.reserve, world.calls.consume], [0, 0]);
    });
    await test(`${label}: the owner using someone ELSE'S profile is refused, spends nothing, and the provider is not called`, async () => {
      const res = await post(handler, scanRequest(path, { token: "tok-alice", profileId: PB }));
      assert.equal(res.status, 403);
      assert.equal(res.body.code, "not_member");
      noPaidCall();
      assert.equal(spentOn(PB), 0, "the other profile's allowance is untouched");
      assert.equal(world.ledger.size, 0);
    });
    await test(`${label}: no profile, a made-up profile, or no request id is refused before anything is reserved`, async () => {
      for (const f of [{ profileId: null }, { profileId: "not-a-uuid" }, { requestId: null }, { requestId: "12345" }] as Fields[]) {
        const res = await post(handler, scanRequest(path, f));
        assert.equal(res.status, 400, JSON.stringify(f));
      }
      noPaidCall();
      assert.deepEqual([world.calls.reserve, world.calls.consume], [0, 0]);
    });

    // ───────── the image ─────────
    await test(`${label}: invalid, wrong-type and oversized images are refused BEFORE any reservation or paid call`, async () => {
      const cases: Array<[string, Uint8Array | null, number]> = [
        ["no image at all", null, 400],
        ["not a picture", text(), 415],
        ["an empty-ish file", new Uint8Array(30), 400],
        ["a picture with an impossible size", png(30000, 30000), 400],
        ["too big (over 4 MB)", new Uint8Array(MAX_IMAGE_BYTES + 5), 413],
        ["a JPEG cut off before its size", pad([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...ascii("JFIF")]), 400],
      ];
      for (const [name, bytes, status] of cases) {
        const res = await post(handler, scanRequest(path, { bytes, claimedType: "image/jpeg", requestId: R(50 + status) }));
        assert.equal(res.status, status, name);
        assert.ok(res.body.error, name);
      }
      noPaidCall();
      assert.deepEqual([world.calls.reserve, world.calls.consume], [0, 0], "nothing was reserved either");
      assert.equal(spentOn(PA), 0);
    });
    await test(`${label}: what the file claims to be is not trusted: a text file called photo.jpg is refused, a PNG called photo.txt is sent as a PNG`, async () => {
      const lie = await post(handler, scanRequest(path, { bytes: text(), claimedType: "image/jpeg", name: "photo.jpg", requestId: R(60) }));
      assert.equal(lie.status, 415);
      noPaidCall();
      const real = await post(handler, scanRequest(path, { bytes: png(500, 500), claimedType: "text/plain", name: "photo.txt", requestId: R(61) }));
      assert.equal(real.status, 200);
      const sent = (world.anthropicBodies[0].messages as Array<{ content: Array<{ source?: { media_type: string } }> }>)[0].content[0].source!.media_type;
      assert.equal(sent, "image/png");
    });

    // ───────── the allowance ─────────
    await test(`${label}: a profile that has used its whole allowance is refused with the numbers, and the provider is not called`, async () => {
      world.profiles.get(PA)!.used = 3;
      const res = await post(handler, scanRequest(path));
      assert.equal(res.status, 429);
      assert.equal(res.body.code, "limit");
      assert.equal(res.body.remaining, 0);
      assert.equal(res.body.limit, 3);
      assert.match(String(res.body.error), /used all 3 of your AI scans/);
      assert.match(String(res.body.error), /Nov 24/);
      noPaidCall();
      assert.equal(spentOn(PA), 3, "nothing more was spent");
    });
    await test(`${label}: a good request spends exactly one scan BEFORE the provider is called, and tells the browser the new numbers`, async () => {
      const res = await post(handler, scanRequest(path));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(world.calls.anthropic, 1);
      assert.equal(spentOn(PA), 1);
      assert.deepEqual(res.body.allowance, { remaining: 2, limit: 3, used: 1 });
      assert.equal(res.headers.get("x-scan-guard"), "full");
      assert.equal(world.ledger.get(`${PA}:${R(1)}`), "done");
      assert.equal(world.anthropicBodies[0].max_tokens, path === ITEM ? 1024 : 512);
    });
    await test(`${label}: the same request sent twice, one after the other, spends ONE scan and calls the provider ONCE`, async () => {
      const a = await post(handler, scanRequest(path));
      const b = await post(handler, scanRequest(path));
      assert.equal(a.status, 200);
      assert.equal(b.status, 409);
      assert.equal(b.body.code, "duplicate");
      assert.equal(world.calls.anthropic, 1);
      assert.equal(spentOn(PA), 1);
    });
    await test(`${label}: five copies of one request at the same instant: one is answered, four are duplicates, one scan spent, one provider call`, async () => {
      const all = await Promise.all(Array.from({ length: 5 }, () => post(handler, scanRequest(path))));
      assert.equal(all.filter((r) => r.status === 200).length, 1);
      assert.equal(all.filter((r) => r.status === 409).length, 4);
      assert.equal(world.calls.anthropic, 1);
      assert.equal(spentOn(PA), 1);
    });
    await test(`${label}: six different requests at the same instant with 2 scans left: exactly 2 are answered, 4 refused, never more spent than allowed`, async () => {
      world.profiles.get(PA)!.used = 1;
      const all = await Promise.all(Array.from({ length: 6 }, (_, i) => post(handler, scanRequest(path, { requestId: R(100 + i) }))));
      assert.equal(all.filter((r) => r.status === 200).length, 2);
      assert.equal(all.filter((r) => r.status === 429).length, 4);
      assert.equal(world.calls.anthropic, 2);
      assert.equal(spentOn(PA), 3);
    });

    // ───────── the provider failing gives the scan back ─────────
    await test(`${label}: when the provider refuses (e.g. no credit) the scan is GIVEN BACK and the same request can be tried again`, async () => {
      world.ai = "fail";
      const failed = await silent(() => post(handler, scanRequest(path)));
      assert.equal(failed.status, 502);
      assert.equal(failed.body.code, "provider_failed");
      assert.equal(spentOn(PA), 0, "given back");
      assert.equal(world.ledger.get(`${PA}:${R(1)}`), "released");
      assert.deepEqual(failed.body.allowance, { remaining: 3, limit: 3, used: 0 });
      world.ai = "ok";
      const retry = await post(handler, scanRequest(path));
      assert.equal(retry.status, 200, "a released request may be sent again");
      assert.equal(spentOn(PA), 1);
    });
    await test(`${label}: a busy provider, or one that cannot be reached, also gives the scan back`, async () => {
      world.ai = "busy";
      const busy = await silent(() => post(handler, scanRequest(path, { requestId: R(70) })));
      assert.equal(busy.status, 429);
      assert.equal(busy.body.code, "busy");
      world.ai = "network";
      const down = await silent(() => post(handler, scanRequest(path, { requestId: R(71) })));
      assert.equal(down.status, 503);
      assert.equal(spentOn(PA), 0);
    });
    await test(`${label}: when the provider ANSWERED but the answer could not be read, the scan stays spent (the call was made and charged)`, async () => {
      world.ai = "badjson";
      const res = await silent(() => post(handler, scanRequest(path)));
      assert.equal(res.status, 502);
      assert.equal(res.body.code, "unreadable_answer");
      assert.equal(spentOn(PA), 1);
      assert.equal(world.ledger.get(`${PA}:${R(1)}`), "done");
    });

    // ───────── the gate fails closed ─────────
    await test(`${label}: if the allowance cannot be checked, nothing is paid for`, async () => {
      world.reserveBroken = true;
      const res = await silent(() => post(handler, scanRequest(path)));
      assert.equal(res.status, 503);
      assert.equal(res.body.code, "unavailable");
      noPaidCall();
    });
    await test(`${label}: with no provider key configured nothing else is called at all`, async () => {
      const saved = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      try {
        const res = await post(handler, scanRequest(path));
        assert.equal(res.status, 503);
        assert.deepEqual([world.calls.getUser, world.calls.reserve, world.calls.anthropic], [0, 0, 0]);
      } finally {
        process.env.ANTHROPIC_API_KEY = saved;
      }
    });

    // ───────── before SQL package 10: the existing atomic function is used ─────────
    await test(`${label} (before the SQL is run): sign-in, profile, image and allowance are enforced with the existing atomic consume_bulk_scan, before the provider call`, async () => {
      world.mode = "basic";
      const anon = await post(handler, scanRequest(path, { token: null }));
      const stranger = await post(handler, scanRequest(path, { token: "tok-alice", profileId: PB, requestId: R(80) }));
      const badImage = await post(handler, scanRequest(path, { bytes: text(), requestId: R(81) }));
      assert.deepEqual([anon.status, stranger.status, badImage.status], [401, 403, 415]);
      noPaidCall();
      assert.equal(world.calls.consume, 0, "nobody reached the allowance function: the anonymous request, the stranger (refused at the membership check) and the bad image were all stopped before it");
      assert.equal(world.calls.members, 1, "only the stranger's request got as far as the membership check");
      assert.equal(spentOn(PA), 0);
      world.profiles.get(PA)!.used = 3;
      const over = await post(handler, scanRequest(path, { requestId: R(82) }));
      assert.equal(over.status, 429);
      noPaidCall();
      world.profiles.get(PA)!.used = 0;
      const ok = await post(handler, scanRequest(path, { requestId: R(83) }));
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get("x-scan-guard"), "basic");
      assert.equal(world.calls.anthropic, 1);
      assert.equal(spentOn(PA), 1);
    });
    await test(`${label} (before the SQL is run): a repeated request id reaching the same server instance still spends once`, async () => {
      world.mode = "basic";
      const a = await post(handler, scanRequest(path, { requestId: R(90) }));
      const consumedAfterFirst = world.calls.consume;
      const b = await post(handler, scanRequest(path, { requestId: R(90) }));
      assert.equal(a.status, 200);
      assert.equal(b.status, 409);
      assert.equal(world.calls.consume, consumedAfterFirst + 0, "the repeat never reached the allowance");
      assert.equal(world.calls.anthropic, 1);
      assert.equal(spentOn(PA), 1);
    });
  }

  // ───────── only the trusted server decides success and refunds ─────────
  const direct = async (fn: string, token: string, body: Record<string, unknown>) => {
    const res = await fetch(`https://fake.supabase.co/rest/v1/rpc/${fn}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", apikey: "anon-test" }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as Json };
  };
  for (const [label, handler, path] of routes) {
    await test(`${label}: the route moves the allowance as the SERVER (never with the caller's own token), in both modes, and the counter really moves`, async () => {
      for (const mode of ["full", "basic"] as const) {
        world = freshWorld();
        __resetBasicDedupe();
        world.mode = mode;
        const res = await post(handler, scanRequest(path, { requestId: R(900) }));
        assert.equal(res.status, 200, mode);
        assert.equal(spentOn(PA), 1, `${mode}: the counter moved (a call made with the member's token would have left it at 0)`);
        assert.equal(world.calls.memberTokenAllowanceCalls, 0, `${mode}: no allowance call used the member's token`);
        assert.equal(world.calls.deniedToMembers, 0, `${mode}: nothing was attempted that only the server may do, as the wrong caller`);
      }
    });
    await test(`${label}: DURING the provider call a member cannot refund, complete, re-reserve or reset their reservation, and the server's own completion then works once`, async () => {
      let release!: () => void;
      world.hold = new Promise<void>((r) => { release = r; });
      const inFlight = post(handler, scanRequest(path, { requestId: R(910) }));
      for (let i = 0; i < 100 && world.calls.anthropic === 0; i++) await new Promise((r) => setTimeout(r, 10));
      assert.equal(world.calls.anthropic, 1, "the provider call is in flight");
      assert.equal(spentOn(PA), 1);
      const refund = await direct("complete_ai_scan", "tok-alice", { p_profile: PA, p_request: R(910), p_succeeded: false });
      const done = await direct("complete_ai_scan", "tok-alice", { p_profile: PA, p_request: R(910), p_succeeded: true });
      const again = await direct("reserve_ai_scan", "tok-alice", { p_user: ALICE, p_profile: PA, p_request: R(910), p_kind: "item" });
      assert.deepEqual([refund.status, done.status, again.status], [403, 403, 403], "all refused to the member");
      const consume = await direct("consume_bulk_scan", "tok-alice", { p_profile: PA, p_count: 1 });
      assert.equal(consume.status, 200);
      assert.equal(spentOn(PA), 1, "even the older spend function, called with the member's token, changes nothing");
      assert.equal(world.ledger.get(`${PA}:${R(910)}`), "reserved", "the reservation is untouched while the provider is still answering");
      release();
      const res = await inFlight;
      assert.equal(res.status, 200);
      assert.equal(world.ledger.get(`${PA}:${R(910)}`), "done", "the server completed it");
      assert.equal(spentOn(PA), 1);
      assert.equal(world.calls.complete >= 3, true);
    });
    await test(`${label}: DURING a provider failure a member's own refund attempt is refused, and the server's refund gives the scan back exactly once`, async () => {
      let release!: () => void;
      world.hold = new Promise<void>((r) => { release = r; });
      world.ai = "fail";
      const inFlight = silent(() => post(handler, scanRequest(path, { requestId: R(920) })));
      for (let i = 0; i < 100 && world.calls.anthropic === 0; i++) await new Promise((r) => setTimeout(r, 10));
      const attempt = await direct("complete_ai_scan", "tok-alice", { p_profile: PA, p_request: R(920), p_succeeded: false });
      assert.equal(attempt.status, 403);
      assert.equal(spentOn(PA), 1, "nothing was refunded by the member");
      release();
      const res = await inFlight;
      assert.equal(res.status, 502);
      assert.equal(spentOn(PA), 0, "the server refunded it");
      assert.equal(world.ledger.get(`${PA}:${R(920)}`), "released");
      // the server cannot be talked into refunding twice: a retry that succeeds is charged once, and a repeated failure refunds once
      world.hold = null; world.ai = "ok";
      const retry = await post(handler, scanRequest(path, { requestId: R(920) }));
      assert.equal(retry.status, 200);
      assert.equal(spentOn(PA), 1);
      const dup = await post(handler, scanRequest(path, { requestId: R(920) }));
      assert.equal(dup.status, 409);
      assert.equal(spentOn(PA), 1);
    });
    await test(`${label}: the verified token decides who is asking: a request that CLAIMS to be another user (extra form fields) is still refused for a profile that user's token does not belong to`, async () => {
      const req = scanRequest(path, { token: "tok-alice", profileId: PB, requestId: R(930) });
      const form = await req.formData();
      form.append("userId", BOB); form.append("user", BOB); form.append("p_user", BOB); form.append("user_id", BOB);
      const res = await post(handler, new NextRequest(`http://localhost${path}`, { method: "POST", body: form, headers: { authorization: "Bearer tok-alice" } }));
      assert.equal(res.status, 403);
      assert.equal(res.body.code, "not_member");
      noPaidCall();
      assert.equal(spentOn(PB), 0);
    });
  }

  // ───────── PRODUCT RULE: only the owner's account has AI access ─────────
  for (const mode of ["full", "basic"] as const) {
    for (const [label, handler, path] of [["item scan", item, ITEM], ["certificate scan", coa, COA]] as const) {
      await test(`${label} (${mode} mode): another signed-in account that is a REAL member of its profile, with a positive allowance, is refused and makes ZERO provider calls`, async () => {
        world.mode = mode;
        assert.ok(world.profiles.get(PB)!.limit - world.profiles.get(PB)!.used > 0, "the other account really has allowance left");
        const own = await post(handler, scanRequest(path, { token: "tok-bob", profileId: PB, requestId: R(1000) }));
        assert.equal(own.status, 403);
        assert.equal(own.body.code, "owner_only");
        const theirs = await post(handler, scanRequest(path, { token: "tok-bob", profileId: PA, requestId: R(1001) }));
        assert.equal(theirs.status, 403);
        assert.equal(theirs.body.code, "owner_only");
        noPaidCall();
        assert.deepEqual([world.calls.reserve, world.calls.consume, world.calls.status, world.calls.members, world.calls.complete, world.calls.usageLog], [0, 0, 0, 0, 0, 0], "refused before any membership, allowance or reservation lookup");
        assert.equal(spentOn(PB), 0);
        assert.equal(spentOn(PA), 0);
        assert.equal(world.ledger.size, 0);
      });
    }
  }
  await test("the owner rule is decided from the verified identity only: claims in the request, look-alike addresses and an unconfirmed owner address all fail, with zero provider calls and nothing reserved", async () => {
    for (const mode of ["full", "basic"] as const) {
      world.mode = mode;
      for (const [handler, path] of [[item, ITEM], [coa, COA]] as const) {
        // a non-owner who CLAIMS to be the owner in the form and in headers
        const req = scanRequest(path, { token: "tok-bob", profileId: PB, requestId: R(1100) });
        const form = await req.formData();
        for (const k of ["email", "owner", "isOwner", "role", "userId", "user_id", "p_user"]) form.append(k, k === "email" ? "eck1679@gmail.com" : k === "userId" || k === "user_id" || k === "p_user" ? ALICE : "owner");
        const claimed = await post(handler, new NextRequest(`http://localhost${path}`, { method: "POST", body: form, headers: { authorization: "Bearer tok-bob", "x-owner": "1", "x-user-email": "eck1679@gmail.com" } }));
        assert.equal(claimed.status, 403);
        assert.equal(claimed.body.code, "owner_only");
        // an address that only looks like the owner's, a real member of its profile with allowance
        const lookalike = await post(handler, scanRequest(path, { token: "tok-carol", profileId: PC, requestId: R(1101) }));
        assert.deepEqual([lookalike.status, lookalike.body.code], [403, "owner_only"]);
        // the owner's address, never confirmed
        const unconfirmed = await post(handler, scanRequest(path, { token: "tok-dave", profileId: PD, requestId: R(1102) }));
        assert.deepEqual([unconfirmed.status, unconfirmed.body.code], [403, "owner_only"]);
      }
    }
    noPaidCall();
    assert.deepEqual([world.calls.reserve, world.calls.consume, world.calls.status, world.calls.members, world.calls.complete], [0, 0, 0, 0, 0]);
    assert.equal(world.ledger.size, 0);
    for (const p of [PA, PB, PC, PD]) assert.equal(spentOn(p), 0);
  });
  await test("the owner rule comes right after sign-in: no sign-in is still 'sign in', and a non-owner is refused the same way even for a malformed request (nothing about the request is read)", async () => {
    const anon = await post(item, scanRequest(ITEM, { token: null }));
    assert.equal(anon.status, 401);
    const bad = await post(item, scanRequest(ITEM, { token: "tok-bob", profileId: "not-a-uuid", requestId: null, bytes: text() }));
    assert.deepEqual([bad.status, bad.body.code], [403, "owner_only"]);
    noPaidCall();
  });
  await test("the owner still works end to end in both modes (the rule only narrows access): the provider is called once and the allowance moves once", async () => {
    for (const mode of ["full", "basic"] as const) {
      world = freshWorld(); world.mode = mode; __resetBasicDedupe();
      const res = await post(item, scanRequest(ITEM, { token: "tok-alice", profileId: PA, requestId: R(1200) }));
      assert.equal(res.status, 200, mode);
      assert.equal(world.calls.anthropic, 1);
      assert.equal(spentOn(PA), 1);
    }
  });

  await test("both scan kinds draw from the SAME existing monthly allowance (an item scan and a certificate scan are one scan each)", async () => {
    world.profiles.get(PA)!.used = 1;
    const a = await post(item, scanRequest(ITEM, { requestId: R(300) }));
    const b = await post(coa, scanRequest(COA, { requestId: R(301) }));
    const c = await post(coa, scanRequest(COA, { requestId: R(302) }));
    assert.deepEqual([a.status, b.status, c.status], [200, 200, 429], "1 used, item scan = 2, certificate scan = 3, the next certificate scan is over the allowance");
    assert.equal(spentOn(PA), 3);
    assert.equal(world.calls.anthropic, 2);
  });
  await test("free text sent with a scan is cut to a fixed size, so one request cannot carry an enormous prompt", async () => {
    const res = await post(item, scanRequest(ITEM, { hints: "x".repeat(50_000) }));
    assert.equal(res.status, 200);
    const prompt = ((world.anthropicBodies[0].messages as Array<{ content: Array<{ text?: string }> }>)[0].content[1]).text!;
    assert.ok(prompt.length < 12_000, `prompt length ${prompt.length}`);
    assert.ok(!prompt.includes("x".repeat(1600)), "the hint was cut to 1,500 characters");
  });

  // ───────── the browser side ─────────
  await test("browser: the sign-in token, the profile and a request id are sent; no token means nothing is sent at all", async () => {
    const calls: Array<{ url: string; auth: string | null; hasProfile: boolean; requestId: string | null }> = [];
    const realFetch = globalThis.fetch;
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => PA };
    (globalThis as { window?: unknown }).window = { __vltdSupabaseClient: { auth: { getSession: async () => ({ data: { session: (globalThis as { __tok?: string }).__tok ? { access_token: (globalThis as { __tok?: string }).__tok } : null } }) } }, localStorage: { getItem: () => PA } };
    (globalThis as { fetch: typeof fetch }).fetch = (async (u: RequestInfo | URL, init?: RequestInit) => {
      const form = init?.body as FormData;
      calls.push({ url: String(u), auth: new Headers(init?.headers).get("authorization"), hasProfile: form.get("profileId") === PA, requestId: String(form.get("requestId")) });
      await new Promise((r) => setTimeout(r, 20));
      return json(200, { title: "x", allowance: { remaining: 2, limit: 3, used: 1 } });
    }) as typeof fetch;
    try {
      const { postScan, ScanRefusedError } = await import("../src/lib/ai/scanRequest");
      const photo = () => { const f = new FormData(); f.append("image", new File([jpeg(100, 100) as BlobPart], "a.jpg", { type: "image/jpeg", lastModified: 1 })); return f; };
      const caught = async (fn: () => Promise<unknown>) => { try { await fn(); return null; } catch (e) { return e; } };
      const noToken = await caught(() => postScan(ITEM, photo()));
      assert.ok(noToken instanceof ScanRefusedError && noToken.code === "signin", `got: ${String((noToken as Error)?.stack ?? noToken)}`);
      assert.equal(calls.length, 0, "no token: no request");
      (globalThis as { __tok?: string }).__tok = "tok-alice";
      const first = await postScan<{ title: string }>(ITEM, photo());
      assert.equal(first.data.title, "x");
      assert.deepEqual(first.allowance, { remaining: 2, limit: 3, used: 1 });
      assert.equal(calls[0].auth, "Bearer tok-alice");
      assert.ok(calls[0].hasProfile);
      assert.match(String(calls[0].requestId), /^[0-9a-f-]{36}$/);
      // a double press of the same photo while the first is still on its way is ONE request
      calls.length = 0;
      const [p1, p2, p3] = [postScan(ITEM, photo()), postScan(ITEM, photo()), postScan(ITEM, photo())];
      await Promise.all([p1, p2, p3]);
      assert.equal(calls.length, 1, "three presses, one request");
      // a deliberate second scan afterwards is a new request with a new id
      await postScan(ITEM, photo());
      assert.equal(calls.length, 2);
      assert.notEqual(calls[0].requestId, calls[1].requestId);
      // refusals come back as plain sentences with a code
      (globalThis as { fetch: typeof fetch }).fetch = (async () => json(429, { error: "You've used all 3 of your AI scans for this cycle. Fill this one in by hand.", code: "limit", remaining: 0, limit: 3, used: 3 })) as typeof fetch;
      const refused = await caught(() => postScan(ITEM, photo()));
      assert.ok(refused instanceof ScanRefusedError && refused.code === "limit" && /used all 3/.test(refused.message) && refused.allowance?.remaining === 0, `got: ${String((refused as Error)?.stack ?? refused)}`);
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = realFetch;
      delete (globalThis as { window?: unknown }).window;
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
  await test("no browser code charges a scan any more (the server already did), and every scan goes through the one helper", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(e.name)) {
          const src = fs.readFileSync(full, "utf8");
          const norm = full.replace(/\\/g, "/");
          if (/consumeBulkScans|consume_bulk_scan/.test(src) && !norm.endsWith("src/lib/server/scanGuard.ts") && !norm.endsWith("src/app/admin/scan-limits/page.tsx")) hits.push(norm + " charges a scan");
          if (/fetch\(\s*["'`]\/api\/ai\/analyze/.test(src) && !norm.endsWith("src/lib/ai/scanRequest.ts")) hits.push(norm + " calls an AI route directly");
        }
      }
    };
    walk("src");
    assert.deepEqual(hits, [], hits.join(" | "));
  });

  const failed = results.filter((r) => !r.ok);
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.err ? `\n      ${r.err}` : ""}`);
  console.log(`\n${results.length - failed.length} of ${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

void main();
