// Owner-only AI rule on PRODUCTION (RB76): refusals only. NO request here can reach the AI provider: every case is refused before the paid call.
// Product rule: only the owner's account has AI access. Every other signed-in account is refused, whatever its profile membership or allowance.
// The QA accounts here are NOT the owner. The first account is a real member of its own profile with a positive allowance (the case that used to be allowed through);
// the second is another signed-in account. The owner's own success path is deliberately never exercised: it would spend Anthropic credit (it is proven with simulated providers instead).
// The only change made is the QA profile's own scan override (5, so the allowance is positive), removed again at the end.
//   AUDIT_MANIFEST=<manifest> node rb76-ai-owner-only-prod.cjs <label> [--base=https://vltd.app]
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const J = require(path.join(SD, "journey-lib.cjs"));
const { admin, man } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const r = T.R("RB76");
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
const snap = async () => (await admin.from("profiles").select("bulk_scans_used,bulk_scans_cycle_start,bulk_scan_limit_override").eq("id", P).single()).data;

(async () => {
  try {
    const memberTok = await token(m.email, m.password);
    const otherTok = await token(m.k.email, m.k.password);
    const ownerEmail = "eck1679@gmail.com";
    ck(m.email.toLowerCase() !== ownerEmail && m.k.email.toLowerCase() !== ownerEmail, "setup: neither QA account is the owner's address", "not the owner", `${m.email} / ${m.k.email}`);
    const set = await admin.from("profiles").update({ bulk_scan_limit_override: 5, bulk_scans_used: 0 }).eq("id", P);
    ck(!set.error, "setup: the QA profile has a POSITIVE allowance (5, none used) and the QA account is its real member", "ok", set.error ? set.error.message : "ok");
    const before = await snap();
    ck(before.bulk_scan_limit_override === 5 && before.bulk_scans_used === 0, "setup check: allowance really reads 5 with 0 used", "5 / 0", JSON.stringify(before));
    const member = await admin.from("profile_members").select("user_id").eq("profile_id", P);
    out.membersOfQaProfile = (member.data || []).length;

    for (const [label, route] of [["item scan", "analyze-item"], ["certificate scan", "analyze-coa"]]) {
      let x = await call(route, { tok: null });
      ck(x.status === 401 && x.body.code === "signin", `${label}: no sign-in at all is refused (401)`, "401 signin", JSON.stringify([x.status, x.body.code]));
      x = await call(route, { tok: "forged.token.value" });
      ck(x.status === 401, `${label}: a forged token is refused (401)`, "401", JSON.stringify([x.status, x.body.code]));
      x = await call(route, { tok: memberTok, profileId: P });
      ck(x.status === 403 && x.body.code === "owner_only", `${label}: a signed-in account that really is a member of the profile, with allowance left, is refused (403 owner_only)`, "403 owner_only", JSON.stringify([x.status, x.body.code]));
      out[`${route}-member-body`] = x.body;
      ck(x.mode === null, `${label}: the refusal came before the gate mode was even chosen (no x-scan-guard header: no membership or allowance step ran)`, "no header", String(x.mode));
      x = await call(route, { tok: otherTok, profileId: P });
      ck(x.status === 403 && x.body.code === "owner_only", `${label}: another signed-in account using that profile is refused the same way (403 owner_only, not a membership answer)`, "403 owner_only", JSON.stringify([x.status, x.body.code]));
      x = await call(route, { tok: memberTok, bytes: new TextEncoder().encode("not a picture ".repeat(40)) });
      ck(x.status === 403 && x.body.code === "owner_only", `${label}: a non-owner with a bad file gets the same refusal (the request is not even examined)`, "403 owner_only", JSON.stringify([x.status, x.body.code]));
      x = await call(route, { tok: memberTok, requestId: null, profileId: null });
      ck(x.status === 403 && x.body.code === "owner_only", `${label}: a non-owner with no profile and no request id gets the same refusal`, "403 owner_only", JSON.stringify([x.status, x.body.code]));
      const dupId = uuid();
      const a = await call(route, { tok: memberTok, requestId: dupId });
      const b = await call(route, { tok: memberTok, requestId: dupId });
      ck(a.status === 403 && b.status === 403 && a.body.code === "owner_only" && b.body.code === "owner_only", `${label}: a repeated request id is refused both times (nothing is reserved)`, "403 x2", JSON.stringify([a.status, b.status]));
    }
    const after = await snap();
    ck(after.bulk_scans_used === 0 && after.bulk_scans_cycle_start === before.bulk_scans_cycle_start, "none of those requests spent or reserved anything: the allowance still reads 0 used of 5", "0 used", JSON.stringify(after));
    const ledger = await admin.from("ai_scan_requests").select("request_id").eq("profile_id", P);
    out.ledgerTable = ledger.error ? `not present (${ledger.error.code}): SQL 10 not run` : `${(ledger.data || []).length} rows`;
    ck(ledger.error ? true : (ledger.data || []).length === 0, "no reservation row exists for the profile (SQL 10's table, if present, is empty for it)", "none", out.ledgerTable);
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 600); console.error("RUNNER ERROR", e); }
  finally {
    try { await admin.from("profiles").update({ bulk_scan_limit_override: null, bulk_scans_used: 0 }).eq("id", P); } catch { /* removed with the account anyway */ }
    fs.writeFileSync(path.join(EV, `rb76-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
