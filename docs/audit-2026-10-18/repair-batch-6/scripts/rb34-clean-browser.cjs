// RC-22: direct loads in a clean browser (nothing saved on this device) show the account's data, not zeros. Production, isolated QA owner; reads only.
// The browser session starts without a saved copy of the account's items, exhibitions or goals.
//   AUDIT_MANIFEST=<manifest> node rb34-clean-browser.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB34");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb34-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-22", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
// every direct load gets a browser that holds nothing saved
async function fresh(url, wait = 12000) {
  const S = await session("owner", { width: 1440, height: 900 });
  await S.evaluate("(() => { try { for (const k of Object.keys(localStorage)) if (/^vltd_(vault_items|items|galleries|goals|sales)/.test(k)) localStorage.removeItem(k); } catch {} return true; })()").catch(() => {});
  await S.visit(url); await sleep(wait);
  return S;
}
(async () => {
  const sessions = [];
  try {
    const all = (await admin.from("vault_items").select("id,status").eq("profile_id", P)).data || [];
    const owned = all.filter((i) => i.status !== "SOLD" && i.status !== "WISHLIST").length;
    const forSale = all.filter((i) => i.status === "FOR_SALE").length;
    const gal = (await admin.from("galleries").select("id").eq("profile_id", P)).data || [];
    out.facts = { allItems: all.length, owned, forSale, galleries: gal.length };

    let S = await fresh("/museum", 14000); sessions.push(S);
    let t = await body(S);
    const cardCounts = [...t.matchAll(/(\d+) items?\b/g)].map((x) => Number(x[1]));
    await rec(S, cardCounts.some((c) => c > 0), "/museum in a clean browser: exhibition cards", "the cards show their real item counts (not every card 0 items)", `item counts seen on the page: ${JSON.stringify(cardCounts.slice(0, 12))}`, "/museum");
    await S.close();

    S = await fresh("/museum/new", 12000); sessions.push(S);
    t = await body(S);
    const cur = (t.match(/CURRENT EXHIBITIONS\s*(\d+)/i) || [])[1];
    await rec(S, Number(cur) === gal.length, "/museum/new in a clean browser: Current Exhibitions", `${gal.length} (what the account holds)`, `tile=${cur}`, "/museum/new");
    await S.close();

    S = await fresh("/vault/print", 12000); sessions.push(S);
    t = await body(S);
    const total = (t.match(/TOTAL ITEMS\s*(\d+)/i) || [])[1];
    await rec(S, Number(total) === owned, "/vault/print in a clean browser: Collection report", `TOTAL ITEMS ${owned}`, `TOTAL ITEMS ${total}`, "/vault/print");
    await S.close();

    S = await fresh("/vault/readiness", 12000); sessions.push(S);
    t = await body(S);
    await rec(S, forSale > 0 && !/No for-sale listings yet/i.test(t), "/vault/readiness in a clean browser: Listing Readiness", `lists the ${forSale} for-sale items`, `empty message shown=${/No for-sale listings yet/i.test(t)}; text: ${t.slice(0, 160)}`, "/vault/readiness");
    await S.close();

    S = await fresh("/portfolio/insurance", 12000); sessions.push(S);
    t = await body(S);
    await rec(S, !/No items found/i.test(t) && !/On 0 of 0 items/i.test(t), "/portfolio/insurance in a clean browser: Inventory Schedule", "shows the account's items", `empty message=${/No items found/i.test(t)}; zero basis=${/On 0 of 0 items/i.test(t)}`, "/portfolio/insurance");
    await S.close();

    S = await fresh("/reports/weekly", 12000); sessions.push(S);
    t = await body(S);
    await rec(S, !/COULD NOT LOAD|Loading your weekly report/i.test(t) && /WEEKLY VAULT REPORT/i.test(t), "/reports/weekly in a clean browser: Weekly report", "loads the account's items and shows the report", `text: ${t.slice(0, 160)}`, "/reports/weekly");
    await S.close();

    // account: the sync line, and the export
    S = await fresh("/account?section=data", 12000); sessions.push(S);
    t = await body(S);
    await rec(S, !/Out of sync/i.test(t), "/account in a clean browser: the sync line", "does not warn 'Out of sync' only because this browser has not loaded the vault yet", `out of sync shown=${/Out of sync/i.test(t)}; text: ${(t.match(/(Local \d+[^.]{0,80}|Your vault \(\d+ items\)[^.]*\.|Synced \(\d+\))/) || [""])[0]}`, "/account");
    await S.evaluate("(() => { window.__blobs = []; const o = URL.createObjectURL; URL.createObjectURL = function (b) { try { window.__blobs.push({ size: b.size, type: b.type, p: b.text ? b.text() : null }); } catch {} return o.call(URL, b); }; return true; })()");
    await A.clickText(S, "^Export Vault JSON$", "button"); await sleep(9000);
    const exp = await S.evaluate("(async () => { const b = (window.__blobs || [])[0]; if (!b) return null; const txt = await b.p; let n = -1; try { n = JSON.parse(txt).items.length; } catch {} return { size: b.size, records: n }; })()");
    const t2 = await body(S);
    await rec(S, exp && exp.records === all.length, "Export Vault JSON in a clean browser", `a file with the account's ${all.length} records (not an empty 64-byte file)`, `file=${JSON.stringify(exp)}; message: ${(t2.match(/(Couldn.t reach your account[^.]*\.|Your vault has no items[^.]*\.)/) || [""])[0]}`, "/account");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    for (const S of sessions) { try { await S.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb34-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`, JSON.stringify(out.facts));
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 400));
    process.exit(0);
  }
})();
