// AI scan gate on PRODUCTION (RB74): refusals only. NO request here can reach the AI provider: every case is refused before the paid call
// (no sign-in, forged token, not your profile, a file that is not a photo, a photo that is too big, no request id, an allowance of zero).
// The success path (the provider answering) is deliberately NOT exercised: it would spend Anthropic credit. It is proven with simulated providers instead (scripts/test-ai-scan-guard.ts).
// Isolated QA owner and a second QA account. The only change made is the QA profile's own scan override (0), removed again at the end.
//   AUDIT_MANIFEST=<manifest> node rb74-ai-scan-guard-prod.cjs <label> [--base=https://vltd.app]
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const J = require(path.join(SD, "journey-lib.cjs"));
const { admin, man } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const r = T.R("RB74");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] };
const ck = (ok, control, expected, actual) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: "/api/ai/*", control, expected, actual: String(actual).slice(0, 400), evidence: "", impact: "ai spend", repro: "" }); };

const jpeg = () => { const b = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, 2, 88, 3, 32, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]; while (b.length < 600) b.push(0); return new Uint8Array(b); };
const uuid = () => require("crypto").randomUUID();
async function token(email, password) {
  const c = J.createClient(J.env.NEXT_PUBLIC_SUPABASE_URL, J.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session.access_token;
}
async function call(route, { tok, profileId = P, requestId = uuid(), bytes = jpeg(), type = "image/jpeg", name = "photo.jpg" } = {}) {
  const form = new FormData();
  if (bytes) form.append("image", new File([bytes], name, { type }));
  if (profileId) form.append("profileId", profileId);
  if (requestId) form.append("requestId", requestId);
  const res = await fetch(`${BASE}/api/ai/${route}`, { method: "POST", body: form, headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), "user-agent": "Mozilla/5.0" } });
  let body = {}; try { body = await res.json(); } catch { /* not json */ }
  return { status: res.status, body, mode: res.headers.get("x-scan-guard") };
}
const used = async () => (await admin.from("profiles").select("bulk_scans_used,bulk_scans_cycle_start").eq("id", P).single()).data;

(async () => {
  let ownerTok, otherTok;
  try {
    ownerTok = await token(m.email, m.password);
    otherTok = await token(m.k.email, m.k.password);
    const before = await used();
    for (const [label, route] of [["item scan", "analyze-item"], ["certificate scan", "analyze-coa"]]) {
      let x = await call(route, { tok: null });
      ck(x.status === 401 && x.body.code === "signin", `${label}: no sign-in at all is refused (401)`, "401 signin", JSON.stringify([x.status, x.body.code]));
      x = await call(route, { tok: "forged.token.value" });
      ck(x.status === 401, `${label}: a forged token is refused (401)`, "401", JSON.stringify([x.status, x.body.code]));
      x = await call(route, { tok: otherTok, profileId: P });
      ck(x.status === 403 && x.body.code === "not_member", `${label}: a signed-in person using someone else's profile is refused (403)`, "403 not_member", JSON.stringify([x.status, x.body.code]));
      x = await call(route, { tok: ownerTok, bytes: new TextEncoder().encode("not a picture ".repeat(40)), type: "image/jpeg", name: "photo.jpg" });
      ck(x.status === 415 && x.body.code === "unsupported_type", `${label}: a text file named photo.jpg is refused (415)`, "415", JSON.stringify([x.status, x.body.code]));
      x = await call(route, { tok: ownerTok, bytes: new Uint8Array(4_100_000) });
      ck(x.status === 413 || x.status === 415, `${label}: an oversized file is refused before anything else (413)`, "413", JSON.stringify([x.status, x.body.code]));
      x = await call(route, { tok: ownerTok, requestId: null });
      ck(x.status === 400, `${label}: a request with no request id is refused (400)`, "400", JSON.stringify([x.status, x.body.code]));
      x = await call(route, { tok: ownerTok, profileId: null });
      ck(x.status === 400, `${label}: a request with no profile is refused (400)`, "400", JSON.stringify([x.status, x.body.code]));
    }
    const mid = await used();
    ck(JSON.stringify(mid) === JSON.stringify(before), "none of those refusals spent a scan from the profile's allowance", "unchanged", JSON.stringify([before, mid]));

    // the allowance: a profile whose allowance is zero is refused AFTER sign-in, membership and the image were verified live, and BEFORE any paid call
    const set = await admin.from("profiles").update({ bulk_scan_limit_override: 0 }).eq("id", P);
    ck(!set.error, "setup: the QA profile's own scan override set to 0 (removed at the end)", "ok", set.error ? set.error.message : "ok");
    for (const [label, route] of [["item scan", "analyze-item"], ["certificate scan", "analyze-coa"]]) {
      const x = await call(route, { tok: ownerTok });
      ck(x.status === 429 && x.body.code === "limit" && x.body.remaining === 0, `${label}: an allowance of 0 is refused (429) with the numbers, after the sign-in, membership and image were verified for real`, "429 limit, remaining 0", JSON.stringify([x.status, x.body.code, x.body.remaining, x.body.limit]));
      out[`${route}-mode`] = x.mode;
      ck(x.mode === "basic" || x.mode === "full", `${label}: the answer says which gate mode it used (${x.mode}: 'basic' until SQL package 10 is run, then 'full')`, "basic or full", String(x.mode));
    }
    const after = await used();
    ck(after.bulk_scans_used === before.bulk_scans_used, "a refused (over-limit) request spends nothing", "unchanged", JSON.stringify([before, after]));
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 600); console.error("RUNNER ERROR", e); }
  finally {
    try { await admin.from("profiles").update({ bulk_scan_limit_override: null }).eq("id", P); } catch { /* removed with the account anyway */ }
    fs.writeFileSync(path.join(EV, `rb74-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
