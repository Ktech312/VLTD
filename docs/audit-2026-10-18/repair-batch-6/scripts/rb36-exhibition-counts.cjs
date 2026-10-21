// RC-23 (counts): a saved exhibition's item count on Favorites, and Discover's count when the public item read fails, only count items a visitor can see.
// Production, isolated QA accounts; a QA favourite row and a QA private item are temporary and removed.
//   AUDIT_MANIFEST=<manifest> node rb36-exhibition-counts.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB36");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb36-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-23", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
(async () => {
  const sessions = []; let favId = null; let restore = null; let gid = null;
  try {
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const g = (await admin.from("galleries").select("id,title,layout,exhibition_layout,visibility,state").eq("profile_id", P).eq("visibility", "PUBLIC").eq("state", "ACTIVE").limit(1)).data[0];
    if (!g) throw new Error("no public QA exhibition");
    gid = g.id;
    // make the owner's profile public so Discover lists the exhibition; make one of its items private so the layout list names a private item
    restore = { profile: (await admin.from("profiles").select("is_public,onboarding_completed").eq("id", P).maybeSingle()).data };
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true }).eq("id", P);
    const layout = g.layout || g.exhibition_layout || {};
    const ids = layout.itemIds || (g.exhibition_layout || {}).itemIds || [];
    const snaps = new Set(((layout.publicItemSnapshots || (g.exhibition_layout || {}).publicItemSnapshots || []).map((s) => s && s.id)).filter(Boolean));
    const priv = ids[0];
    restore.item = (await admin.from("vault_items").select("id,is_public").eq("id", priv).maybeSingle()).data;
    await admin.from("vault_items").update({ is_public: false }).eq("id", priv);
    // the exhibition never published that item: drop its public snapshot (restored afterwards), so the room's own list names a private item
    restore.gallery = { id: g.id, layout: g.layout, exhibition_layout: g.exhibition_layout };
    const drop = (l) => (l && Array.isArray(l.publicItemSnapshots) ? { ...l, publicItemSnapshots: l.publicItemSnapshots.filter((x) => x && x.id !== priv) } : l);
    await admin.from("galleries").update({ layout: drop(g.layout), exhibition_layout: drop(g.exhibition_layout) }).eq("id", g.id);
    snaps.delete(priv);
    const pub = new Set(((await anon.from("public_vault_items").select("id").in("id", ids)).data || []).map((x) => x.id));
    const expected = ids.filter((id) => pub.has(id) || snaps.has(id)).length;
    out.facts = { layoutIds: ids.length, snapshots: snaps.size, visible: expected };

    // favourite saved with a stale/overstated count
    const viewerUser = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === m.k.email);
    const ins = await admin.from("public_favorites").insert({ content_type: "gallery", content_id: gid, user_id: viewerUser.id, metadata: { itemCount: 99, title: g.title, profile_id: m.k.profileId } }).select("id").single();
    if (ins.error) throw new Error("favorite insert: " + ins.error.message);
    favId = ins.data.id;
    const V = await session("viewer", { width: 1440, height: 900 }); sessions.push(V);
    await V.visit("/favorites"); await V.waitFor("document.body.innerText.includes('Exhibition')", 45000).catch(() => {}); await sleep(8000);
    let t = await body(V);
    const shown = Number((t.match(/(\d+) items? · Exhibition/) || [])[1]);
    await rec(V, shown === expected && shown !== 99, "Favorites: a saved exhibition's item count", `the ${expected} items a visitor can see (not the stale 99 saved with the favourite, and not the room's own list that names a private item)`, `shown=${shown}; layout names ${ids.length}`, "/favorites");
    await V.close();

    // Discover when the public item read fails: only published items are counted
    const D = await session("visitor", { width: 1440, height: 900 }); sessions.push(D);
    await D.send("Network.setBlockedURLs", { urls: ["*public_vault_items*"] });
    await D.visit("/discover"); await D.waitFor("document.body.innerText.includes(" + JSON.stringify(g.title) + ")", 45000).catch(() => {}); await sleep(5000);
    const card = await D.evaluate(`(() => { const e = [...document.querySelectorAll('a, article, div')].filter((x) => x.innerText && x.innerText.includes(${JSON.stringify(g.title)}) && /\\d+ items?/.test(x.innerText)).sort((a, b) => a.innerText.length - b.innerText.length)[0]; return e ? e.innerText.replace(/\\s+/g, ' ') : null; })()`);
    const cnt = Number(((card || "").match(/(\d+) items?/) || [])[1]);
    await rec(D, cnt === snaps.size || (snaps.size === 0 && !card), "Discover when the public item read fails: the exhibition's count", `only the ${snaps.size} items the exhibition itself published (never the room's own list of ${ids.length})`, `card says ${cnt}; text: ${String(card).slice(0, 140)}`, "/discover");
    await D.close();
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (favId) await admin.from("public_favorites").delete().eq("id", favId); } catch {}
    try { if (restore && restore.gallery) await admin.from("galleries").update({ layout: restore.gallery.layout, exhibition_layout: restore.gallery.exhibition_layout }).eq("id", restore.gallery.id); } catch {}
    try { if (restore && restore.item) await admin.from("vault_items").update({ is_public: restore.item.is_public }).eq("id", restore.item.id); } catch {}
    try { if (restore) await admin.from("profiles").update({ is_public: restore.profile.is_public, onboarding_completed: restore.profile.onboarding_completed }).eq("id", P); } catch {}
    for (const S of sessions) { try { await S.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb36-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`, JSON.stringify(out.facts));
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 400));
    process.exit(0);
  }
})();
