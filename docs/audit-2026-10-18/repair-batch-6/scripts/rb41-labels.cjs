// RC-26 labels and small behaviours not covered by RB39: 'Open editor' on the exhibition panel, 'Insurance Documents' on the item page, 'Clear Unlocked Fields' on Add,
// a watched item's '+ Add to Vault' opening Add Item, the Share panel's private-profile note, and 'Open Exhibitions' on a portfolio category page.
// Production, isolated QA owner; temporary rows restored/removed.
//   AUDIT_MANIFEST=<manifest> node rb41-labels.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB41");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb41-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-26", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
(async () => {
  const cleanup = []; let S;
  try {
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/museum"); await sleep(9000);
    let t = await body(S);
    await rec(S, /Open editor/.test(t) && !/Export PDF/.test(t), "Exhibition details panel: third action", "'Open editor' (it opened the editor under the label 'Export PDF')", `Open editor shown=${/Open editor/.test(t)}; Export PDF shown=${/Export PDF/.test(t)}`, "/museum");

    await X.openItem(S, X.ID.valued); await sleep(2500);
    t = await body(S);
    await rec(S, /Insurance Documents/.test(t) && !/Add to Insurance/.test(t), "Item page: the insurance button", "labelled 'Insurance Documents' (it opens the document export)", `new label=${/Insurance Documents/.test(t)}; old label=${/Add to Insurance/.test(t)}`, "/vault/item/[id]");

    // Share panel with a private profile and a public item
    const prof = (await admin.from("profiles").select("is_public").eq("id", P).maybeSingle()).data;
    const item = (await admin.from("vault_items").select("is_public").eq("id", X.ID.valued).maybeSingle()).data;
    cleanup.push(async () => { await admin.from("profiles").update({ is_public: prof.is_public }).eq("id", P); await admin.from("vault_items").update({ is_public: item.is_public }).eq("id", X.ID.valued); });
    await admin.from("profiles").update({ is_public: false }).eq("id", P);
    await admin.from("vault_items").update({ is_public: true }).eq("id", X.ID.valued);
    await X.openItem(S, X.ID.valued); await sleep(3000);
    await A.clickText(S, "^Share$", "button"); await sleep(3000);
    const pv = await S.evaluate("(() => { const e = document.querySelector('[data-testid=share-profile-private]'); return e ? e.innerText : null; })()");
    await rec(S, /profile is private/i.test(pv || ""), "Item Share panel for a public item of a private profile", "says nobody else can open the link because the profile is private", `note=${JSON.stringify(pv)}`, "/vault/item/[id]");
    await A.press(S, "Escape");

    await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000, "add").catch(() => {}); await sleep(1500);
    t = await body(S);
    await rec(S, /Clear Unlocked Fields/.test(t) && !/Unlock All/.test(t), "Add page: the button that used to say 'Unlock All'", "labelled 'Clear Unlocked Fields' (it clears the fields that are not locked)", `new=${/Clear Unlocked Fields/.test(t)}; old=${/Unlock All/.test(t)}`, "/vault/add");

    // watched item -> Add Item
    const wid = "rb41_watch_" + m.stamp;
    await admin.from("watchlist").delete().eq("item_id", wid);
    await admin.from("watchlist").insert({ item_id: wid, owner_profile_id: P, title: "RB41 Watched", current_value: 120, saved_at: new Date().toISOString() });
    cleanup.push(() => admin.from("watchlist").delete().eq("item_id", wid));
    await S.visit("/watchlist"); await S.waitFor("document.body.innerText.includes('RB41 Watched')", 45000).catch(() => {}); await sleep(3000);
    await A.clickExpr(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.includes('RB41 Watched') && /current value/i.test(b.innerText))"); await sleep(800);
    await A.clickExpr(S, "(() => { const card = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('RB41 Watched') && /current value/i.test(b.innerText)); return card ? [...card.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '+ Add to Vault') : null; })()"); await sleep(3000);
    await rec(S, (await S.path()) === "/vault/add", "Watchlist: '+ Add to Vault' on a watched item", "opens Add Item (it only showed a message and did nothing)", `landed on ${await S.path()}`, "/watchlist");

    // category page 'Open Exhibitions'
    await S.visit("/portfolio/universe/MUSIC/category/Audio%20Formats"); await sleep(9000);
    const hv = await S.evaluate("[...document.querySelectorAll('a')].filter((a) => /Open Exhibitions/i.test(a.innerText || '')).map((a) => a.getAttribute('href'))");
    await rec(S, hv.length > 0 && hv.every((h) => h === "/museum"), "Portfolio category page: 'Open Exhibitions'", "opens /museum", `href=${JSON.stringify(hv)}`, "/portfolio/universe/[key]/category/[category]");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    for (const fn of cleanup.reverse()) { try { await fn(); } catch {} }
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb41-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 420));
    process.exit(0);
  }
})();
