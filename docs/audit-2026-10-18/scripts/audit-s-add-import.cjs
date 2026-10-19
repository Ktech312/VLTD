// ADD audit, suite 6: Spreadsheet import (/vault/import) - valid / invalid / duplicate / empty / wrong-format files, pasted rows, presets, mapping,
// preview -> confirm -> cancel -> undo, resulting records and counts, 150-row file, Business profile, refused connection.
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, click, clickText, typeInto, pickSelect, text, rowsByTitle, allCount, poll, removeItems, mine, mouseAt, rectOf, block, chooseViaButton, tmp } = T;
const PG = "/vault/import | owner, Personal, 26 items";
const PREFIX = "AUD ADD I ";
const created = [];
const tile = (t, label) => { const m = new RegExp(label + "\\s*\\n\\s*(\\d+)").exec(t); return m ? Number(m[1]) : null; };
const money = (t, label) => { const m = new RegExp(label + "\\s*\\n\\s*\\$([\\d,.]+)").exec(t); return m ? Number(m[1].replace(/,/g, "")) : null; };
const raw = (S) => S.text();
async function openImport(S) { await S.visit("/vault/import"); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 60000, "import page"); await sleep(1200); }
async function load(S, file, { preset } = {}) {
  await openImport(S);
  if (preset) { await clickText(S, "^" + preset + "$"); await sleep(400); }
  const r = await chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), file);
  await S.waitFor("/Parsed \\d+ items|No importable rows|failed|Nothing|could not|couldn.t|error|unsupported|empty/i.test(document.body.innerText)", 25000, "parse result").catch(() => {});
  await sleep(1200);
  return { dialog: r.dialog, t: await raw(S) };
}
const confirmBtn = "[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))";
async function confirmOnce(S) { await click(S, confirmBtn); await sleep(1800); }
async function confirmTwice(S) { await confirmOnce(S); await confirmOnce(S); await sleep(4000); }
const csv = (rows) => rows.join("\n");
const dbRows = async (prefix, profile = man().personalId, n = 1, ms = 45000) => (await poll(async () => { const r = await rowsByTitle(profile, prefix); return r.length >= n ? r : null; }, ms, 2500)) || (await rowsByTitle(profile, prefix));
const statusLine = (t) => (t.match(/(Imported \d+[^\n]*|Parsed \d+[^\n]*|No importable[^\n]*|Nothing parsed[^\n]*|Review the import summary[^\n]*|Import (failed|verification)[^\n]*|Undid[^\n]*|Spreadsheet parse failed[^\n]*|[^\n]*(couldn.t|could not|unsupported|not a valid|unreadable)[^\n]*)/i) || [""])[0];

(async () => {
  const m = man(); const P = m.personalId, B = m.businessId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const before = await allCount(P);
    // ---------------- valid file ----------------
    const f1 = tmp("imp-valid.csv");
    fs.writeFileSync(f1, csv(["Name,Purchase Price,Current Value,Notes,Category", `${PREFIX}Alpha,10,20,Note-A,Comics`, `${PREFIX}Beta,0,5,Note-B,Comics`, `${PREFIX}Gamma,,7,Note-G,Comics`]));
    let L = await load(S, f1);
    await rec(S, L.dialog && /Parsed 3 items from imp-valid\.csv/.test(L.t), { page: PG, control: "Upload Spreadsheet (valid 3-row CSV, real click + file dialog)", expected: "Reports 3 parsed items", actual: statusLine(L.t) + " | file dialog opened=" + L.dialog, impact: "blocked workflow", repro: "Click Upload Spreadsheet, choose a 3-row CSV" });
    await rec(S, tile(L.t, "Items Ready") === 3 && tile(L.t, "Ignored Rows") === 0 && money(L.t, "Total Cost") === 10 && money(L.t, "Total Estimated Value") === 32 && tile(L.t, "Missing Cost") === 1, { page: PG, control: "Import summary tiles (3 valid rows)", expected: "Items Ready 3, Ignored 0, Total Cost $10.00, Estimated $32.00, Missing Cost 1", actual: JSON.stringify({ ready: tile(L.t, "Items Ready"), ignored: tile(L.t, "Ignored Rows"), cost: money(L.t, "Total Cost"), est: money(L.t, "Total Estimated Value"), missingCost: tile(L.t, "Missing Cost") }), impact: "misleading result", repro: "Load the CSV; compare the tiles with the file" });
    await confirmOnce(S);
    const t1b = await raw(S);
    await rec(S, /click Confirm Import again/i.test(t1b) && (await rowsByTitle(P, PREFIX)).length === 0, { page: PG, control: "Review & Confirm Import (first click)", expected: "Asks for a second confirmation; nothing imported yet", actual: statusLine(t1b) + " | rows now " + (await rowsByTitle(P, PREFIX)).length, impact: "data loss", repro: "Press Review & Confirm Import once" });
    await confirmOnce(S); await sleep(3000);
    const t1c = await raw(S);
    await rec(S, /Imported 3 items from imp-valid\.csv/.test(t1c), { page: PG, control: "Confirm Import (second click)", expected: "'Imported 3 items ...' with the missing-cost explanation", actual: statusLine(t1c).slice(0, 220), impact: "misleading result", repro: "Press the button twice" });
    const rows1 = await dbRows(PREFIX, P, 3); created.push(...rows1);
    const g = (n) => rows1.find((r) => r.title === PREFIX + n) || {};
    await rec(S, rows1.length === 3 && g("Alpha").purchase_price === 10 && g("Beta").purchase_price === 0 && g("Gamma").purchase_price === null && Number(g("Alpha").current_value) === 20 && Number(g("Gamma").current_value) === 7, { page: PG, control: "Imported records (Purchase Price 10 / 0 / blank, Current Value 20 / 5 / 7)", expected: "3 rows; 0 stays 0; blank stays unknown", actual: JSON.stringify(rows1.map((r) => [r.title.replace(PREFIX, ""), r.purchase_price, r.current_value])), impact: "misleading result", repro: "Import, read rows" });
    await rec(S, rows1.every((r) => /Note-/.test(r.notes || "")) && rows1.every((r) => r.profile_id === P), { page: PG, control: "Imported notes + profile", expected: "Notes kept; rows in Personal", actual: JSON.stringify(rows1.map((r) => [r.notes, (r.profile_id || "").slice(0, 8), r.universe, r.category_label])), impact: "data loss", repro: "Read rows" });
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(1500);
    const vt = await text(S);
    await rec(S, vt.includes(PREFIX + "Alpha") || /AUD ADD I/.test(vt) || (await S.evaluate("[...document.querySelectorAll('a')].some((a) => /AUD ADD I/.test(a.textContent))")), { page: "/vault | owner", control: "Vault after import + reload", expected: "Imported items listed", actual: "AUD ADD I found: " + (/AUD ADD I/.test(vt)), impact: "data loss", repro: "Reload /vault" });
    const S2 = await session("owner", { width: 1440, height: 900 });
    try {
      await S2.visit("/vault/item/" + g("Alpha").id); const b2 = await text(S2);
      await rec(S2, b2.includes(PREFIX + "Alpha") && /Note-A/.test(b2), { page: `/vault/item/${(g("Alpha").id || "").slice(0, 8)} | clean second browser`, control: "Imported item in a clean second browser", expected: "Shown with its note", actual: b2.includes(PREFIX + "Alpha") ? "shown" : "NOT shown", impact: "data loss", repro: "Open the imported item in a second browser" });
    } finally { await S2.close(); }

    // ---------------- mixed: blank name, negative, batch duplicate, vault duplicate ----------------
    const f2 = tmp("imp-mixed.csv");
    fs.writeFileSync(f2, csv(["Name,Purchase Price,Current Value,Notes,Category", `${PREFIX}Alpha,10,20,dup of vault,Comics`, `${PREFIX}Delta,1,2,d1,Cards`, `${PREFIX}Delta,1,2,d2,Cards`, `,3,4,no name,Cards`, `${PREFIX}Neg,-5,1,neg,Cards`, `${PREFIX}Epsilon,2,3,e,Cards`]));
    L = await load(S, f2);
    const sum = { ready: tile(L.t, "Items Ready"), ignored: tile(L.t, "Ignored Rows"), batch: tile(L.t, "Batch Duplicates"), vault: tile(L.t, "Vault Matches") };
    await rec(S, sum.ready === 4 && sum.ignored === 2 && sum.batch === 1 && sum.vault >= 1, { page: PG, control: "Summary for a mixed file (valid, duplicate in file, duplicate of vault, blank name, negative cost)", expected: "Ready 4, Ignored 2 (blank name + negative), Batch Duplicates 1, Vault Matches >= 1", actual: JSON.stringify(sum) + " | " + statusLine(L.t).slice(0, 80), impact: "misleading result", repro: "Load the mixed CSV" });
    await rec(S, /negative cost/i.test(L.t) && /Negative purchase cost|negative/i.test(L.t), { page: PG, control: "Negative-cost row in the file", expected: "Named as ignored with the reason", actual: (L.t.match(/[^\n]*negative[^\n]*/i) || ["(none)"])[0].slice(0, 160), impact: "misleading result", repro: "Load the mixed CSV" });
    await rec(S, /no (name|title)|missing (name|title)|blank|empty/i.test(L.t.slice(L.t.indexOf("IGNORED") >= 0 ? L.t.indexOf("IGNORED") : 0)), { page: PG, control: "Blank-name row in the file", expected: "Listed under Ignored Rows with a reason", actual: (L.t.match(/IGNORED ROWS[^]{0,300}/i) || ["(no ignored rows panel text)"])[0].replace(/\n/g, " ").slice(0, 220), impact: "misleading result", repro: "Load the mixed CSV and read Ignored Rows" });
    // mode: skip exact titles already in vault
    await click(S, "[...document.querySelectorAll('label')].find((l) => /Skip exact titles already in vault/.test(l.textContent))"); await sleep(500);
    await confirmTwice(S);
    const t2 = await raw(S);
    const rows2 = await dbRows(PREFIX, P, 5, 45000); created.push(...rows2);
    const cnt = (n) => rows2.filter((r) => r.title === PREFIX + n).length;
    await rec(S, cnt("Alpha") === 1 && cnt("Delta") === 1 && cnt("Epsilon") === 1 && cnt("Neg") === 0, { page: PG, control: "Skip exact titles already in vault (mixed file)", expected: "Alpha not duplicated (1), Delta once (1), Epsilon (1), Neg never imported (0)", actual: `Alpha=${cnt("Alpha")} Delta=${cnt("Delta")} Epsilon=${cnt("Epsilon")} Neg=${cnt("Neg")}; message: ${statusLine(t2).slice(0, 200)}`, impact: "data loss", repro: "Pick the third duplicate option, confirm twice" });
    await rec(S, /Skipped \d+ exact duplicates/.test(t2) && /NOT imported because of a negative cost/.test(t2), { page: PG, control: "Result message after the mixed import", expected: "Says how many duplicates were skipped and that the negative row was NOT imported", actual: statusLine(t2).slice(0, 300), impact: "misleading result", repro: "Read the message after importing" });
    // mode all
    const f3 = tmp("imp-dups.csv"); fs.writeFileSync(f3, csv(["Name,Purchase Price", `${PREFIX}Zeta,1`, `${PREFIX}Zeta,1`]));
    L = await load(S, f3); await confirmTwice(S);
    const rz = await dbRows(PREFIX + "Zeta", P, 2, 40000); created.push(...rz);
    await rec(S, rz.length === 2, { page: PG, control: "Import all parsed rows (duplicates inside the file)", expected: "Both rows imported when 'Import all' is chosen", actual: "rows=" + rz.length, impact: "misleading result", repro: "Import a file with the same name twice, default option" });
    const f3b = tmp("imp-dups2.csv"); fs.writeFileSync(f3b, csv(["Name,Purchase Price", `${PREFIX}Eta,1`, `${PREFIX}Eta,1`]));
    L = await load(S, f3b); await click(S, "[...document.querySelectorAll('label')].find((l) => /Skip exact duplicate titles within this batch/.test(l.textContent))"); await sleep(400); await confirmTwice(S);
    const re = await dbRows(PREFIX + "Eta", P, 1, 40000); await sleep(6000); const re2 = await rowsByTitle(P, PREFIX + "Eta"); created.push(...re2);
    await rec(S, re2.length === 1, { page: PG, control: "Skip exact duplicate titles within this batch", expected: "One of the two identical rows is imported", actual: "rows=" + re2.length, impact: "misleading result", repro: "Import the duplicate file with that option" });

    // ---------------- undo ----------------
    await openImport(S);
    const undoR = await rectOf(S, T.btnExpr("^Undo last$"));
    await click(S, T.btnExpr("^Undo last$")); await sleep(2500);
    const tu = await raw(S);
    await rec(S, /Undid \d+ items?/.test(tu), { page: PG, control: "Undo last", expected: "Removes the last imported batch and says how many", actual: statusLine(tu) + " | undo enabled before click: " + (undoR && !undoR.disabled), impact: "misleading result", repro: "After importing, press Undo last" });
    const undoneTitle = /Undid \d+ items? from imp-dups2\.csv/.test(tu);
    await sleep(15000);
    const afterUndo = await rowsByTitle(P, PREFIX + "Eta");
    await rec(S, afterUndo.length === 0, { page: PG, control: "Undo last: records in the account", expected: "The undone items are gone from the account too (not only from this device)", actual: `rows named Eta still in the database 15 s after Undo: ${afterUndo.length}`, impact: "data loss", repro: "Import a batch, wait for it to sync, press Undo last, read the database / reload the Vault" });
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(2000);
    const s3 = await S.evaluate("(() => { const t = document.body.innerText; return (t.match(/AUD ADD I Eta/g) || []).length; })()");
    await rec(S, s3 === 0, { page: "/vault | owner", control: "Vault after Undo last + reload", expected: "Undone items do not come back", actual: "'AUD ADD I Eta' shown " + s3 + " times (database rows " + afterUndo.length + ")", impact: "data loss", repro: "Undo, reload /vault" });

    // ---------------- empty / wrong format / header only ----------------
    fs.writeFileSync(tmp("imp-empty.csv"), "");
    L = await load(S, tmp("imp-empty.csv"));
    await rec(S, /No importable|empty|nothing|could not|couldn.t|no rows/i.test(L.t) && tile(L.t, "Items Ready") === 0, { page: PG, control: "Upload Spreadsheet (empty 0-byte file)", expected: "A clear message; nothing to import", actual: statusLine(L.t) || "(no message)", impact: "usability", repro: "Upload an empty file" });
    fs.writeFileSync(tmp("imp-header.csv"), "Name,Purchase Price,Current Value\n");
    L = await load(S, tmp("imp-header.csv"));
    await rec(S, /No importable rows/.test(L.t) && tile(L.t, "Items Ready") === 0, { page: PG, control: "Upload Spreadsheet (header row only)", expected: "'No importable rows found'", actual: statusLine(L.t), impact: "usability", repro: "Upload a CSV with only a header" });
    const png = T.mkPng(tmp("imp-wrong.csv"), 50, 50);
    L = await load(S, tmp("imp-wrong.csv"));
    await rec(S, tile(L.t, "Items Ready") === 0 && /No importable|failed|couldn.t|could not|unsupported|not a valid|unreadable|empty/i.test(L.t), { page: PG, control: "Upload Spreadsheet (a PNG image renamed .csv)", expected: "Rejected with a clear message and no junk rows", actual: statusLine(L.t) + " | items ready " + tile(L.t, "Items Ready") + " | ignored " + tile(L.t, "Ignored Rows"), impact: "misleading result", repro: "Upload a binary file named .csv" });
    fs.writeFileSync(tmp("imp-text.csv"), "this is just a paragraph of text\nwith no columns at all\nnot a spreadsheet");
    L = await load(S, tmp("imp-text.csv"));
    await rec(S, /No importable|failed|couldn.t|could not/i.test(L.t) || tile(L.t, "Items Ready") === 0, { page: PG, control: "Upload Spreadsheet (plain prose in a .csv)", expected: "No items made from prose; a clear message", actual: statusLine(L.t) + " | items ready " + tile(L.t, "Items Ready"), impact: "misleading result", repro: "Upload a text file with sentences" });
    // xlsx
    let XL = null; try { XL = require("C:/Users/EK/VLTD/node_modules/xlsx"); } catch {}
    if (XL) {
      const wb = XL.utils.book_new(); XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet([["Name", "Purchase Price", "Current Value", "Category"], [PREFIX + "Xlsx1", 4, 8, "Comics"], [PREFIX + "Xlsx2", 0, 1, "Comics"]]), "Sheet1");
      XL.writeFile(wb, tmp("imp-valid.xlsx"));
      L = await load(S, tmp("imp-valid.xlsx"));
      await rec(S, /Parsed 2 items from imp-valid\.xlsx/.test(L.t), { page: PG, control: "Upload Spreadsheet (valid .xlsx)", expected: "2 items parsed", actual: statusLine(L.t), impact: "blocked workflow", repro: "Upload a 2-row Excel file" });
      await confirmTwice(S); const rx = await dbRows(PREFIX + "Xlsx", P, 2, 40000); created.push(...rx);
      await rec(S, rx.length === 2 && rx.find((r) => r.title.endsWith("Xlsx2")).purchase_price === 0, { page: PG, control: "Import .xlsx result", expected: "2 rows, explicit 0 kept", actual: JSON.stringify(rx.map((r) => [r.title.replace(PREFIX, ""), r.purchase_price, r.current_value])), impact: "misleading result", repro: "Import the Excel file" });
    }

    // ---------------- cancel ----------------
    const f4 = tmp("imp-cancel.csv"); fs.writeFileSync(f4, csv(["Name,Purchase Price", `${PREFIX}Cancel1,5`, `${PREFIX}Cancel2,6`]));
    L = await load(S, f4); await confirmOnce(S);
    await click(S, T.btnExpr("^Clear$")); await sleep(1500);
    const tcx = await raw(S);
    await sleep(5000);
    await rec(S, (await rowsByTitle(P, PREFIX + "Cancel")).length === 0 && tile(tcx, "Items Ready") === 0 && /No source loaded/.test(tcx), { page: PG, control: "Clear (after the first confirm click)", expected: "Everything discarded; nothing imported; summary back to zero", actual: `rows=${(await rowsByTitle(P, PREFIX + "Cancel")).length}; ready=${tile(tcx, "Items Ready")}; source label: ${(tcx.match(/Source: [^\n]*/) || [""])[0]}`, impact: "data loss", repro: "Load, press Review & Confirm once, then Clear" });
    // leaving the page mid-preview
    L = await load(S, f4);
    await S.visit("/vault/import"); await sleep(2000);
    await rec(S, tile(await raw(S), "Items Ready") === 0 && (await rowsByTitle(P, PREFIX + "Cancel")).length === 0, { page: PG, control: "Reload while a preview is loaded", expected: "Preview gone, nothing imported (an import is never done without the confirm)", actual: `ready after reload=${tile(await raw(S), "Items Ready")}; rows=${(await rowsByTitle(P, PREFIX + "Cancel")).length}`, impact: "usability", repro: "Load a file, reload" });

    // ---------------- pasted rows ----------------
    await openImport(S);
    await typeInto(S, "document.querySelector('textarea')", ["Name\tPurchase Price\tCurrent Value", `${PREFIX}Paste1\t3\t9`, `${PREFIX}Paste2\t0\t1`, `\t1\t1`].join("\n"));
    await click(S, T.btnExpr("^Parse Pasted Rows$")); await sleep(2500);
    const pt = await raw(S);
    await rec(S, /Parsed 2 items/.test(pt) && tile(pt, "Ignored Rows") === 1, { page: PG, control: "Parse Pasted Rows (2 valid + 1 blank-name row)", expected: "2 items parsed, 1 ignored", actual: statusLine(pt) + " | ignored=" + tile(pt, "Ignored Rows"), impact: "misleading result", repro: "Paste tab-separated rows, Parse" });
    await confirmTwice(S); const rp = await dbRows(PREFIX + "Paste", P, 2, 40000); created.push(...rp);
    await rec(S, rp.length === 2 && rp.find((r) => r.title.endsWith("Paste2")).purchase_price === 0, { page: PG, control: "Import pasted rows", expected: "2 rows; explicit 0 kept", actual: JSON.stringify(rp.map((r) => [r.title.replace(PREFIX, ""), r.purchase_price, r.current_value])), impact: "misleading result", repro: "Paste, Parse, confirm twice" });

    // ---------------- presets (eBay / Whatnot) with tax + shipping ----------------
    const fe = tmp("imp-ebay.csv");
    fs.writeFileSync(fe, csv(["Order date,Title,Seller,Item price,Shipping and handling,Tax", `2026-10-01,${PREFIX}eBay Pos,s1,12.5,1.25,0.9`, `2026-10-01,${PREFIX}eBay Zero,s1,0,0,0`, `2026-10-01,${PREFIX}eBay Blank,s1,,,`]));
    L = await load(S, fe, { preset: "eBay Purchases" });
    await rec(S, /Parsed 3 items/.test(L.t), { page: PG, control: "eBay Purchases preset (3 rows)", expected: "3 items parsed", actual: statusLine(L.t), impact: "blocked workflow", repro: "Pick eBay Purchases, upload the file" });
    await confirmTwice(S); const reb = await dbRows(PREFIX + "eBay", P, 3, 45000); created.push(...reb);
    const e = (n) => reb.find((r) => r.title === PREFIX + "eBay " + n) || {};
    await rec(S, Number(e("Pos").purchase_price) === 12.5 && Number(e("Pos").purchase_shipping) === 1.25 && Number(e("Pos").purchase_tax) === 0.9 && e("Zero").purchase_price === 0 && e("Zero").purchase_shipping === 0 && e("Zero").purchase_tax === 0 && e("Blank").purchase_price === null && e("Blank").purchase_shipping === null && e("Blank").purchase_tax === null, { page: PG, control: "eBay preset: price / shipping / tax (positive, explicit 0, blank)", expected: "12.5 / 1.25 / 0.9; 0 / 0 / 0; blank stays null", actual: JSON.stringify(["Pos", "Zero", "Blank"].map((n) => [n, e(n).purchase_price, e(n).purchase_shipping, e(n).purchase_tax])), impact: "misleading result", repro: "Import the eBay CSV, read the rows" });
    const fw = tmp("imp-whatnot.csv");
    fs.writeFileSync(fw, csv(["Order Date,Item Name,Seller,Price,Shipping,Tax", `2026-10-01,${PREFIX}WN Pos,s1,7,1,0.5`, `2026-10-01,${PREFIX}WN Zero,s1,0,0,0`]));
    L = await load(S, fw, { preset: "Whatnot Orders" }); await confirmTwice(S);
    const rw = await dbRows(PREFIX + "WN", P, 2, 40000); created.push(...rw);
    const w = (n) => rw.find((r) => r.title === PREFIX + "WN " + n) || {};
    await rec(S, Number(w("Pos").purchase_price) === 7 && Number(w("Pos").purchase_shipping) === 1 && Number(w("Pos").purchase_tax) === 0.5 && w("Zero").purchase_price === 0 && w("Zero").purchase_tax === 0, { page: PG, control: "Whatnot Orders preset: price / shipping / tax", expected: "7 / 1 / 0.5 and an explicit zero row kept as 0", actual: JSON.stringify(["Pos", "Zero"].map((n) => [n, w(n).purchase_price, w(n).purchase_shipping, w(n).purchase_tax])), impact: "misleading result", repro: "Import the Whatnot CSV" });

    // ---------------- column mapping ----------------
    const fm = tmp("imp-map.csv"); fs.writeFileSync(fm, csv(["Name,Where,Cost", `${PREFIX}Map1,Shelf-Map,11`]));
    L = await load(S, fm);
    const selInfo = await S.evaluate("[...document.querySelectorAll('select')].map((s) => ({ v: s.value, opts: [...s.options].map((o) => o.text.trim()) }))");
    const whereIdx = 1; // second source column
    const pick = await pickSelect(S, `document.querySelectorAll('select')[${whereIdx}]`, "Storage Location"); await sleep(1500);
    const tm = await raw(S);
    await rec(S, /Remapped 1 items?/.test(tm), { page: PG, control: "Mapping preview: MAP TO (column 'Where' -> Storage Location)", expected: "Re-reads the file with the new mapping ('Remapped 1 items')", actual: statusLine(tm) + " | pick: " + pick, impact: "blocked workflow", repro: "Load a file, change a column's MAP TO" });
    await pickSelect(S, `document.querySelectorAll('select')[2]`, "Purchase Price"); await sleep(1200);
    await confirmTwice(S); const rm = await dbRows(PREFIX + "Map1", P, 1, 40000); created.push(...rm);
    await rec(S, rm.length === 1 && rm[0].storage_location === "Shelf-Map" && Number(rm[0].purchase_price) === 11, { page: PG, control: "Imported record after remapping columns", expected: "Storage Location 'Shelf-Map' and Purchase Price 11", actual: JSON.stringify(rm.map((r) => [r.storage_location, r.purchase_price])), impact: "data loss", repro: "Map Where -> Storage Location, Cost -> Purchase Price, import" });

    // ---------------- hostile values ----------------
    const fh = tmp("imp-hostile.csv");
    fs.writeFileSync(fh, csv(["Name,Purchase Price,Current Value", `${PREFIX}Long ${"q".repeat(3000)},"$1,234.50",abc`, `${PREFIX}Big,1e12,99999999999999999999`, `${PREFIX}Paren,(7.50),2`]));
    L = await load(S, fh);
    await rec(S, /Parsed \d+ items/.test(L.t), { page: PG, control: "File with a 3,000-character name, '$1,234.50', 'abc', 1e12, (7.50)", expected: "Parses without crashing; bad numbers are flagged, not silently turned into other numbers", actual: statusLine(L.t) + " | ready=" + tile(L.t, "Items Ready") + " ignored=" + tile(L.t, "Ignored Rows") + " needs-a-look=" + tile(L.t, "Needs a look"), impact: "misleading result", repro: "Upload the file" });
    await confirmTwice(S); const rh = await dbRows(PREFIX, P, 100, 20000); const hostile = rh.filter((r) => /Long q|Big|Paren/.test(r.title)); created.push(...rh);
    const lg = hostile.find((r) => /Long q/.test(r.title)), bg = hostile.find((r) => r.title.endsWith("Big")), pr = hostile.find((r) => r.title.endsWith("Paren"));
    await rec(S, !pr && (!lg || (Number(lg.purchase_price) === 1234.5 && lg.current_value === null)), { page: PG, control: "Imported values from the hostile file", expected: "'(7.50)' is held back as negative; '$1,234.50' (in a CSV the comma splits the cell) must never be stored as a different amount; 'abc' is not stored as a number", actual: JSON.stringify({ longRow: lg && [lg.title.length, lg.purchase_price, lg.current_value], big: bg && [bg.purchase_price, bg.current_value], paren: pr ? "IMPORTED" : "held back" }), impact: "misleading result", repro: "Import the file, read the rows" });
    await removeItems(created.splice(0).filter(Boolean));

    // ---------------- 150 rows ----------------
    const rowsBig = ["Name,Purchase Price,Current Value,Category"]; for (let i = 1; i <= 150; i++) rowsBig.push(`${PREFIX}Big${String(i).padStart(3, "0")},${i},${i * 2},Cards`);
    const fb = tmp("imp-150.csv"); fs.writeFileSync(fb, csv(rowsBig));
    L = await load(S, fb);
    await rec(S, tile(L.t, "Items Ready") === 150 && money(L.t, "Total Cost") === 11325 && money(L.t, "Total Estimated Value") === 22650, { page: PG, control: "Summary tiles for a 150-row file", expected: "Items Ready 150, Total Cost $11,325.00, Estimated $22,650.00", actual: JSON.stringify({ ready: tile(L.t, "Items Ready"), cost: money(L.t, "Total Cost"), est: money(L.t, "Total Estimated Value") }), impact: "misleading result", repro: "Upload the 150-row CSV" });
    await confirmTwice(S);
    const r150 = await poll(async () => { const r = await rowsByTitle(P, PREFIX + "Big"); return r.length >= 150 ? r : null; }, 180000, 5000) || await rowsByTitle(P, PREFIX + "Big");
    created.push(...r150);
    await rec(S, r150.length === 150, { page: PG, control: "Import 150 rows (count in the account)", expected: "Exactly 150 rows reach the account", actual: "rows after up to 3 min: " + r150.length, impact: "data loss", repro: "Import the 150-row file; count rows" });
    await removeItems(created.splice(0).filter(Boolean));

    // ---------------- refused connection ----------------
    const fr = tmp("imp-refused.csv"); fs.writeFileSync(fr, csv(["Name,Purchase Price", `${PREFIX}Refused1,5`]));
    L = await load(S, fr);
    await block(S, true); await confirmTwice(S);
    const tr = await raw(S); await sleep(12000);
    await rec(S, /Imported 1 item/.test(tr) && /not in your account|on this device|offline|retry|will sync|waiting/i.test(await raw(S)), { page: PG, control: "Confirm Import while the database refuses the save", expected: "The page does not just say 'Imported'; it says the items are only on this device for now", actual: statusLine(tr).slice(0, 160) + " | later notice: " + ((await raw(S)).match(/[^\n]*(not in your account|on this device|retry|will sync)[^\n]*/i) || ["(none)"])[0].slice(0, 100) + " | rows in account " + (await rowsByTitle(P, PREFIX + "Refused1")).length, impact: "data loss", repro: "Block vault_items, import one row, confirm twice" });
    await block(S, false);
    await S.visit("/vault/sync"); await sleep(2500); await clickText(S, "^Retry Sync$"); await sleep(8000);
    const rr = await dbRows(PREFIX + "Refused1", P, 1, 40000); created.push(...rr);
    await rec(S, rr.length === 1, { page: "/vault/sync | owner", control: "Retry Sync after a refused import", expected: "Imported row reaches the account once", actual: "rows=" + rr.length, impact: "data loss", repro: "Unblock, Retry Sync" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-import-error"); } catch {} }
  finally { try { await block(S, false); } catch {} await S.close(); }

  // ---------------- Business ----------------
  try {
    const SB = await session("business", { width: 1440, height: 900 });
    try {
      const fz = tmp("imp-biz.csv"); fs.writeFileSync(fz, csv(["Name,Purchase Price", `${PREFIX}Biz1,5`]));
      await openImport(SB); await chooseViaButton(SB, T.btnExpr("^Upload Spreadsheet$"), fz); await SB.waitFor("/Parsed 1 item/.test(document.body.innerText)", 25000).catch(() => {}); await sleep(800);
      await confirmTwice(SB);
      const inB = await dbRows(PREFIX + "Biz1", B, 1, 40000), inP = await rowsByTitle(P, PREFIX + "Biz1"); created.push(...inB, ...inP);
      await rec(SB, inB.length === 1 && inP.length === 0, { page: "/vault/import | owner, Business profile active", control: "Import (Business)", expected: "Row in Business only", actual: `Business=${inB.length}, Personal=${inP.length}`, impact: "privacy/data loss", repro: "Activate Business, import a one-row file" });
    } finally { await SB.close(); }
  } catch (e) { console.error("BIZ ERROR", e); }
  await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean));
  for (const p of mine()) console.log("leftover AUD ADD I rows", (await rowsByTitle(p, PREFIX)).length);
})();
