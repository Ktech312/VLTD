// GIN insurance suite 2: per-item sheet, Policy Packet paging, printable route. Owner, Personal, desktop. Print is stubbed; print layout via emulated print media.
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl, X } = L;
const num = L.num;
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp;
  const all = await L.rows(P);
  const isSupply = (r) => String(r.universe || "").toUpperCase() === "MISC" && String(r.category_label || "").trim() === "Supplies & Display";
  const coll = all.filter((r) => !isSupply(r));
  const money = (n) => "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
  const amt = (r) => X.basis(r).a;
  const id1 = `qa_vz_${st}_1`, id12 = `qa_vz_${st}_12`, id2 = `qa_vz_${st}_2`, sold0 = `qa_vz_${st}_s0`, sup = `qa_gin_${st}_supply`;
  const S = await L.session("owner");
  const sheetText = async () => L.squash(await S.evaluate("document.querySelector('main section').innerText"));
  try {
    // ---------- per-item sheet
    await S.visit("/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(1500);
    await clickEl(S, `document.querySelector('a[href="/insurance/item?id=${id1}"]')`, { js: true });
    await S.waitFor("location.pathname === '/insurance/item'", 20000); await sleep(2500);
    let t = await sheetText(); const shot = await L.SHOT(S, "ins-item-sheet");
    const r1 = all.find((r) => r.id === id1);
    const upd = await S.evaluate(`new Date(1760000000000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })`);
    const want1 = ["Grade: PSA 9", "Certificate #: CERT-1234", "Serial #: SN-77", "Location: Safe A / Shelf 2", "Purchase Cost: $40", "Current Value: $120", "Source: eBay comps", `Updated: ${upd}`, "Confidence: 85%", "Line1 Line2 with <b>markup</b>", "Item ID " + id1].filter((x) => !t.includes(x));
    R.check(want1.length === 0 && t.includes(r1.title) && /Sports • Sports Cards • Rookie 1\/1/.test(t), { page: `/insurance/item?id=${id1} | owner, Personal, fully documented item`, control: "Per-item sheet fields (opened with a real click on 'Per-item sheet')", expected: "Title, category line, grade, cert, serial, location, cost, value, source, updated date, confidence, notes, item id all match the record (notes shown as literal text)", actual: want1.length ? "missing/different: " + want1.join(" | ") : "all fields match the record", evidence: shot, impact: "misleading result", repro: "Open the sheet for the item and compare to the item record." });
    // no data item
    await S.visit(`/insurance/item?id=${id12}`); await S.waitFor("document.querySelector('main section h1')", 60000); await sleep(1500);
    t = await sheetText();
    R.check(!(/Purchase Cost: \$0/.test(t) && /Current Value: \$0/.test(t)), { page: `/insurance/item?id=${id12} | item with no price and no value`, control: "Per-item sheet Purchase Cost / Current Value for an item with nothing recorded (decision C4)", expected: "Unknown is not shown as $0", actual: t.match(/Purchase Cost.{0,80}/)?.[0] + " (database: price null, value null). FINDING under decision C4.", evidence: await L.SHOT(S, "ins-item-sheet-zero"), impact: "misleading result", repro: "Open the sheet for an item with no price/value." });
    await S.visit(`/insurance/item?id=${id2}`); await S.waitFor("document.querySelector('main section h1')", 60000); await sleep(1200);
    t = await sheetText();
    R.check(/Current Value: \$20\* \(\* based on purchase price, not priced yet\)/.test(t), { page: `/insurance/item?id=${id2} | purchase-price-only item`, control: "Per-item sheet value marked * for a stand-in value", expected: "$20* with the explanation (price $20, no value)", actual: t.match(/Current Value.{0,80}/)?.[0], evidence: "", impact: "misleading result", repro: "Open the sheet of an item without a value." });
    // sold and supply by id
    await S.visit(`/insurance/item?id=${sold0}`); await sleep(3500); t = await sheetText();
    R.check(!/QA Sold Spider-Man 300/.test(t), { page: `/insurance/item?id=${sold0} | SOLD item`, control: "Item sheet for a sold item", expected: "A sold item is not an insurable item (sheet says not found / not owned)", actual: `Sheet shows "${t.slice(25, 85)}" with Purchase Cost/Current Value; consistent with the inventory listing sold items`, evidence: await L.SHOT(S, "ins-item-sheet-sold"), impact: "misleading result", repro: "Open the sheet by id for a sold item." });
    await S.visit(`/insurance/item?id=${sup}`); await sleep(3500); t = await sheetText();
    R.check(/Item not found/.test(t), { page: `/insurance/item?id=${sup} | supply item`, control: "Item sheet for a supply item (not listed in the inventory)", expected: "Not found (the inventory leaves supplies out)", actual: t.slice(25, 120), evidence: "", impact: "usability", repro: "Open the sheet by id for a supply item." });
    for (const [url, lbl] of [["/insurance/item?id=does-not-exist", "unknown id"], ["/insurance/item", "no id"], ["/insurance/item?id=", "empty id"], ["/insurance/item?id=%3Cimg%20src%3Dx%3E", "markup in id"]]) {
      await S.visit(url); await sleep(3000); t = await sheetText();
      R.check(/Item not found/.test(t), { page: url, control: `Item sheet with ${lbl}`, expected: "'Item not found' message with a way back, nothing broken", actual: t.slice(0, 140) + ` (links: ${await S.evaluate("[...document.querySelectorAll('main a')].map((a) => a.textContent.trim()).join(', ')")})`, evidence: lbl === "unknown id" ? await L.SHOT(S, "ins-item-notfound") : "", impact: "usability", repro: `Open ${url}.` });
    }
    // print button + print layout
    await S.visit(`/insurance/item?id=${id1}`); await S.waitFor("document.querySelector('main section h1')", 60000); await sleep(1500);
    await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Print / Save as PDF')`, { js: true }); await sleep(400);
    R.check((await S.look()).print === 1, { page: `/insurance/item?id=${id1}`, control: "Print / Save as PDF", expected: "Calls the browser print once (stubbed)", actual: `print calls ${(await S.look()).print}`, evidence: "", impact: "usability", repro: "Click Print / Save as PDF." });
    await S.send("Emulation.setEmulatedMedia", { media: "print" }); await sleep(600);
    const pm = await S.evaluate(`({ chrome: [...document.querySelectorAll('[data-vault-chrome]')].map((e) => getComputedStyle(e).display), bar: [...document.querySelectorAll('.no-print')].map((e) => getComputedStyle(e).display), htmlDisp: getComputedStyle(document.documentElement).display, nav: [...document.querySelectorAll('nav')].map((e) => getComputedStyle(e).display) })`);
    const shotP = await L.SHOT(S, "ins-item-sheet-print-media");
    await S.send("Emulation.setEmulatedMedia", { media: "" });
    R.check(pm.chrome.every((d) => d === "none") && pm.bar.every((d) => d === "none"), { page: `/insurance/item?id=${id1} | print media`, control: "Item sheet print layout", expected: "Only the item sheet prints: Vault header, tab row, bottom nav and the toolbar are hidden", actual: `vault chrome display: ${pm.chrome.join(",")}; toolbar: ${pm.bar.join(",")}; bottom nav: ${pm.nav.join(",")}`, evidence: shotP, impact: "usability", repro: "Emulate print media on the sheet." });

    // ---------- packet paging
    await S.visit("/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(1500);
    const invTitles = await S.evaluate("[...document.querySelectorAll('table tbody tr .item-title')].map((e) => e.textContent.trim())");
    await S.visit("/insurance/packet"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(1500);
    const PK = "/insurance/packet | owner, Personal, 31 listed items";
    const pageInfo = () => S.evaluate(`(() => { const tx = document.querySelector('main').innerText.replace(/\\s+/g, ' '); const m = tx.match(/Page (\\d+) of (\\d+) • Showing (\\d+) items/); const bt = (l) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === l); return { page: m && Number(m[1]), pages: m && Number(m[2]), showing: m && Number(m[3]), rows: document.querySelectorAll('table tbody tr').length, titles: [...document.querySelectorAll('table tbody tr td:nth-last-child(n+1) .font-black')].map((e) => e.textContent.trim()), prevDis: bt('Prev').disabled, nextDis: bt('Next').disabled, ctr: (tx.match(/Page \\d+ of \\d+(?= Next)/) || [])[0], printHref: document.querySelector('a[href^="/insurance/packet/print"]').getAttribute('href'), imgs: document.querySelectorAll('table img').length, head: tx.match(/Generated.*?Showing \\d+ items/)?.[0] }; })()`);
    const clickLbl = async (l) => { await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(l)})`, { js: true }); await sleep(600); };
    const seq = [];
    let pi = await pageInfo(); seq.push(pi);
    R.check(pi.pages === 2 && pi.showing === 25 && pi.rows === 25 && pi.prevDis && !pi.nextDis, { page: PK + " | images off", control: "Packet page 1 (no images: 25/page)", expected: "Page 1 of 2, 25 rows, Prev disabled, Next enabled", actual: `Page ${pi.page} of ${pi.pages}, showing ${pi.showing}, rows ${pi.rows}, prev disabled ${pi.prevDis}, next disabled ${pi.nextDis}; print link ${pi.printHref}`, evidence: await L.SHOT(S, "ins-packet-p1"), impact: "misleading result", repro: "Open /insurance/packet." });
    await clickLbl("Next"); const p2 = await pageInfo();
    R.check(p2.page === 2 && p2.rows === 6 && !p2.prevDis && p2.nextDis && p2.printHref.includes("page=1"), { page: PK, control: "Next to the last page (6 remaining items)", expected: "Page 2 of 2, 6 rows, Next disabled, Prev enabled, print link page=1", actual: `Page ${p2.page}, rows ${p2.rows}, prev disabled ${p2.prevDis}, next disabled ${p2.nextDis}, ${p2.printHref}`, evidence: await L.SHOT(S, "ins-packet-p2"), impact: "misleading result", repro: "Click Next." });
    const titles1 = pi.titles.slice(0, 25), titles2 = p2.titles;
    const union = titles1.concat(titles2);
    R.check(union.length === coll.length && new Set(union).size === coll.length && coll.every((r) => union.includes(r.title)) && JSON.stringify(union) === JSON.stringify(invTitles), { page: PK, control: "Items across both pages vs the records", expected: "All 31 items exactly once, same order as the inventory", actual: `${union.length} rows, ${new Set(union).size} distinct, in inventory order: ${JSON.stringify(union) === JSON.stringify(invTitles)}`, evidence: "", impact: "misleading result", repro: "Page through the packet." });
    await clickLbl("Prev"); const p1b = await pageInfo();
    R.check(p1b.page === 1 && p1b.rows === 25, { page: PK, control: "Prev", expected: "Back to page 1", actual: `Page ${p1b.page}, rows ${p1b.rows}`, evidence: "", impact: "usability", repro: "Next then Prev." });
    // images toggle
    await clickLbl("Next");
    await clickEl(S, `[...document.querySelectorAll('input[type=checkbox]')].find((c) => c.closest('label') && /Include images/.test(c.closest('label').textContent))`, { js: true }); await sleep(800);
    let im = await pageInfo(); const imgSeq = [im];
    R.check(im.pages === 7 && im.page === 1 && im.rows === 5 && im.imgs === 5 && /images=1/.test(im.printHref), { page: PK + " | images on", control: "Include images (5/page)", expected: "Returns to page 1; 7 pages of 5 (31 items); 5 rows with 5 photos; print link images=1", actual: `Page ${im.page} of ${im.pages}, rows ${im.rows}, photos ${im.imgs}, ${im.printHref}`, evidence: await L.SHOT(S, "ins-packet-images"), impact: "misleading result", repro: "Go to page 2, tick Include images." });
    const allImgTitles = [...im.titles];
    for (let k = 2; k <= 7; k++) { await clickLbl("Next"); im = await pageInfo(); imgSeq.push(im); allImgTitles.push(...im.titles); }
    R.check(im.page === 7 && im.rows === 1 && im.nextDis && allImgTitles.length === 31 && new Set(allImgTitles).size === 31, { page: PK + " | images on", control: "Paging to the end with images (7 pages)", expected: "Last page has 1 item; 31 distinct items across 7 pages", actual: `last: page ${im.page}, rows ${im.rows}; total ${allImgTitles.length}, distinct ${new Set(allImgTitles).size}`, evidence: await L.SHOT(S, "ins-packet-images-last"), impact: "misleading result", repro: "Page to the end with images on." });
    // packet with everything excluded
    await S.evaluate(`localStorage.setItem('vltd_insurance_excluded_item_ids_v1', JSON.stringify(${JSON.stringify(coll.map((r) => r.id))})); true`);
    await S.visit("/insurance/packet"); await S.waitFor("document.querySelector('main')", 30000); await sleep(3000);
    const tAll = L.squash(await S.evaluate("document.querySelector('main').innerText"));
    R.check(/No items selected for this insurance packet/.test(tAll), { page: PK + " | every item excluded", control: "Packet with nothing selected", expected: "A clear 'no items selected' message", actual: tAll.match(/Page \d+ of \d+.{0,60}/)?.[0] + " | " + (tAll.match(/No items selected[^.]*\./)?.[0] || "no message"), evidence: await L.SHOT(S, "ins-packet-none-selected"), impact: "usability", repro: "Exclude all items on /insurance, open the packet." });
    await S.evaluate(`localStorage.removeItem('vltd_insurance_excluded_item_ids_v1'); true`);

    // ---------- printable route
    const PR = "/insurance/packet/print | owner, Personal";
    const probe = async (qs) => { await S.visit("/insurance/packet/print" + qs); await S.waitFor("document.querySelector('table')", 60000).catch(() => {}); await sleep(2500); return S.evaluate(`(() => { const tx = document.body.textContent.replace(/\\s+/g, ' '); const hdr = tx.match(/Generated.*?Images (?:included|excluded)/)?.[0]; return { hdr, rows: document.querySelectorAll('table tbody tr').length, imgs: document.querySelectorAll('table tbody img').length, htmlDisp: getComputedStyle(document.documentElement).display, bodyH: Math.round(document.body.getBoundingClientRect().height), vis: document.body.getBoundingClientRect().height > 100 }; })()`); };
    const a = await probe("?page=0&images=0");
    R.check(a.vis, { page: PR + " | page=0&images=0 (what 'Open Printable Page' opens)", control: "Printable page is visible", expected: "The printable packet page shows the packet (header, table) on screen and in print", actual: `The page is blank: <html> has display:${a.htmlDisp}, body height ${a.bodyH}px, although the table exists in the document (${a.rows} rows). Cause: the page's own CSS rule '[style*="--topnav"] { display: none !important }' matches the <html> element, whose inline style carries --topnav-shift, hiding the entire document.`, evidence: await L.SHOT(S, "ins-print-route-blank"), impact: "blocked workflow", repro: "1. Signed in, open /insurance/packet. 2. Click Open Printable Page. 3. White page, nothing to print." });
    await S.send("Emulation.setEmulatedMedia", { media: "print" }); await sleep(500);
    const printVis = await S.evaluate("getComputedStyle(document.documentElement).display");
    await L.SHOT(S, "ins-print-route-print-media");
    await S.send("Emulation.setEmulatedMedia", { media: "" });
    R.check(printVis !== "none", { page: PR, control: "Printable page in print media (what Save as PDF would capture)", expected: "The packet prints", actual: `<html> display in print media: ${printVis} (blank document)`, evidence: "shots/gin-ins-print-route-print-media.jpg", impact: "blocked workflow", repro: "Emulate print media on the printable route." });
    console.log("print hdr", a.hdr);
    R.check(!/insured items/.test(a.hdr || ""), { page: PR, control: "Printable page header wording", expected: "Does not say the items are insured (documentation readiness is not coverage; the Insurance tab says so)", actual: a.hdr, evidence: "", impact: "misleading result", repro: "Read the header line of the printable page (DOM text)." });
    const combos = [["?page=0&images=0", 25, 1, 2], ["?page=1&images=0", 6, 2, 2], ["?page=1&images=1", 5, 2, 7], ["?page=6&images=1", 1, 7, 7], ["?page=99&images=0", 6, 2, 2], ["?page=-1&images=0", 25, 1, 2], ["?page=abc", 25, 1, 2], ["", 25, 1, 2], ["?images=2", 25, 1, 2]];
    for (const [qs, rows, pg, pgs] of combos) {
      const r = await probe(qs);
      const m2 = (r.hdr || "").match(/Page (\d+) of (\d+)/);
      R.check(r.rows === rows && m2 && Number(m2[1]) === pg && Number(m2[2]) === pgs, { page: PR + " | " + (qs || "(no query)"), control: `Printable route query ${qs || "(none)"}`, expected: `Page ${pg} of ${pgs} with ${rows} items (same slice as the packet page)`, actual: `${(r.hdr || "").slice(0, 120)}; table rows ${r.rows}, photos ${r.imgs}`, evidence: "", impact: "misleading result", repro: `Open /insurance/packet/print${qs}.` });
    }
    // content of print route page 1 == packet page 1
    const c = await probe("?page=0&images=0");
    const prTitles = await S.evaluate("[...document.querySelectorAll('table tbody tr td:first-child .font-bold, table tbody tr td:nth-child(1) .font-bold')].map((e) => e.textContent.trim())");
    R.check(JSON.stringify(prTitles) === JSON.stringify(titles1), { page: PR, control: "Printable route page 1 items vs the packet page 1 (DOM)", expected: "Same 25 items, same order", actual: `${prTitles.length} titles, same as packet: ${JSON.stringify(prTitles) === JSON.stringify(titles1)}`, evidence: "", impact: "misleading result", repro: "Compare rows." });
    // exclusion applied on the printable route
    await S.evaluate(`localStorage.setItem('vltd_insurance_excluded_item_ids_v1', JSON.stringify(['${id1}'])); true`);
    const cx = await probe("?page=0&images=0");
    R.check(/of 30 insured items/.test(cx.hdr || "") , { page: PR + " | one item excluded", control: "Exclusion applied to the printable route", expected: "30 items", actual: cx.hdr, evidence: "", impact: "misleading result", repro: "Exclude one item then open the print route." });
    await S.evaluate(`localStorage.removeItem('vltd_insurance_excluded_item_ids_v1'); true`);
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
