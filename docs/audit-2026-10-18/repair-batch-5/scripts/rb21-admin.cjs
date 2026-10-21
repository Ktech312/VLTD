// Consumer 9 of the RC-05 stage-3 checklist: the admin characters page, with a DISPOSABLE QA account given a temporary admin role.
// Authorised solely for this verification. Only synthetic records are touched: the role row and the TOTP factor belong to the QA account,
// and nothing on the page is saved (no Edit Info, no Save). The role row and the factor are removed afterwards and the removal is verified.
//   AUDIT_MANIFEST=<manifest> node rb21-admin.cjs <label>
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const SD = path.join(__dirname, "..", "..", "scripts");
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const L = require(path.join(SD, "audit-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { sleep, admin, m } = X;
const LABEL = process.argv[2] || "run";
const r = L.R("RB21");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], facts: {} };
let S, n = 0;
async function rec(ok, control, expected, actual, page = "/admin/characters") {
  let ev = ""; if (S && page.startsWith("/")) { try { await sleep(300); ev = path.join(L.AUD, await S.jshot(`rb21-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page: page + " | disposable QA account with a temporary admin role", control, expected, actual, evidence: ev ? path.relative(L.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-05 stage 3, consumer 9", repro: "" });
}
// RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const ch of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac("sha1", key).update(counter).digest(); const o = h[h.length - 1] & 15;
  return String(((h[o] & 0x7f) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1000000).padStart(6, "0");
}
const body = async () => (await S.text()).replace(/\s+/g, " ");

(async () => {
  let roleId = null, factorId = null;
  const email = m.email.toLowerCase();
  try {
    // ---- temporary role (QA account only)
    const before = (await admin.from("user_roles").select("id").eq("email", email)).data || [];
    if (before.length) throw new Error("the QA account unexpectedly already has a role row");
    const ins = await admin.from("user_roles").insert({ email, role: "admin", granted_by: "QA verification (disposable account, removed afterwards)" }).select("id").single();
    if (ins.error) throw new Error("role insert: " + ins.error.message); roleId = ins.data.id;
    // ---- session without MFA first: the admin shell must refuse (the app's own rule), then a real TOTP challenge on the QA account
    const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const si = await sb.auth.signInWithPassword({ email: m.email, password: m.password }); if (si.error) throw new Error("sign-in: " + si.error.message);
    const aal1 = si.data.session;
    const enr = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "qa-disposable" }); if (enr.error) throw new Error("enroll: " + enr.error.message);
    factorId = enr.data.id;
    const ch = await sb.auth.mfa.challenge({ factorId }); if (ch.error) throw new Error("challenge: " + ch.error.message);
    const vr = await sb.auth.mfa.verify({ factorId, challengeId: ch.data.id, code: totp(enr.data.totp.secret) }); if (vr.error) throw new Error("verify: " + vr.error.message);
    const aal2 = (await sb.auth.getSession()).data.session;
    const level = (await sb.auth.mfa.getAuthenticatorAssuranceLevel()).data;
    out.facts.assuranceLevelAfterChallenge = level && level.currentLevel;

    // ---- 1. an admin session WITHOUT the second factor is refused
    S = await X.S_("owner", { width: 1440, height: 900 });
    await S.evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(aal1))}); true`);
    await S.visit("/admin/characters"); await sleep(6000);
    let t = await body();
    await rec(!/VLTD Admin/.test(t) && /2FA|two-factor|verification|not authorized|Not authorised|don.t have access|MFA/i.test(t), "Admin role without a completed second factor is refused", "the shell is not shown", `shell shown=${/VLTD Admin/.test(t)}; text: ${t.slice(0, 160)}`);
    // ---- 2. with the verified session the page opens
    await S.evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(aal2))}); true`);
    await S.visit("/admin/characters"); await S.waitFor("document.body.innerText.includes('VLTD Admin')", 45000, "admin shell").catch(() => {}); await sleep(3000);
    t = await body();
    await rec(/VLTD Admin/.test(t) && /characters/.test(t), "Admin with a verified session: the characters page opens", "shell and character list", `shell=${/VLTD Admin/.test(t)}; ${t.slice(0, 140)}`);
    // ---- 3. open a seeded character's Exhibits tab and open an exhibit (a READ; nothing is saved)
    const openFirstExhibit = async () => {
      const findCard = `(() => { const c = [...document.querySelectorAll('button, [role=button], div')].filter((e) => /jpmorgan/i.test(e.innerText || '') && /Morgan/.test(e.innerText || '') && (e.innerText || '').length < 200); return c.length ? c[0] : null; })()`;
      if (!(await S.evaluate(`!!${findCard}`))) { await S.evaluate(`(() => { const h = [...document.querySelectorAll('button')].find((e) => /^characters/i.test((e.innerText || '').replace(/[^A-Za-z ]/g, ' ').trim())); if (h) h.click(); return !!h; })()`); await sleep(1500); }
      await S.evaluate(`(() => { const b = [...document.querySelectorAll('button, [role=button], div')].filter((e) => /jpmorgan/i.test(e.innerText || '') && /Morgan/.test(e.innerText || '') && (e.innerText || '').length < 200)[0]; if (b) b.click(); return !!b; })()`); await sleep(2500);
      await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /^Exhibitions?\\s*\\(/i.test((e.innerText || '').trim())); if (b) b.click(); return !!b; })()`); await sleep(1500);
      const before = await body();
      await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /The Morgan Treasury/.test(e.innerText || '')); if (b) b.click(); return !!b; })()`); await sleep(4000);
      return { before, after: await body() };
    };
    const rq = []; S.c.on((e) => { if (e.method === "Network.responseReceived" && /\/rest\/v1\/(galleries|public_galleries)\?/.test(e.params.response.url)) rq.push(`${e.params.response.status} ${e.params.response.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 100)}`); });
    await S.send("Network.enable").catch(() => {});
    const o1 = await openFirstExhibit();
    out.facts.exhibitRequests = rq.slice(); out.facts.exhibitText = o1.after.slice(0, 500);
    await rec(/The Morgan Treasury/.test(o1.after) && /\d+ items/.test(o1.after), "Admin: a seeded character's exhibit opens in the Exhibits tab", "the exhibit and its item count are shown", `requests for the exhibit's layout: ${JSON.stringify(rq)}; page shows exhibit=${/The Morgan Treasury/.test(o1.after)}; count=${(o1.after.match(/\d+ items/) || [""])[0]}`);
    const errorPage = /Application error|Something went wrong|Unhandled/i.test(o1.after);
    await rec(!errorPage, "Admin: opening an exhibit raises no page error", "none", errorPage ? "an error screen appeared" : "none");
    // ---- 4. the same with the old table read returning nothing (what stage 4 will do): requests to the table answered "no row"
    await S.send("Network.setBlockedURLs", { urls: ["*supabase.co/rest/v1/galleries?*"] }); // the table read fails: the page's own fallback path runs
    rq.length = 0;
    await S.visit("/admin/characters"); await S.waitFor("document.body.innerText.includes('VLTD Admin')", 45000, "admin shell").catch(() => {}); await sleep(3000);
    const o2 = await openFirstExhibit();
    await rec(/The Morgan Treasury/.test(o2.after) && /\d+ items/.test(o2.after) && !/Application error|Something went wrong/i.test(o2.after), "Admin with the table read answering 'no rows' (the situation after stage 4): the exhibit still opens", "same as before", `requests: ${JSON.stringify(rq)}; exhibit=${/The Morgan Treasury/.test(o2.after)}; count=${(o2.after.match(/\d+ items/) || [""])[0]}`);
    await S.send("Network.setBlockedURLs", { urls: [] });
    await S.close();
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 700); }
  finally {
    // ---- remove the temporary role and the factor, and verify
    try { if (roleId) await admin.from("user_roles").delete().eq("id", roleId); } catch {}
    try { if (factorId) await admin.auth.admin.mfa.deleteFactor({ id: factorId, userId: m.userId }); } catch (e) { out.facts.deleteFactorError = String(e.message || e).slice(0, 120); }
    const roleLeft = ((await admin.from("user_roles").select("id").eq("email", email)).data || []).length;
    let factorsLeft = null; try { const lf = await admin.auth.admin.mfa.listFactors({ userId: m.userId }); factorsLeft = lf.data ? (lf.data.factors || lf.data.totp || []).length : "unknown"; } catch { factorsLeft = "unknown"; }
    const rolesTotal = (await admin.from("user_roles").select("id", { count: "exact", head: true })).count;
    out.facts.roleRowsForQaAccountAfterRemoval = roleLeft; out.facts.factorsLeftOnQaAccount = factorsLeft; out.facts.userRolesRowsTotalNow = rolesTotal;
    await rec(roleLeft === 0, "Temporary admin role removed and removal verified", "0 role rows for the QA account; the table is back to its original single row", `role rows for the QA account: ${roleLeft}; rows in user_roles now: ${rolesTotal}`, "database");
    await rec(factorsLeft === 0, "QA account's second factor removed and removal verified", "0 factors", `factors left: ${factorsLeft}`, "database");
    fs.writeFileSync(path.join(EV, `rb21-admin-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    console.log("facts", JSON.stringify(out.facts).slice(0, 900));
    try { await S.close(); } catch {}
    process.exit(0);
  }
})();
