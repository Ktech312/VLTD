// ADD audit, suite 6d: Import re-tests after the first run's two-column files were refused: the two-column header finding itself, duplicate options, Undo last
// (does it reach the account?), column remapping with recognised headers, Business profile.
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, admin, rec, click, clickText, pickSelect, text, rowsByTitle, removeItems, mine, chooseViaButton, tmp, poll } = T;
const PG = "/vault/import | owner, Personal";
const PREFIX = "AUD ADD J ";
const created = [];
const tile = (t, label) => { const m = new RegExp(label + "\\s*\\n\\s*(\\d+)").exec(t); return m ? Number(m[1]) : null; };
const status = (t) => (t.match(/(Parsed \d+[^\n]*|No importable[^\n]*|Nothing parsed[^\n]*|I couldn.t find[^\n]*)/) || [""])[0];
async function load(S, file, preset) {
  await S.visit("/vault/import"); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 60000); await sleep(1500);
  await chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), file);
  await S.waitFor("/Parsed \\d+ items|No importable|I couldn.t find|failed|Nothing/i.test(document.body.innerText)", 25000).catch(() => {}); await sleep(1200);
  return await S.text();
}
const confirmTwice = async (S) => { for (let k = 0; k < 2; k++) { await click(S, "[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))"); await sleep(1800); } await sleep(3000); };
const dbRows = async (prefix, profile = man().personalId, n = 1, ms = 45000) => (await poll(async () => { const r = await rowsByTitle(profile, prefix); return r.length >= n ? r : null; }, ms, 2500)) || (await rowsByTitle(profile, prefix));
(async () => {
  const m = man(); const P = m.personalId, B = m.businessId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    // two-column file with the header names the app's own message gives as the example
    fs.writeFileSync(tmp("j2.csv"), `Name,Purchase Price\n${PREFIX}Two1,4\n${PREFIX}Two2,0\n`);
    let t = await load(S, tmp("j2.csv"));
    await rec(S, /Parsed 2 items/.test(t), { page: PG, control: "Upload Spreadsheet (a two-column file: 'Name,Purchase Price')", expected: "Parsed: the app's own refusal message names 'Name, Purchase Price' as the kind of header it looks for", actual: `${status(t).slice(0, 170)}; items ready=${tile(t, "Items Ready")}`, impact: "blocked workflow", repro: "Make a CSV with the header Name,Purchase Price and two rows; upload it" });
    fs.writeFileSync(tmp("j3.csv"), `Name,Purchase Price,Notes\n${PREFIX}Three1,4,n\n${PREFIX}Three2,0,n\n`);
    t = await load(S, tmp("j3.csv"));
    await rec(S, /Parsed 2 items/.test(t), { page: PG, control: "Upload Spreadsheet (the same two columns plus Notes)", expected: "Parsed", actual: status(t), impact: "blocked workflow", repro: "Add a Notes column to the same file" });
    await S.jshot("add-import-two-vs-three");
    await confirmTwice(S); created.push(...await dbRows(PREFIX + "Three", P, 2));

    // duplicates, all vs batch option
    fs.writeFileSync(tmp("jz.csv"), `Name,Purchase Price,Notes\n${PREFIX}Zeta,1,a\n${PREFIX}Zeta,1,b\n`);
    t = await load(S, tmp("jz.csv")); await confirmTwice(S);
    const rz = await dbRows(PREFIX + "Zeta", P, 2, 40000); await sleep(4000); const rz2 = await rowsByTitle(P, PREFIX + "Zeta"); created.push(...rz2);
    await rec(S, rz2.length === 2, { page: PG, control: "Import all parsed rows (same name twice in the file)", expected: "Both rows imported with this option", actual: "rows=" + rz2.length, impact: "misleading result", repro: "Import a file with the same name twice, default option" });
    fs.writeFileSync(tmp("je.csv"), `Name,Purchase Price,Notes\n${PREFIX}Eta,1,a\n${PREFIX}Eta,1,b\n`);
    t = await load(S, tmp("je.csv")); await click(S, "[...document.querySelectorAll('label')].find((l) => /Skip exact duplicate titles within this batch/.test(l.textContent))"); await sleep(400); await confirmTwice(S);
    await dbRows(PREFIX + "Eta", P, 1, 40000); await sleep(5000); const re = await rowsByTitle(P, PREFIX + "Eta"); created.push(...re);
    await rec(S, re.length === 1, { page: PG, control: "Skip exact duplicate titles within this batch", expected: "One of the two identical rows is imported", actual: "rows=" + re.length, impact: "misleading result", repro: "Import the duplicate file with that option" });

    // Undo last: reaches the account?
    fs.writeFileSync(tmp("ju.csv"), `Name,Purchase Price,Notes\n${PREFIX}Undo1,2,a\n${PREFIX}Undo2,3,b\n`);
    t = await load(S, tmp("ju.csv")); await confirmTwice(S);
    const ru = await dbRows(PREFIX + "Undo", P, 2, 45000); created.push(...ru);
    await click(S, T.btnExpr("^Undo last$")); await sleep(2500);
    const ut = await text(S);
    await rec(S, /Undid 2 items from ju\.csv/.test(ut), { page: PG, control: "Undo last", expected: "'Undid 2 items from ju.csv.'", actual: (ut.match(/Undid[^\n]*|No import history[^\n]*/) || ["(no message)"])[0], impact: "misleading result", repro: "Import 2 rows, wait for them to sync, press Undo last" });
    await sleep(20000);
    const afterUndo = await rowsByTitle(P, PREFIX + "Undo");
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(2500);
    const shown = (await S.evaluate("(document.body.innerText.match(/AUD ADD J Undo/g) || []).length"));
    await rec(S, afterUndo.length === 0 && shown === 0, { page: PG, control: "Undo last (after the items had already reached the account)", expected: "The undone items are gone from the account and do not come back when the Vault is reloaded", actual: `rows still in the account 20 s after Undo: ${afterUndo.length}; shown on /vault after reload: ${shown}`, impact: "data loss", repro: "Import 2 rows, wait ~10 s, press Undo last, reload /vault" });

    // mapping with recognised headers
    fs.writeFileSync(tmp("jm.csv"), `Name,Purchase Price,Current Value,Where\n${PREFIX}Map1,11,22,Shelf-Map\n`);
    t = await load(S, tmp("jm.csv"));
    const nsel = await S.evaluate("document.querySelectorAll('select').length");
    const sels = await S.evaluate("[...document.querySelectorAll('select')].map((s) => s.options[s.selectedIndex].text.trim())");
    const wi = sels.length - 1; // the last detected column is 'Where'
    const pk = await pickSelect(S, `document.querySelectorAll('select')[${wi}]`, "Storage Location"); await sleep(1500);
    const tm = await text(S);
    await rec(S, /Remapped 1 items?/.test(tm), { page: PG, control: "MAP TO for the column 'Where' -> Storage Location", expected: "Re-reads the file with the new mapping ('Remapped 1 items')", actual: `${(tm.match(/Remapped[^\n]*|Parsed[^\n]*/) || ["(no message)"])[0]}; selects=${nsel}, initial choices ${JSON.stringify(sels)}, pick=${pk}`, impact: "blocked workflow", repro: "Load a file with an unknown column, change its MAP TO" });
    await confirmTwice(S); const rm = await dbRows(PREFIX + "Map1", P, 1, 40000); created.push(...rm);
    await rec(S, rm.length === 1 && rm[0].storage_location === "Shelf-Map" && Number(rm[0].purchase_price) === 11 && Number(rm[0].current_value) === 22, { page: PG, control: "Imported record after remapping", expected: "Storage Location 'Shelf-Map', Purchase Price 11, Current Value 22", actual: JSON.stringify(rm.map((r) => [r.storage_location, r.purchase_price, r.current_value])), impact: "data loss", repro: "Map Where -> Storage Location, import" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-import2-error"); } catch {} }
  finally { await S.close(); }
  try {
    const SB = await session("business", { width: 1440, height: 900 });
    try {
      fs.writeFileSync(tmp("jb.csv"), `Name,Purchase Price,Notes\n${PREFIX}Biz1,5,n\n`);
      const t2 = await load(SB, tmp("jb.csv")); await confirmTwice(SB);
      const inB = await dbRows(PREFIX + "Biz1", B, 1, 40000), inP = await rowsByTitle(P, PREFIX + "Biz1"); created.push(...inB, ...inP);
      await rec(SB, inB.length === 1 && inP.length === 0, { page: "/vault/import | owner, Business profile active", control: "Import (Business)", expected: "Row in Business only", actual: `Business=${inB.length}, Personal=${inP.length}; ${status(t2).slice(0, 60)}`, impact: "privacy/data loss", repro: "Activate Business, import a 3-column file" });
    } finally { await SB.close(); }
  } catch (e) { console.error("BIZ ERROR", e); }
  await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean));
  for (const p of mine()) console.log("leftover AUD ADD J rows", (await rowsByTitle(p, PREFIX)).length);
})();
