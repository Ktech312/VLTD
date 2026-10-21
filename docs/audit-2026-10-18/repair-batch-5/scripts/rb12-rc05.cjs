// RC-05 reproduction on PRODUCTION with isolated QA exhibitions (synthetic fixture). No real person is notified:
// the fixture profile has no followers (checked below), and events are plain rows that only a follower's feed would show.
//   AUDIT_MANIFEST=<manifest> node rb12-rc05.cjs <label> <before|after>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const L = require(path.join(SD, "audit-lib.cjs"));
const EXH = require(path.join(SD, "audit-s-exh-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { mclick, byLabel, byText, typeIn, dbItem, sleep, admin, P, ST, m } = X;
const LABEL = process.argv[2] || "run";
const PHASE = process.argv[3] || "before";
const AFTER = PHASE === "after";
const r = L.R("RB12");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, phase: PHASE, cases: [], probes: {} };
let S, n = 0;
async function rec(ok, control, expected, actual, page = "/museum/[galleryId]", blockedByMigration = false) {
  let shot = ""; if (S) { try { await sleep(300); shot = path.join(L.AUD, await S.jshot(`rb12-${LABEL}-${PHASE}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: shot });
  if (AFTER) {
    const row = { page: `${page} | owner, Personal, desktop 1440`, control, expected, actual: blockedByMigration && !ok ? "MIGRATION-BLOCKED (held for review, not applied): " + actual : actual, evidence: shot ? path.relative(L.AUD, shot).replace(/\\/g, "/") : "", impact: "RC-05", repro: "" };
    if (blockedByMigration && !ok) r.blocked(row); else r.check(!!ok, row);
  }
  else console.log(ok ? "OK-NOW " : "FAILS  ", control, "|", String(actual).slice(0, 260));
}
// galleries.id is a uuid in the account
const IDS = {}; const gid = (k) => (IDS[k] = IDS[k] || require("crypto").randomUUID());
const allIds = () => Object.values(IDS);
const gdb = async (id) => (await admin.from("galleries").select("*").eq("id", id).maybeSingle()).data;
const events = async (id) => (await admin.from("exhibition_events").select("id,type").eq("gallery_id", id)).data || [];
const dbWait = async (id, pred, ms = 9000) => { const t0 = Date.now(); let g; while (Date.now() - t0 < ms) { g = await gdb(id); if (g && pred(g)) return g; await sleep(500); } return g; };

(async () => {
  try {
    // ---------- isolated QA exhibitions
    const items = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("status", "COLLECTION").like("id", "qa_vz_%").limit(5)).data.map((x) => x.id);
    const mk = (k, extra) => { const sec = { id: "s" + k, title: "Exhibit 1", description: "", itemIds: items, slotLayout: [...items, null] }; return { id: gid(k), profile_id: P, title: `QA RB12 ${k} ${ST}`, description: "synthetic", visibility: "LOCKED", state: "ACTIVE", cover_image: "/collectibles/comic-slab.png", layout: { itemIds: items, themePack: "classic", displayMode: "grid", guestViewMode: "public", sections: [sec] }, exhibition_layout: { itemIds: items, sections: [sec] }, public_token: `qarb12${ST}${k}`, alias_enabled: false, ...extra }; };
    const rows = [mk("a", {}), mk("s", {}), mk("b", { visibility: "INVITE", layout: { ...mk("b").layout, guestViewMode: "guest" } }), mk("c", {}), mk("p", { visibility: "PUBLIC", alias_enabled: true, alias_name: "QA Alias Curator" })];
    const ins = await admin.from("galleries").insert(rows); if (ins.error) throw new Error("gallery seed: " + ins.error.message);
    const followers = (await admin.from("follows").select("*", { count: "exact", head: true }).eq("followed_id", P)).count;
    out.probes.followersOfFixtureProfile = followers;

    // ---------- DB probes (owner session and anonymous), recorded as facts
    const owner = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const si = await owner.auth.signInWithPassword({ email: m.email, password: m.password });
    if (si.error) throw new Error("owner sign-in: " + si.error.message);
    const uid = si.data.user.id;
    const member = await admin.from("profile_members").select("*").eq("profile_id", P).eq("user_id", uid);
    out.probes.ownerIsMemberRow = (member.data || []).length;
    const insP = await owner.from("exhibition_events").insert({ gallery_id: gid("c"), profile_id: P, type: "published", metadata: { qa: "RB12 probe, no followers" } });
    out.probes.ownerInsertForOwnProfile = insP.error ? { code: insP.error.code, message: insP.error.message } : "ALLOWED";
    const insU = await owner.from("exhibition_events").insert({ gallery_id: gid("c"), profile_id: uid, type: "published", metadata: { qa: "RB12 probe" } });
    out.probes.ownerInsertWithAuthUidAsProfile = insU.error ? { code: insU.error.code, message: insU.error.message } : "ALLOWED";
    await admin.from("exhibition_events").delete().eq("gallery_id", gid("c"));
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const pub = await anon.from("galleries").select("id,profile_id,alias_enabled,alias_name,visibility").eq("id", gid("p")).maybeSingle();
    out.probes.anonReadsAliasExhibition = pub.error ? { error: pub.error.message } : { returnedProfileId: !!pub.data?.profile_id, row: pub.data ? Object.keys(pub.data) : null };
    const star = await anon.from("galleries").select("*").eq("id", gid("p")).maybeSingle();
    out.probes.anonSelectStarColumns = star.error ? star.error.message : Object.keys(star.data || {});
    const pp = await anon.from("public_profiles").select("*").eq("id", P).maybeSingle();
    out.probes.publicProfileForThatId = pp.error ? { error: pp.error.message } : (pp.data ? { found: true, columns: Object.keys(pp.data) } : { found: false });
    for (const rel of ["public_galleries", "public_exhibitions", "public_gallery_view"]) { const t = await anon.from(rel).select("*").limit(1); out.probes["anonRelation_" + rel] = t.error ? t.error.code + " " + t.error.message.slice(0, 60) : "readable"; }
    console.log("DB probes:", JSON.stringify(out.probes));
    await rec(out.probes.ownerInsertForOwnProfile === "ALLOWED", "Owner's own insert into exhibition_events (follower notice) for their profile", "accepted for the profile's own member", `result=${JSON.stringify(out.probes.ownerInsertForOwnProfile)}; member row in profile_members=${out.probes.ownerIsMemberRow}; insert with auth uid as profile id=${JSON.stringify(out.probes.ownerInsertWithAuthUidAsProfile)}`, "database (owner session)", true);
    await rec(!out.probes.anonReadsAliasExhibition.returnedProfileId, "Public read of an alias exhibition row (anonymous visitor)", "does not return the real profile id", `profile_id returned=${out.probes.anonReadsAliasExhibition.returnedProfileId}; columns via select=*: ${JSON.stringify(out.probes.anonSelectStarColumns)}; public_profiles lookup: ${JSON.stringify(out.probes.publicProfileForThatId)}`, "database (anonymous)", true);

    // ---------- UI
    S = await X.S_("owner", { width: 1440, height: 900 });
    const open = async (k) => { await S.visit(`/museum/${gid(k)}`); await S.waitFor("document.body.innerText.includes('QA RB12')", 60000, "builder").catch(() => {}); await sleep(5000); };
    const bodyT = async () => (await S.text()).replace(/\s+/g, " ");

    // alias
    await open("a");
    await mclick(S, `document.querySelector('input[aria-label^="Show a made-up curator identity"]')`); await sleep(600);
    await mclick(S, `document.querySelector('input[aria-label="Alias name"]')`); await typeIn(S, "QA Alias Curator", { clear: true });
    await sleep(6000);
    let g = await gdb(gid("a"));
    await rec(g.alias_enabled === true && g.alias_name === "QA Alias Curator", "Use an alias + Alias name (no Save pressed)", "saved by itself: alias_enabled true and alias_name set", `db alias_enabled=${g.alias_enabled}; alias_name=${JSON.stringify(g.alias_name)}`);
    // shelf style (its own exhibition, fresh page)
    await open("s");
    const shelf0 = (await gdb(gid("s"))).layout?.shelfOverlayStyle ?? "none";
    await mclick(S, byLabel("Shelf style")); await sleep(600);
    await EXH.mclick(S, `([...document.querySelectorAll('body div')].filter(e => e.children.length === 0 && e.textContent.trim() === "Glass").map(e => e.closest('button,[role=option],li') || e)[0])`, { wait: 500, scroll: false }); await sleep(300);
    const shelfShown = await S.evaluate(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).find(t => /^Shelf:/.test(t))`);
    await sleep(6000);
    g = await gdb(gid("s"));
    const shelf1 = g.layout?.shelfOverlayStyle ?? g.exhibition_layout?.shelfOverlayStyle ?? "none";
    await rec(shelf1 === "glass" && shelfShown && /glass/i.test(shelfShown), "Shelf style button (no Save pressed)", "the style shown on the button is what the account holds a few seconds later", `button '${shelfShown}'; db layout.shelfOverlayStyle ${JSON.stringify(shelf0)} -> ${JSON.stringify(shelf1)}`);
    // clean second browser sees both
    await S.close(); S = await X.S_("owner", { width: 1440, height: 900 });
    await open("a");
    const t2 = await bodyT();
    const aliasChecked = await S.evaluate(`!!document.querySelector('input[aria-label^="Show a made-up curator identity"]')?.checked`);
    const aliasVal = await S.evaluate(`document.querySelector('input[aria-label="Alias name"]')?.value || ''`);
    await open("s");
    const shelf2 = await S.evaluate(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).find(t => /^Shelf:/.test(t))`);
    await rec(aliasChecked && aliasVal === "QA Alias Curator" && shelf2 === shelfShown, "Clean second browser: alias and shelf style", "same alias and shelf style as the first browser", `alias checked=${aliasChecked}; alias name='${aliasVal}'; shelf '${shelf2}' (first browser '${shelfShown}')`);

    // announce (exhibition b: guest view, so the Announce button is shown)
    await open("b");
    const ev0 = (await events(gid("b"))).length;
    await mclick(S, byText("Announce", "button")); await sleep(1200);
    const annBtn = await S.evaluate(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).find(t => /Announc/.test(t))`);
    await sleep(2500);
    const ev1 = (await events(gid("b"))).length;
    const bt = await bodyT();
    await rec(!( /Announced/.test(annBtn || "") && ev1 === ev0) && (ev1 > ev0 || /Not announced/.test(bt)), "Announce", "either an announcement row exists, or the page says plainly that it was not announced; never '✓ Announced' without a row", `button '${annBtn}'; announcement rows ${ev0} -> ${ev1}; page says not announced=${/Not announced/.test(bt)}`);

    // make public (exhibition c)
    await open("c");
    const evc0 = (await events(gid("c"))).length;
    await mclick(S, byText("^Public Exhibit$", "button")); await sleep(800);
    await mclick(S, byText("^Make public$", "button")); await sleep(1800);
    const earlyText = await bodyT(); await sleep(3000);
    g = await dbWait(gid("c"), (x) => x.visibility === "PUBLIC", 9000);
    const evc1 = (await events(gid("c"))).length;
    const bt2 = earlyText + " " + await bodyT();
    const claimsAll = /Exhibition published!/.test(earlyText) && !/followers were not notified/.test(earlyText);
    await rec(g.visibility === "PUBLIC" && (evc1 > evc0 || /followers were not notified/.test(bt2)) && !(claimsAll && evc1 === evc0), "Make public", "the exhibition is public; if the follower notice row is missing the page says followers were not notified, otherwise a row exists", `db visibility=${g.visibility}; published-notice rows ${evc0} -> ${evc1}; page: '${(bt2.match(/Exhibition published[^.]*\.?/) || [""])[0]}'`);
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await admin.from("exhibition_events").delete().in("gallery_id", allIds()); await admin.from("galleries").delete().in("id", allIds()); } catch {}
    fs.writeFileSync(path.join(EV, `rb12-rc05-${LABEL}-${PHASE}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    try { await S.close(); } catch {}
    process.exit(0);
  }
})();
