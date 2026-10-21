// Verifies the batch 6 SQL (scan-quota guard, avatar upload rules) on PRODUCTION after the owner has run it. QA fixture only; the avatar object and profile fields touched are restored.
// No AI scan is spent (consume_bulk_scan is called with 0).
//   AUDIT_MANIFEST=<manifest> node rb26-sql-verify.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { session, sleep, man, admin, text, clickText, chooseViaButton, mkPng, tmp } = T;
const m = man(); const P = m.personalId, B = m.businessId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB26");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(T.AUD, await S.jshot(`rb26-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(T.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-10 / RC-11", repro: "" });
}
const client = async (c) => { const x = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } }); const s = await x.auth.signInWithPassword({ email: c.email, password: c.password }); if (s.error) throw new Error("sign-in " + c.email); return x; };
const err = (e) => (e ? `${e.code || e.statusCode || ""} ${String(e.message).slice(0, 90)}` : "ok");
(async () => {
  let sessions = [], hadAvatar = null; const objects = [];
  try {
    hadAvatar = (await admin.from("profiles").select("avatar_url,avatar_emoji").eq("id", P).maybeSingle()).data;
    const A = await client(m), U = await client(m.k);
    // ---- RC-11 at the database
    for (const [label, pid] of [["Personal", P], ["Business", B]]) {
      const s = await A.rpc("bulk_scan_status", { p_profile: pid });
      const row = Array.isArray(s.data) ? s.data[0] : s.data;
      const truth = (await admin.rpc("bulk_scan_status", { p_profile: pid })).data; const trow = Array.isArray(truth) ? truth[0] : truth;
      await rec(null, !s.error && row && row.remaining === trow.remaining && row.scan_limit === trow.scan_limit, `Owner reads the ${label} profile's scan allowance (profile id differs from user id)`, "answers with the same numbers the database holds", s.error ? err(s.error) : JSON.stringify(row), "rpc/bulk_scan_status");
    }
    const c0 = await A.rpc("consume_bulk_scan", { p_profile: P, p_count: 0 });
    const crow = Array.isArray(c0.data) ? c0.data[0] : c0.data;
    await rec(null, !c0.error && crow && crow.granted === 0, "Owner calls consume_bulk_scan for their profile with 0 (no scan spent)", "accepted, 0 granted", c0.error ? err(c0.error) : JSON.stringify(crow), "rpc/consume_bulk_scan");
    const sx = await U.rpc("bulk_scan_status", { p_profile: P });
    await rec(null, !!sx.error && /not authorized/.test(sx.error.message), "Unrelated account reads the owner's scan allowance", "refused ('not authorized')", sx.error ? err(sx.error) : "READ ALLOWED", "rpc/bulk_scan_status");
    const sy = await U.rpc("consume_bulk_scan", { p_profile: P, p_count: 0 });
    await rec(null, !!sy.error && /not authorized/.test(sy.error.message), "Unrelated account calls consume_bulk_scan on the owner's profile", "refused ('not authorized')", sy.error ? err(sy.error) : "ALLOWED", "rpc/consume_bulk_scan");

    // ---- the hole found while correcting file 1: a caller with NO session must not read or spend any profile's allowance (consume is called with 0: nothing is spent either way)
    const visitor = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    for (const [label, call, args] of [["reads", "bulk_scan_status", { p_profile: P }], ["calls consume (0) on", "consume_bulk_scan", { p_profile: P, p_count: 0 }], ["reads the Business profile's allowance of", "bulk_scan_status", { p_profile: B }]]) {
      const v = await visitor.rpc(call, args);
      await rec(null, !!v.error && /permission denied|not authorized/i.test(v.error.message), `A visitor with no session ${label} the owner's scan allowance (${call})`, "refused ('permission denied' or 'not authorized'); nothing returned", v.error ? err(v.error) : "ANSWERED: " + JSON.stringify(v.data), "rpc/" + call);
    }
    const g1 = await visitor.rpc("bulk_scan_guard", { p_profile: P });
    await rec(null, !!g1.error, "A visitor with no session calls the internal guard function directly", "refused", g1.error ? err(g1.error) : "ANSWERED", "rpc/bulk_scan_guard");
    const g2 = await A.rpc("bulk_scan_guard", { p_profile: P });
    await rec(null, !!g2.error, "A signed-in owner calls the internal guard function directly", "refused (it is only for the database's own functions)", g2.error ? err(g2.error) : "ANSWERED", "rpc/bulk_scan_guard");

    // ---- RC-10 at the storage API
    const jpg = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
    const blob = () => new Blob([jpg], { type: "image/jpeg" });
    const up1 = await A.storage.from("avatars").upload(`${P}/avatar.jpg`, blob(), { upsert: true, contentType: "image/jpeg" }); if (!up1.error) objects.push(`${P}/avatar.jpg`);
    const pubUrl = A.storage.from("avatars").getPublicUrl(`${P}/avatar.jpg`).data.publicUrl;
    const got = await fetch(pubUrl + `?t=${Date.now()}`);
    await rec(null, !up1.error && got.status === 200, "Owner uploads an avatar into their profile folder, then the public URL serves it", "uploaded; public URL 200", up1.error ? err(up1.error) : `uploaded; public URL ${got.status}`, "storage avatars");
    const up2 = await A.storage.from("avatars").upload(`${P}/avatar.jpg`, blob(), { upsert: true, contentType: "image/jpeg" });
    await rec(null, !up2.error, "Owner replaces the avatar (upsert)", "accepted", up2.error ? err(up2.error) : "ok", "storage avatars");
    const up3 = await U.storage.from("avatars").upload(`${P}/other.jpg`, blob(), { upsert: true, contentType: "image/jpeg" }); if (!up3.error) objects.push(`${P}/other.jpg`);
    await rec(null, !!up3.error, "Unrelated account uploads into the owner's profile folder", "refused", up3.error ? err(up3.error) : "UPLOADED", "storage avatars");
    const up4 = await A.storage.from("avatars").upload(`${m.k.profileId}/x.jpg`, blob(), { upsert: true, contentType: "image/jpeg" }); if (!up4.error) objects.push(`${m.k.profileId}/x.jpg`);
    await rec(null, !!up4.error, "Owner uploads into the OTHER account's profile folder", "refused", up4.error ? err(up4.error) : "UPLOADED", "storage avatars");
    const up5 = await A.storage.from("avatars").upload(`root-${m.stamp}.jpg`, blob(), { contentType: "image/jpeg" }); if (!up5.error) objects.push(`root-${m.stamp}.jpg`);
    await rec(null, !!up5.error, "Owner uploads a file at the bucket root", "refused", up5.error ? err(up5.error) : "UPLOADED", "storage avatars");

    // ---- through the real pages
    const O = await session("owner", { width: 1440, height: 900 }); sessions.push(O);
    await O.visit("/vault/bulk"); await O.waitFor("document.querySelectorAll('select').length >= 1", 60000); await sleep(3000);
    let tk = null; for (let i = 0; i < 6 && !tk; i++) { await sleep(1500); tk = (await text(O)).match(/(\d+)\s*of (\d+) AI scans left/); }
    await rec(O, !!tk, "Bulk page (Personal profile): the AI scans ticker appears", "'N of M AI scans left this cycle'", tk ? tk[0] : "no ticker", "/vault/bulk");
    await O.visit("/account"); await O.waitFor("document.body.innerText.includes('Avatar')", 40000).catch(() => {}); await sleep(2500);
    await clickText(O, "Image upload"); await sleep(600);
    await mkPng(tmp("rb26-avatar.png"), 300, 300, [200, 90, 90]);
    await chooseViaButton(O, T.btnExpr("Choose Image"), tmp("rb26-avatar.png")); await sleep(5000);
    const shown = await O.evaluate("(() => { const i = document.querySelector('img[alt=\"Avatar preview\"]'); return i ? i.src : null; })()");
    await rec(O, !!shown && /\/avatars\//.test(shown) && !/row-level security/i.test(await text(O)), "Account page: Image upload > Choose Image", "the picture uploads and is previewed; no error", `preview src=${shown ? shown.replace(/\?.*/, "") : null}`, "/account");
    objects.push(`${P}/avatar.jpg`);
    await clickText(O, "Save avatar"); await sleep(3000);
    const saved = (await admin.from("profiles").select("avatar_url").eq("id", P).maybeSingle()).data;
    await rec(O, saved && /\/avatars\/.*avatar\.jpg/.test(saved.avatar_url || ""), "Account page: Save avatar after an upload", "profile stores the uploaded image address", `avatar_url=${saved && saved.avatar_url ? saved.avatar_url.replace(/\?.*/, "") : null}`, "/account");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (objects.length) await admin.storage.from("avatars").remove([...new Set(objects)]); } catch {}
    try { if (hadAvatar) await admin.from("profiles").update({ avatar_url: hadAvatar.avatar_url, avatar_emoji: hadAvatar.avatar_emoji }).eq("id", P); } catch {}
    const left = ((await admin.storage.from("avatars").list(P)).data || []).length;
    out.facts = { avatarObjectsLeftInQaFolder: left };
    for (const S of sessions) { try { await S.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb26-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 300));
    console.log("facts", JSON.stringify(out.facts));
    process.exit(0);
  }
})();
