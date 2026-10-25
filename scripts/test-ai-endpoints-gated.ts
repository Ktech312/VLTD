// Regression test: EVERY route that can spend AI credit is gated, and an anonymous call makes no outbound request at all.
//   npm run test:ai-gate
//
// Part 1 (static): every route.ts under src/app/api that reaches the AI provider (directly or through the shared helpers) is listed, and each must carry a gate that comes BEFORE its
// first use of the provider: the user gate (guardedScan: verified sign-in, profile membership, allowance), the cron secret, or the verified admin check. A NEW route that spends AI
// credit makes this test fail until it is added here on purpose. Library files that talk to the provider directly are listed too, so a new back door is noticed.
// Part 2 (behaviour): each of those routes is called with no credentials, with a pretend internet that throws on ANY outbound request. Each must refuse, and none may reach out.

process.env.ANTHROPIC_API_KEY = "ai-test";
process.env.SERPAPI_KEY = "serp-test";
process.env.TICKETMASTER_API_KEY = "tm-test";
process.env.CRON_SECRET = "test-secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-key";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

const outbound: string[] = [];
(globalThis as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL) => {
  outbound.push(String(typeof input === "string" ? input : input instanceof URL ? input.href : input.url));
  throw new Error("an outbound request was made");
}) as typeof fetch;

const results: Array<{ name: string; ok: boolean; err?: string }> = [];
async function test(name: string, fn: () => Promise<void> | void) {
  outbound.length = 0;
  try { await fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, err: String((e as Error)?.stack ?? e).split("\n").slice(0, 4).join(" | ") }); }
}

const norm = (p: string) => p.replace(/\\/g, "/");
const walk = (dir: string, match: (f: string) => boolean, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, match, out);
    else if (match(full)) out.push(norm(full));
  }
  return out;
};

// What reaches the AI provider. Anything that matches one of these is "an AI route".
const AI_MARKERS = [/api\.anthropic\.com/, /\bcallVision\(/, /\bfilterRelevantCandidates\(/, /\bpingAi\(/, /\bguardedScan\(/];
// Routes that spend AI credit today, with the kind of gate each must have.
const EXPECTED: Record<string, "user" | "cron"> = {
  "src/app/api/ai/analyze-item/route.ts": "user",
  "src/app/api/ai/analyze-coa/route.ts": "user",
  "src/app/api/cron/refresh-events/route.ts": "cron",
  "src/app/api/cron/refresh-major-events/route.ts": "cron",
  "src/app/api/cron/refresh-events-monthly/route.ts": "cron",
};
// Library files that may talk to the provider directly.
const EXPECTED_LIBS = ["src/lib/events/eventSources.ts", "src/lib/server/scanGuard.ts"];

async function main() {
  await test("static: the routes that can spend AI credit are exactly the five that are gated (a new one must be added here on purpose)", () => {
    const routes = walk("src/app/api", (f) => /route\.tsx?$/.test(f));
    const aiRoutes = routes.filter((f) => AI_MARKERS.some((re) => re.test(fs.readFileSync(f, "utf8")))).sort();
    assert.deepEqual(aiRoutes, Object.keys(EXPECTED).sort());
  });
  await test("static: only the shared helpers talk to the AI provider from the library (no new back door)", () => {
    const libs = walk("src", (f) => /\.(ts|tsx)$/.test(f) && !norm(f).startsWith("src/app/api/")).filter((f) => /api\.anthropic\.com/.test(fs.readFileSync(f, "utf8"))).sort();
    assert.deepEqual(libs, EXPECTED_LIBS);
  });
  await test("static: every AI route's gate comes BEFORE its first use of the provider", () => {
    for (const [file, kind] of Object.entries(EXPECTED)) {
      const src = fs.readFileSync(file, "utf8");
      const firstUse = Math.min(...AI_MARKERS.map((re) => { const m = src.search(re); return m < 0 ? Infinity : m; }).filter((n) => n !== Infinity));
      if (kind === "user") {
        // the whole handler runs inside guardedScan, so the provider call can only happen inside the gate
        assert.match(src, /return guardedScan\(req, "(item|coa)"/, file);
      } else {
        const secret = src.indexOf("process.env.CRON_SECRET");
        const bearer = src.indexOf("authorization");
        assert.ok(secret >= 0 && bearer >= 0, `${file} must check the cron secret`);
        // the first provider use that is not an import line
        const body = src.replace(/^import .*$/gm, (l) => " ".repeat(l.length));
        const use = Math.min(...AI_MARKERS.map((re) => { const m = body.search(re); return m < 0 ? Infinity : m; }));
        const handlerStart = body.indexOf("export async function GET");
        assert.ok(handlerStart >= 0, file);
        const inHandler = body.slice(handlerStart);
        const secretInHandler = inHandler.indexOf("process.env.CRON_SECRET");
        const unauthorised = inHandler.indexOf('"unauthorized"');
        assert.ok(secretInHandler >= 0 && unauthorised > secretInHandler, `${file}: the secret is checked and refused inside the handler`);
        const firstProviderCallInHandler = Math.min(...[/\bfilterRelevantCandidates\(/, /\bpingAi\(/, /\bfetchSerpCandidates\(/, /\bfetchSerpAccount\(/, /api\.anthropic\.com/].map((re) => { const m = inHandler.search(re); return m < 0 ? Infinity : m; }));
        assert.ok(unauthorised < firstProviderCallInHandler, `${file}: the refusal comes before any provider call`);
        void firstUse; void use; void secret; void bearer;
      }
    }
  });
  await test("static: the cron routes also refuse unless switched on, and the scan routes need a verified sign-in, a profile and a request id before the provider", () => {
    for (const f of ["src/app/api/cron/refresh-events/route.ts", "src/app/api/cron/refresh-major-events/route.ts"]) assert.match(fs.readFileSync(f, "utf8"), /eventsRefreshEnabled\(\)/, f);
    assert.match(fs.readFileSync("src/app/api/cron/refresh-events-monthly/route.ts", "utf8"), /checkApproval\(/);
    const guard = fs.readFileSync("src/lib/server/scanGuard.ts", "utf8");
    assert.ok(guard.indexOf("auth.getUser(token)") < guard.indexOf("await reserve(") && guard.indexOf("await reserve(") < guard.indexOf("await run("), "sign-in, then the reservation, then the provider call");
  });

  // ───────── behaviour: nobody gets in without credentials, and nothing reaches out ─────────
  const handlers: Array<[string, () => Promise<(req: NextRequest) => Promise<Response>>, "POST" | "GET"]> = [
    ["analyze-item", async () => (await import("../src/app/api/ai/analyze-item/route")).POST, "POST"],
    ["analyze-coa", async () => (await import("../src/app/api/ai/analyze-coa/route")).POST, "POST"],
    ["refresh-events", async () => (await import("../src/app/api/cron/refresh-events/route")).GET, "GET"],
    ["refresh-major-events", async () => (await import("../src/app/api/cron/refresh-major-events/route")).GET, "GET"],
    ["refresh-events-monthly", async () => (await import("../src/app/api/cron/refresh-events-monthly/route")).GET, "GET"],
  ];
  for (const [name, load, method] of handlers) {
    await test(`${name}: called with no credentials it refuses and makes NO outbound request`, async () => {
      const handler = await load();
      const form = new FormData();
      form.append("image", new File([new Uint8Array(600)], "a.jpg", { type: "image/jpeg" }));
      form.append("profileId", "11111111-1111-1111-1111-111111111111");
      form.append("requestId", "aaaaaaaa-0000-4000-8000-000000000001");
      const req = method === "POST" ? new NextRequest(`http://localhost/api/ai/${name}`, { method: "POST", body: form }) : new NextRequest(`http://localhost/api/cron/${name}`);
      const res = await handler(req);
      assert.equal(res.status, 401, `${name} answered ${res.status}`);
      assert.deepEqual(outbound, [], "nothing went out");
    });
    await test(`${name}: a wrong credential is refused the same way, with nothing sent out`, async () => {
      const handler = await load();
      const form = new FormData();
      form.append("image", new File([new Uint8Array(600)], "a.jpg", { type: "image/jpeg" }));
      form.append("profileId", "11111111-1111-1111-1111-111111111111");
      form.append("requestId", "aaaaaaaa-0000-4000-8000-000000000002");
      const headers = { authorization: "Bearer not-the-secret" };
      const req = method === "POST" ? new NextRequest(`http://localhost/api/ai/${name}`, { method: "POST", body: form, headers }) : new NextRequest(`http://localhost/api/cron/${name}`, { headers });
      const res = await handler(req);
      // a wrong cron secret is 401; a wrong user token needs Supabase to say so, which in this pretend world cannot be reached, so it must fail CLOSED (503), never open
      assert.ok(res.status === 401 || res.status === 503, `${name} answered ${res.status}`);
      assert.ok(!outbound.some((u) => /anthropic|serpapi|ticketmaster/.test(u)), "no provider was contacted");
    });
  }

  const failed = results.filter((r) => !r.ok);
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.err ? `\n      ${r.err}` : ""}`);
  console.log(`\n${results.length - failed.length} of ${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
void main();
