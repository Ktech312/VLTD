// The REAL scan routes (analyze-item, analyze-coa) run against the REAL production database and the REAL Supabase sign-in, with ONE thing replaced: the AI provider.
// Every request to api.anthropic.com is answered by a local stand-in that counts the calls; any other host that is not this project's Supabase is refused. NO paid call is possible.
// The owner check is pointed at the QA account for this run only (a local path override in rb78-tsconfig.json, outside the app), because the real rule would refuse a QA account before
// anything interesting happened: this run proves the FULL-mode reservation, duplicate and refund behaviour of the routes as deployed in code. Owner-only enforcement on the deployed
// site is proven separately by RB76 (non-owner accounts, production URL).
//   AUDIT_MANIFEST=<manifest> npx tsx --tsconfig docs/audit-2026-10-18/repair-batch-19/scripts/rb78-tsconfig.json docs/audit-2026-10-18/repair-batch-19/scripts/rb78-routes-full-mode.ts <label>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url ?? __filename);
const env = require("../../qa/env.cjs") as Record<string, string>;
const manifest = JSON.parse(fs.readFileSync(String(process.env.AUDIT_MANIFEST), "utf8"));
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) process.env[k] = env[k];
process.env.ANTHROPIC_API_KEY = "stand-in-not-a-real-key";
process.env.RB78_QA_EMAIL = manifest.email;

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SB_HOST = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host;
const realFetch = globalThis.fetch;
let provider = { calls: 0, mode: "ok" as "ok" | "fail", hold: null as Promise<void> | null };
const foreign: string[] = [];
(globalThis as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.host === SB_HOST) return realFetch(input as RequestInfo, init);
  if (url.host === "api.anthropic.com") {
    provider.calls += 1;
    if (provider.hold) await provider.hold;
    if (provider.mode === "fail") return new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "stand-in refusal" } }), { status: 400, headers: { "content-type": "application/json" } });
    const text = JSON.stringify({ detectedTitle: "Stand-in Title", confidence: 0.8, certNumber: "1", grade: "9", authenticator: "PSA", itemDescription: "x", signerName: "", authDate: "", notes: "", universe: "Pop Culture", category: "Comics", subcategory: "" });
    return new Response(JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  }
  foreign.push(url.href);
  throw new Error(`blocked outbound request to ${url.host}`);
}) as typeof fetch;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const P: string = manifest.personalId;
const uuid = () => crypto.randomUUID();
const pad = (b: number[], n = 600) => { while (b.length < n) b.push(0); return new Uint8Array(b); };
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, 2, 88, 3, 32, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);

const results: Array<{ ok: boolean; control: string; actual: string }> = [];
const ck = (ok: boolean, control: string, actual: unknown) => results.push({ ok, control, actual: String(JSON.stringify(actual)).slice(0, 300) });
const profile = async () => (await admin.from("profiles").select("bulk_scans_used,bulk_scan_limit_override").eq("id", P).single()).data as { bulk_scans_used: number; bulk_scan_limit_override: number | null };
const ledger = async (id: string) => (await admin.from("ai_scan_requests").select("state").eq("profile_id", P).eq("request_id", id).maybeSingle()).data as { state: string } | null;
const setAllowance = (limit: number, used = 0) => admin.from("profiles").update({ bulk_scan_limit_override: limit, bulk_scans_used: used, bulk_scans_cycle_start: null }).eq("id", P);

async function main() {
  const label = process.argv[2] ?? "run";
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const si = await anon.auth.signInWithPassword({ email: manifest.email, password: manifest.password });
  if (si.error) throw si.error;
  const token = si.data.session!.access_token;
  const item = (await import("../../../../src/app/api/ai/analyze-item/route")).POST;
  const coa = (await import("../../../../src/app/api/ai/analyze-coa/route")).POST;
  const send = async (handler: (r: NextRequest) => Promise<Response>, route: string, requestId: string, tok: string | null = token) => {
    const form = new FormData();
    form.append("image", new File([JPEG], "photo.jpg", { type: "image/jpeg" }));
    form.append("profileId", P);
    form.append("requestId", requestId);
    const res = await handler(new NextRequest(`http://localhost/api/ai/${route}`, { method: "POST", body: form, headers: tok ? { authorization: `Bearer ${tok}` } : {} }));
    return { status: res.status, mode: res.headers.get("x-scan-guard"), body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  };
  const reset = () => { provider = { calls: 0, mode: "ok", hold: null }; };
  const usageBefore = await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P);

  for (const [route, handler, name] of [["analyze-item", item, "item scan"], ["analyze-coa", coa, "certificate scan"]] as const) {
    // full mode + a normal scan
    await setAllowance(5, 0); reset();
    let id = uuid();
    let r = await send(handler, route, id);
    ck(r.status === 200 && r.mode === "full", `${name}: the route runs in FULL mode (x-scan-guard: full) and the scan succeeds`, [r.status, r.mode]);
    ck(provider.calls === 1 && (await profile()).bulk_scans_used === 1 && (await ledger(id))?.state === "done", `${name}: one stand-in provider call, one scan spent, the reservation is 'done'`, [provider.calls, (await profile()).bulk_scans_used, (await ledger(id))?.state]);
    // duplicate
    const dup = await send(handler, route, id);
    ck(dup.status === 409 && dup.body.code === "duplicate" && provider.calls === 1 && (await profile()).bulk_scans_used === 1, `${name}: the same request id again is refused (409 duplicate): no second provider call, nothing more spent`, [dup.status, dup.body.code, provider.calls]);
    // same id twice at the same instant
    await setAllowance(5, 0); reset(); id = uuid();
    const pair = await Promise.all([send(handler, route, id), send(handler, route, id), send(handler, route, id)]);
    ck(provider.calls === 1 && pair.filter((p) => p.status === 200).length === 1 && pair.filter((p) => p.status === 409).length === 2 && (await profile()).bulk_scans_used === 1, `${name}: three identical requests at the same instant: ONE provider call, one 200, two 409, 1 spent`, [provider.calls, pair.map((p) => p.status)]);
    // provider failure -> refund
    await setAllowance(5, 0); reset(); provider.mode = "fail"; id = uuid();
    r = await send(handler, route, id);
    ck(r.status >= 400 && r.status !== 429 && r.mode === "full", `${name}: the provider fails: the person gets an error (not charged)`, [r.status, r.mode]);
    ck((await profile()).bulk_scans_used === 0 && (await ledger(id))?.state === "released", `${name}: the scan was GIVEN BACK by the server (0 spent, reservation 'released')`, [(await profile()).bulk_scans_used, (await ledger(id))?.state]);
    provider.mode = "ok";
    r = await send(handler, route, id);
    ck(r.status === 200 && (await profile()).bulk_scans_used === 1, `${name}: the retry with the same request id works and is charged once`, [r.status, (await profile()).bulk_scans_used]);
    // last scans cannot be spent twice
    await setAllowance(3, 0); reset();
    const burst = await Promise.all(Array.from({ length: 8 }, () => send(handler, route, uuid())));
    ck(provider.calls === 3 && burst.filter((b) => b.status === 200).length === 3 && burst.filter((b) => b.status === 429).length === 5 && (await profile()).bulk_scans_used === 3, `${name}: 8 different requests at once against an allowance of 3: exactly 3 provider calls, 3 succeed, 5 refused (429), 3 spent`, [provider.calls, burst.map((b) => b.status).sort()]);
    // zero allowance: refused with mode full, no provider
    await setAllowance(0, 0); reset();
    r = await send(handler, route, uuid());
    ck(r.status === 429 && r.mode === "full" && provider.calls === 0, `${name}: an allowance of 0 is refused (429, full mode) with no provider call`, [r.status, r.mode, provider.calls]);
    // in-flight: a member cannot refund while the provider call is held
    await setAllowance(5, 0); reset(); id = uuid();
    let release!: () => void; provider.hold = new Promise<void>((res) => { release = res; });
    const inflight = send(handler, route, id);
    for (let i = 0; i < 40 && provider.calls === 0; i++) await new Promise((res) => setTimeout(res, 100));
    const memberClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const refundTry = await memberClient.rpc("complete_ai_scan", { p_profile: P, p_request: id, p_succeeded: false });
    const mid = await profile(); const midLed = await ledger(id);
    ck(!!refundTry.error && mid.bulk_scans_used === 1 && midLed?.state === "reserved", `${name}: while the provider call is in flight the member's direct refund is refused; the scan stays reserved (1 spent)`, [refundTry.error?.message?.slice(0, 40), mid.bulk_scans_used, midLed?.state]);
    release();
    const done = await inflight;
    ck(done.status === 200 && (await ledger(id))?.state === "done", `${name}: the server then completes it`, [done.status, (await ledger(id))?.state]);
  }
  // nothing but the stand-in provider and this project's Supabase was ever contacted
  ck(foreign.length === 0, "no request went anywhere except this project's Supabase and the local provider stand-in", foreign);
  const usageAfter = await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P);
  const removed = await admin.from("ai_usage_log").delete().eq("profile_id", P);
  fs.mkdirSync(path.join(__dirname, "..", "evidence"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "..", "evidence", `rb78-${label}.json`), JSON.stringify({ label, usageLogRowsBefore: usageBefore.count, usageLogRowsAfter: usageAfter.count, usageLogRowsRemoved: removed.error ? `error ${removed.error.message}` : "removed", cases: results }, null, 1));
  console.log(results.map((c) => `${c.ok ? "PASS" : "FAIL"} ${c.control}${c.ok ? "" : "  <= " + c.actual}`).join("\n"));
  console.log(`${results.filter((c) => c.ok).length} of ${results.length} passed; usage-log rows by the QA profile: before ${usageBefore.count}, after ${usageAfter.count}, ${removed.error ? "delete error" : "deleted"}`);
}
main()
  .catch((e) => { console.error("RUNNER ERROR", e); })
  .finally(async () => {
    try { await admin.from("ai_scan_requests").delete().eq("profile_id", P); await admin.from("profiles").update({ bulk_scan_limit_override: null, bulk_scans_used: 0, bulk_scans_cycle_start: null }).eq("id", P); await admin.from("ai_usage_log").delete().eq("profile_id", P); } catch { /* removed with the account */ }
    process.exit(0);
  });
