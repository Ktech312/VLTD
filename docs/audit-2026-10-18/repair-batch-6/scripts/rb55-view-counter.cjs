// RC-27 view counter (SQL file 3, record_exhibition_view) on PRODUCTION after the owner ran it. Isolated QA exhibitions only; every temporary row is removed.
// Database level (visitor, unrelated account, owner) and page level (a visitor opens a public exhibition link in a clean browser).
// The count is approximate by design: anyone can call the function with made-up viewer keys. This script shows what it does and does not do.
//   AUDIT_MANIFEST=<manifest> node rb55-view-counter.cjs <label>
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const SD = path.join(__dirname, "..", "..", "scripts");
const A0 = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { admin, sleep, session, man } = A0;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A0.R("RB55");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] };
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A0.AUD, await S.jshot(`rb55-${LABEL}-${out.cases.length + 1}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual });
  r.check(!!ok, { page: page || "database (visitor / QA accounts)", control, expected, actual, evidence: ev ? path.relative(A0.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-27", repro: "" });
}
const client = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const ST = String(m.stamp || Date.now());
const ids = { pub: crypto.randomUUID(), priv: crypto.randomUUID(), draft: crypto.randomUUID(), page: crypto.randomUUID() };
const tok = (k) => `qarb55${ST}${k}`;
const viewsOf = async (id) => (await admin.from("galleries").select("analytics_views,analytics_unique_view_keys").eq("id", id).maybeSingle()).data;
(async () => {
  let S;
  try {
    const V = client(), B = client(), O = client();
    await O.auth.signInWithPassword({ email: m.email, password: m.password });
    const sb = await B.auth.signInWithPassword({ email: m.k.email, password: m.k.password }); if (sb.error) throw new Error("second account sign-in");
    const items = (await admin.from("vault_items").select("id").eq("profile_id", P).like("id", "qa_vz_%").limit(2)).data.map((x) => x.id);
    const lay = { itemIds: items, themePack: "classic", guestViewMode: "public", sections: [], publicItemSnapshots: items.map((id, i) => ({ id, title: `QA Card ${i + 1}`, imageFrontUrl: "/collectibles/comic-slab.png" })) };
    const mk = (k, extra = {}) => ({ id: ids[k], profile_id: P, title: `QA RB55 ${k} ${ST}`, description: "synthetic", visibility: "PUBLIC", state: "ACTIVE", cover_image: "/collectibles/comic-slab.png", layout: lay, exhibition_layout: lay, public_token: tok(k), alias_enabled: false, item_notes: [], analytics_views: 0, analytics_unique_view_keys: [], ...extra });
    const ins = await admin.from("galleries").insert([mk("pub"), mk("priv", { visibility: "LOCKED" }), mk("draft", { state: "STORAGE" }), mk("page")]);
    if (ins.error) throw new Error("setup: " + ins.error.message);
    await admin.from("gallery_items").insert(["pub", "page"].flatMap((k) => items.map((it, i) => ({ gallery_id: ids[k], position: i + 1, artifact_id: it }))));

    const call = (cl, id, key) => cl.rpc("record_exhibition_view", { p_gallery_id: id, p_viewer_key: key });
    let x = await call(V, ids.pub, "viewer-key-one"); let g = await viewsOf(ids.pub);
    await rec(null, !x.error && g.analytics_views === 1, "A visitor with no session opens a public exhibition (viewer key one)", "the counter goes from 0 to 1", x.error ? x.error.message : `views=${g.analytics_views}`);
    x = await call(V, ids.pub, "viewer-key-one"); g = await viewsOf(ids.pub);
    await rec(null, !x.error && g.analytics_views === 1, "The same viewer key again", "still 1 (one view per key)", `views=${g.analytics_views}`);
    x = await call(V, ids.pub, "viewer-key-two"); g = await viewsOf(ids.pub);
    await rec(null, g.analytics_views === 2, "A second viewer key", "2", `views=${g.analytics_views}`);
    await call(V, ids.pub, "abc"); await call(V, ids.pub, "k".repeat(200)); g = await viewsOf(ids.pub);
    await rec(null, g.analytics_views === 2, "A too-short key and a too-long key", "ignored (still 2)", `views=${g.analytics_views}`);
    x = await call(B, ids.pub, "viewer-key-three"); g = await viewsOf(ids.pub);
    await rec(null, !x.error && g.analytics_views === 3, "A signed-in account that does not own the exhibition", "counted (3)", x.error ? x.error.message : `views=${g.analytics_views}`);
    x = await call(O, ids.pub, "viewer-key-owner"); g = await viewsOf(ids.pub);
    await rec(null, g.analytics_views === 3, "The exhibition's own team looking at it", "not a visit (still 3)", `views=${g.analytics_views}`);
    for (const k of ["priv", "draft"]) { await call(V, ids[k], "viewer-key-one"); const gg = await viewsOf(ids[k]); await rec(null, gg.analytics_views === 0, `A visit to a ${k === "priv" ? "private" : "draft"} exhibition`, "nothing is counted", `views=${gg.analytics_views}`); }
    // the keys never leave the server
    const rpc = await V.rpc("record_exhibition_view", { p_gallery_id: ids.pub, p_viewer_key: "viewer-key-four" });
    await rec(null, !rpc.error && (rpc.data === null || rpc.data === undefined || rpc.data === ""), "What the function returns to a visitor", "nothing (the viewer keys are not returned)", JSON.stringify(rpc.data));
    const sh = (await V.rpc("get_gallery_by_share_token", { p_token: tok("pub") })).data || [];
    await rec(null, sh.length === 1 && sh[0].analytics_unique_view_keys === null && typeof sh[0].analytics_views === "number", "The public share link for that exhibition", "shows the count but not the viewer keys", `views=${sh[0] && sh[0].analytics_views}; keys=${JSON.stringify(sh[0] && sh[0].analytics_unique_view_keys)}`);
    // direct writes are still refused
    const w1 = await V.from("galleries").update({ analytics_views: 999 }).eq("id", ids.pub).select("id");
    const w2 = await B.from("galleries").update({ analytics_views: 999 }).eq("id", ids.pub).select("id");
    g = await viewsOf(ids.pub);
    await rec(null, (w1.data || []).length === 0 && (w2.data || []).length === 0 && g.analytics_views === 4, "A visitor and an unrelated account try to write the counter directly", "refused (the counter only moves through the function; 4 after the fourth key)", `visitor=${(w1.data || []).length}; other=${(w2.data || []).length}; views=${g.analytics_views}`);

    // page level: a clean browser opens the public exhibition link
    const before = (await viewsOf(ids.page)).analytics_views;
    S = await session("visitor", { width: 1440, height: 900 });
    await S.visit(`/museum/share/${tok("page")}`); await sleep(9000);
    const afterOne = (await viewsOf(ids.page)).analytics_views;
    await S.visit(`/museum/share/${tok("page")}`); await sleep(7000);
    const afterTwo = (await viewsOf(ids.page)).analytics_views;
    const pageText = (await S.text().catch(() => "")).replace(/\s+/g, " ");
    await rec(S, before === 0 && afterOne === 1 && afterTwo === 1, "A visitor opens the exhibition's public link in a clean browser, then opens it again", "counted once (0 -> 1), not again on the second visit", `before=${before}; after first=${afterOne}; after second=${afterTwo}; page shows QA title=${/QA RB55/.test(pageText)}`, "/museum/share/[token]");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { const all = Object.values(ids); await admin.from("gallery_items").delete().in("gallery_id", all); await admin.from("exhibition_events").delete().in("gallery_id", all); await admin.from("galleries").delete().in("id", all); } catch {}
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb55-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 400));
    process.exit(0);
  }
})();
