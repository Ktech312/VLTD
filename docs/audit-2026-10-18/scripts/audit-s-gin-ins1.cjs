// GIN insurance suite 1: /insurance inventory (rows, totals, readiness, include/exclude), per-item sheet. Owner, Personal, desktop.
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl, X } = L;
const num = L.num;
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp;
  const PG = "/insurance | owner, Personal, 26 owned + 5 sold + 1 supply";
  const all = await L.rows(P);
  const isSupply = (r) => String(r.universe || "").toUpperCase() === "MISC" && String(r.category_label || "").trim() === "Supplies & Display";
  const coll = all.filter((r) => !isSupply(r));
  const money = (n) => (n < 0 ? "-" : "") + "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
  const amt = (r) => X.basis(r).a, ghost = (r) => X.basis(r).b === "purchase" && X.basis(r).a > 0;
  const expVal = coll.reduce((s, r) => s + amt(r), 0), expCost = coll.reduce((s, r) => s + (num(r.purchase_price) || 0), 0);
  const ownedOnly = coll.filter(X.isActive);
  const ownedVal = ownedOnly.reduce((s, r) => s + amt(r), 0), ownedCost = ownedOnly.reduce((s, r) => s + X.cost(r), 0);
  const readyOf = (r) => { const photo = !!(r.image_front_url || (r.images_json || []).length); const price = num(r.purchase_price); const ident = [r.grade, r.cert_number, r.serial_number, r.number, r.subtitle].some((v) => typeof v === "string" && v.trim()); return photo && X.basis(r).b === "explicit" && price !== null && price > 0 && ident; };
  const expReady = coll.filter(readyOf).length;
  console.log("expected", { n: coll.length, expVal, expCost, ownedVal, ownedCost, expReady });
  const ROWS = `[...document.querySelectorAll('table tbody tr')].map((tr) => ({ excluded: !!tr.querySelector('td[colspan]'), checked: (tr.querySelector('input[type=checkbox]') || {}).checked, title: ((tr.querySelector('.item-title') || tr.querySelector('.font-black') || {}).textContent || '').trim(), cells: [...tr.querySelectorAll('td')].map((td) => td.innerText.replace(/\\s+/g, ' ').trim()) }))`;
  const S = await L.session("owner");
  try {
    await S.visit("/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(2500);
    const rows = await S.evaluate(ROWS); const txt = await L.mainText(S);
    const shot = await L.SHOT(S, "ins-inventory");
    // --- rows vs records
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));
    let bad = [];
    for (const r of coll) { const d = byTitle[r.title]; if (!d) { bad.push(r.title + " missing"); continue; } const c = d.cells; const wantCost = money(num(r.purchase_price) || 0), wantVal = money(amt(r)) + (ghost(r) ? "*" : ""); if (c[7] !== wantCost || c[8] !== wantVal) bad.push(`${r.title.slice(0, 12)} cost ${c[7]} vs ${wantCost}, value ${c[8]} vs ${wantVal}`); }
    R.check(rows.length === coll.length && bad.length === 0, { page: PG, control: "Inventory table rows, Cost and Value columns", expected: `${coll.length} collectible rows, Cost = purchase price, Value = entered value else purchase price marked *`, actual: `${rows.length} rows; mismatches: ${bad.slice(0, 5).join("; ") || "none"}`, evidence: shot, impact: "misleading result", repro: "Compare each row to the item records." });
    const sums = txt.match(/Included (\d+) of (\d+) items • Total Value (\$[\d,]+)(\*?) • Total Cost (\$[\d,]+)/);
    R.check(sums && sums[3] === money(expVal) && sums[5] === money(expCost), { page: PG, control: "Header totals (Total Value, Total Cost)", expected: `Total Value ${money(expVal)}*, Total Cost ${money(expCost)} over the ${coll.length} listed items`, actual: sums ? sums[0] : txt.match(/Included.{0,100}/)?.[0], evidence: shot, impact: "misleading result", repro: "Sum the rows." });
    // --- sold items in an insurance inventory
    const soldTitles = all.filter((r) => r.status === "SOLD").map((r) => r.title);
    const soldShown = soldTitles.filter((t) => byTitle[t]);
    R.check(soldShown.length === 0, { page: PG, control: "Inventory / header totals include SOLD items", expected: "An insurance inventory lists what is owned now: the 5 sold items are not listed and not in Total Value", actual: `${soldShown.length} of 5 sold items are listed (e.g. "${soldShown[0]}") and counted: Total Value ${money(expVal)} vs ${money(ownedVal)} for the 26 owned items (the Reports pages list only owned items: 26)`, evidence: shot, impact: "misleading result", repro: "1. Sell an item (status Sold). 2. Open /insurance: it is still listed and counted." });
    const supplyShown = !!byTitle["QA Supply Box"];
    R.check(!supplyShown, { page: PG, control: "Supply items (Supplies & Display) in the inventory", expected: "Supplies are not collectibles and are not listed", actual: `listed=${supplyShown}`, evidence: "", impact: "misleading result", repro: "Add a Supplies & Display item." });
    // --- C4: no value / no cost print as $0
    const noCost = all.find((r) => r.title.startsWith("QA Album 12 -"));
    const d12 = byTitle[noCost.title];
    R.check(!(d12.cells[7] === "$0" && d12.cells[8] === "$0"), { page: PG + " | item 'QA Album 12': no purchase price and no value recorded", control: "Cost / Value cells of an item with nothing recorded (decision C4)", expected: "Unknown shown as unknown ('Not recorded' / dash), not as $0 (a known $0 is different from unknown)", actual: `Cost ${d12.cells[7]}, Value ${d12.cells[8]} (database: purchase_price ${noCost.purchase_price}, current_value ${noCost.current_value}). Same $0 on the per-item sheet, the packet and the printable page. Documented as decision C4 (open question); recorded as a FINDING.`, evidence: shot, impact: "misleading result", repro: "Open /insurance with an item that has no price or value." });
    // --- sorting/filters/search
    R.nt({ page: PG, control: "Inventory sorting, filters, search, column chooser", expected: "n/a (not offered)", actual: "The inventory has no sort, filter, search or column controls (only Include all, Exclude $0 value, the row checkboxes and per-item links); order is the saved order. Not tested because nothing exists to test; recorded as an improvement opportunity.", evidence: shot, impact: "improvement", repro: "Open /insurance; look for sort/filter/search." });
    // --- readiness
    const rd = txt.match(/Documentation readiness: (\d+) of (\d+) items complete/);
    R.check(rd && Number(rd[1]) === expReady && Number(rd[2]) === coll.length, { page: PG, control: "Documentation readiness count", expected: `${expReady} of ${coll.length} complete (photo + entered value + price above $0 + identifying detail), recomputed from the database`, actual: rd ? rd[0] : "not found", evidence: shot, impact: "misleading result", repro: "Recompute readiness from the records." });
    await clickEl(S, `[...document.querySelectorAll('a')].find((a) => /See what is missing/.test(a.textContent))`, { js: true });
    await S.waitFor("location.pathname === '/vault'", 20000); await sleep(4000);
    const vt = await L.mainText(S); const nr = vt.match(/Needs review: (\d+) items?/i) || vt.match(/(\d+) items? need review/i);
    console.log("vault review text:", vt.match(/.{0,60}needs? review.{0,80}/i)?.[0], "| url", await S.path());
    R.check(nr && Number(nr[1]) === coll.length - expReady, { page: PG, control: "'See what is missing' link", expected: `Opens the Vault listing the ${coll.length - expReady} items missing something (the number readiness implies)`, actual: `Opened ${await S.path()}; says "${nr ? nr[0] : vt.match(/.{0,50}review.{0,60}/i)?.[0]}". Readiness counted ${coll.length} items (sold included); the Vault counts owned items only (${ownedOnly.length}).`, evidence: await L.SHOT(S, "ins-see-what-is-missing"), impact: "misleading result", repro: "Click 'See what is missing' on /insurance." });

    // --- include / exclude
    await S.visit("/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(2000);
    const KEY = "vltd_insurance_excluded_item_ids_v1";
    const victim = all.find((r) => r.title.startsWith("QA Album 3 -"));
    await clickEl(S, `[...document.querySelectorAll('input[type=checkbox]')].find((c) => (c.getAttribute('aria-label') || '').startsWith('Include QA Album 3 -'))`, { js: true }); await sleep(600);
    const ls1 = JSON.parse((await S.evaluate(`localStorage.getItem(${JSON.stringify(KEY)})`)) || "[]");
    const t1 = await L.mainText(S); const s1 = t1.match(/Included (\d+) of (\d+) items • Total Value (\$[\d,]+)\*? • Total Cost (\$[\d,]+)/);
    const afterVal = expVal - amt(victim), afterCost = expCost - (num(victim.purchase_price) || 0);
    R.check(ls1.length === 1 && ls1[0] === victim.id && s1 && Number(s1[1]) === coll.length - 1 && s1[3] === money(afterVal) && s1[4] === money(afterCost) && /Excluded from insurance packet/.test(t1), { page: PG, control: "Row checkbox 'Include ... in insurance' (uncheck one item)", expected: `Item marked excluded; Included ${coll.length - 1} of ${coll.length}; Total Value ${money(afterVal)}; Total Cost ${money(afterCost)}`, actual: `${s1 && s1[0]}; saved ids ${JSON.stringify(ls1)}`, evidence: await L.SHOT(S, "ins-excluded-one"), impact: "misleading result", repro: "Uncheck one item's Insure box." });
    // persistence: reload, then a clean second browser
    await S.visit("/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(2000);
    R.check(/Included 30 of 31/.test(await L.mainText(S)), { page: PG, control: "Exclusion after reload (same browser)", expected: "Still excluded", actual: (await L.mainText(S)).match(/Included.{0,40}/)?.[0], evidence: "", impact: "data loss", repro: "Uncheck, reload." });
    const S2 = await L.session("owner");
    try {
      await S2.visit("/insurance"); await S2.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(2000);
      const t2 = await L.mainText(S2);
      R.check(/Included 30 of 31/.test(t2), { page: PG + " | clean second browser", control: "Exclusion in a second browser/device", expected: "The choice 'not part of insurance documentation' follows the account (the text says checked items are included in insurance reports and the policy packet)", actual: `Second browser: ${t2.match(/Included.{0,40}/)?.[0]}. Exclusions are stored only in this browser's localStorage (${KEY}), not in the account; the packet printed from another device includes the item.`, evidence: await L.SHOT(S2, "ins-exclusion-second-browser"), impact: "misleading result", repro: "Exclude an item on one browser; open /insurance on another." });
    } finally { await S2.close(); }
    // effect on packet and reports
    await S.visit("/insurance/packet"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(1500);
    const pk = (await L.mainText(S));
    R.check(/Included 30 of 31 items/.test(pk) && !pk.includes("QA Album 3 -"), { page: "/insurance/packet | one item excluded", control: "Exclusion applied to the Policy Packet", expected: "Excluded item is not in the packet", actual: pk.match(/Included.{0,60}/)?.[0] + "; QA Album 3 shown: " + pk.includes("QA Album 3 -"), evidence: "", impact: "misleading result", repro: "Exclude, open packet." });
    await S.visit("/reports/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(2000);
    const rp = await L.mainText(S);
    R.check(!rp.includes("QA Album 3 -"), { page: "/reports/insurance | one item excluded on /insurance", control: "Exclusion applied to 'insurance reports' (the page text promises it)", expected: "Excluded item is also left out of the Insurance report", actual: `QA Album 3 listed in /reports/insurance: ${rp.includes("QA Album 3 -")} (report says ${rp.match(/ITEMS (\d+)/)?.[0]})`, evidence: await L.SHOT(S, "ins-exclusion-reports"), impact: "misleading result", repro: "Exclude item on /insurance, open /reports/insurance and /portfolio/insurance." });
    await S.visit("/portfolio/insurance"); await sleep(3000);
    R.check(!(await L.mainText(S)).includes("QA Album 3 -"), { page: "/portfolio/insurance | one item excluded", control: "Exclusion applied to the Inventory Schedule", expected: "Excluded item left out", actual: `listed=${(await L.mainText(S)).includes("QA Album 3 -")}`, evidence: "", impact: "misleading result", repro: "as above" });
    // Exclude $0 value, Include all
    await S.visit("/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(1500);
    await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Exclude $0 value')`, { js: true }); await sleep(600);
    const ls2 = JSON.parse(await S.evaluate(`localStorage.getItem(${JSON.stringify(KEY)})`) || "[]");
    const want0 = coll.filter((r) => amt(r) <= 0).map((r) => r.id).concat([victim.id]).sort();
    const t3 = await L.mainText(S); const s3 = t3.match(/Included (\d+) of (\d+) items • Total Value (\$[\d,]+)/);
    R.check(JSON.stringify(ls2.slice().sort()) === JSON.stringify(want0) && Number(s3[1]) === coll.length - want0.length, { page: PG, control: "Exclude $0 value", expected: `Excludes items whose stated value is $0 (${want0.length - 1}: ${coll.filter((r) => amt(r) <= 0).map((r) => r.title.slice(0, 14)).join(", ")}) and keeps the earlier exclusion`, actual: `${s3[0]}; saved ${ls2.length} ids (expected ${want0.length})`, evidence: await L.SHOT(S, "ins-exclude-zero"), impact: "misleading result", repro: "Click Exclude $0 value." });
    // print layout hides excluded rows
    await S.send("Emulation.setEmulatedMedia", { media: "print" }); await sleep(500);
    const printRows = await S.evaluate(`[...document.querySelectorAll('table tbody tr')].filter((tr) => getComputedStyle(tr).display !== 'none').length`);
    const printHidden = await S.evaluate(`[...document.querySelectorAll('.no-print')].every((e) => getComputedStyle(e).display === 'none')`);
    const shotPrint = await L.SHOT(S, "ins-inventory-print-media");
    await S.send("Emulation.setEmulatedMedia", { media: "" });
    R.check(printRows === coll.length - want0.length && printHidden, { page: PG + " | print layout (emulated print media)", control: "Print Inventory PDF layout", expected: `Only the ${coll.length - want0.length} included rows print; controls (checkboxes, buttons, notes) hidden`, actual: `visible rows in print media: ${printRows}; all .no-print hidden: ${printHidden}`, evidence: shotPrint, impact: "misleading result", repro: "Emulate print media on /insurance." });
    await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Include all')`, { js: true }); await sleep(600);
    const ls3 = await S.evaluate(`localStorage.getItem(${JSON.stringify(KEY)})`);
    R.check(ls3 === "[]" && /Included 31 of 31/.test(await L.mainText(S)), { page: PG, control: "Include all", expected: "Everything included again", actual: `${(await L.mainText(S)).match(/Included.{0,30}/)?.[0]}; saved ${ls3}`, evidence: "", impact: "usability", repro: "Click Include all." });
    // Print Inventory button
    await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Print Inventory PDF')`, { js: true }); await sleep(500);
    R.check((await S.look()).print === 1, { page: PG, control: "Print Inventory PDF", expected: "Calls the browser print once (window.print stubbed)", actual: `print calls ${(await S.look()).print}; the page is the on-screen table, no file is generated or downloaded`, evidence: "", impact: "usability", repro: "Click Print Inventory PDF." });
    // Policy Packet link
    await clickEl(S, `[...document.querySelectorAll('a')].find((a) => /Policy Packet \\(PDF\\)/.test(a.textContent))`, { js: true }); await S.waitFor("location.pathname === '/insurance/packet'", 20000); await sleep(1500);
    R.check((await S.path()) === "/insurance/packet", { page: PG, control: "Policy Packet (PDF) header link", expected: "Opens /insurance/packet", actual: `Opened ${await S.path()}. The label promises a PDF but the link opens an on-screen page (no PDF is produced there; its 'Open Printable Page' link is the print route)`, evidence: "", impact: "usability", repro: "Click Policy Packet (PDF)." });
  } finally { await S.close(); await admin.from("vault_items").select("id").eq("id", "x"); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
