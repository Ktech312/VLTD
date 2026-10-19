// GIN insurance suite 3: /reports/insurance, /portfolio/insurance, /reports/weekly (values, sorting, controls, links) and the print-layout re-checks. Owner, Personal, desktop.
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl, X } = L;
const num = L.num;
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp;
  const all = await L.rows(P);
  const isSupply = (r) => String(r.universe || "").toUpperCase() === "MISC" && String(r.category_label || "").trim() === "Supplies & Display";
  const owned = all.filter((r) => X.isActive(r) && !isSupply(r));
  const money = (n) => (n < 0 ? "-" : "") + "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
  const amt = (r) => X.basis(r).a, ghost = (r) => X.basis(r).b === "purchase" && X.basis(r).a > 0;
  const E = X.expected(all.filter((r) => !isSupply(r)));
  const expVal = owned.reduce((s, r) => s + amt(r), 0), expCost = owned.reduce((s, r) => s + X.cost(r), 0);
  console.log({ owned: owned.length, expVal, expCost, gain: E.gain, gainN: E.gainN, costBase: E.costBase });
  const S = await L.session("owner");
  const tbl = () => S.evaluate(`[...document.querySelectorAll('table tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.replace(/\\s+/g, ' ').trim()))`);
  try {
    // ================= /reports/insurance
    const RI = "/reports/insurance | owner, Personal, 26 owned + 5 sold";
    await S.visit("/reports/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(3000);
    let t = await L.mainText(S); const shot = await L.SHOT(S, "rep-insurance");
    const ct = t.match(/ITEMS (\d+) STATED VALUE (\$[\d,]+)(\*?) Purchase cost (\$[\d,]+) UNREALIZED CHANGE ([+-]?\$[\d,]+|—) On (\d+) of (\d+) items · cost basis (\$[\d,]+)/i);
    R.check(ct && Number(ct[1]) === owned.length && ct[2] === money(expVal) && ct[4] === money(expCost) && Number(ct[6]) === E.gainN && ct[8] === money(E.costBase) && ct[5] === (E.gain >= 0 ? "+" : "-") + money(E.gain).replace("-", ""), { page: RI, control: "Summary cards (Items, Stated Value, Purchase cost, Unrealized change)", expected: `${owned.length} items, ${money(expVal)}*, cost ${money(expCost)}, change ${money(E.gain)} on ${E.gainN} items, cost basis ${money(E.costBase)}`, actual: ct ? ct[0] : t.slice(0, 200), evidence: shot, impact: "misleading result", repro: "Recompute from records." });
    const uni = {}; owned.forEach((r) => { uni[r.universe] = uni[r.universe] || { n: 0, v: 0 }; uni[r.universe].n++; uni[r.universe].v += amt(r); });
    const labels = { POP_CULTURE: "Pop Culture", SPORTS: "Sports", TCG: "TCG & Non Sport Card", MUSIC: "Music" };
    const badU = Object.entries(uni).filter(([k, v]) => !t.includes(`${labels[k]} ${v.n} items • ${money(v.v)}`)).map(([k]) => k);
    R.check(badU.length === 0, { page: RI, control: "Value by Universe", expected: Object.entries(uni).map(([k, v]) => `${labels[k]} ${v.n} • ${money(v.v)}`).join("; "), actual: badU.length ? "mismatch: " + badU.join(",") + " | " + t.match(/BREAKDOWN.*?FULL INVENTORY/i)?.[0].slice(0, 300) : "all four universes match", evidence: shot, impact: "misleading result", repro: "Recompute per universe." });
    let rows = await tbl(); const hdr = await S.evaluate("[...document.querySelectorAll('table thead th')].map((th) => th.textContent.trim())");
    const sortedBy = (arr) => arr.map((c) => c[hdr.indexOf("Title")]);
    const valueOf = (c) => Number((c[hdr.indexOf("Value")] || "").replace(/[^0-9.-]/g, ""));
    R.check(rows.length === owned.length && !rows.some((c) => /QA Sold/.test(c.join(" "))), { page: RI, control: "Itemized list rows", expected: "26 owned items; the 5 sold items are not listed", actual: `${rows.length} rows; sold listed: ${rows.some((c) => /QA Sold/.test(c.join(" ")))} (the Insurance tab lists 31, with the sold items)`, evidence: shot, impact: "misleading result", repro: "Compare row counts between /insurance and /reports/insurance." });
    const badRows = [];
    for (const r of owned) { const c = rows.find((x) => x[hdr.indexOf("Title")].startsWith(r.title)); if (!c) { badRows.push(r.title + " missing"); continue; } if (valueOf(c) !== Math.round(amt(r))) badRows.push(`${r.title.slice(0, 12)} value ${c[hdr.indexOf("Value")]} vs ${money(amt(r))}`); if (c[hdr.indexOf("Cost")] !== money(X.cost(r))) badRows.push(`${r.title.slice(0, 12)} cost ${c[hdr.indexOf("Cost")]} vs ${money(X.cost(r))}`); }
    R.check(badRows.length === 0, { page: RI, control: "Itemized list: Cost and Value per row", expected: "Each row's Cost = total cost, Value = stated value (* when purchase-based)", actual: badRows.slice(0, 5).join("; ") || "all 26 rows match", evidence: shot, impact: "misleading result", repro: "Compare rows to records." });
    // sort options
    const sortCheck = async (label, cmp, key) => { await clickEl(S, `document.querySelector('[aria-label="Sort report"]')`, { js: true }); await sleep(400); await clickEl(S, `[...document.querySelectorAll('[role=menu] button,[role=menuitem],[role=option]')].find((b) => b.textContent.trim() === ${JSON.stringify(label)}) || [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === ${JSON.stringify(label)}).pop()`, { js: true }); await sleep(600); const rs = await tbl(); const vals = rs.map((c) => key(c)); const ok = vals.every((v, i) => i === 0 || cmp(vals[i - 1], v)); R.check(ok, { page: RI, control: `Sort: ${label}`, expected: "Rows ordered as labelled", actual: `first rows: ${vals.slice(0, 6).join(", ")} ... last: ${vals.slice(-3).join(", ")}; footer says '${(await L.mainText(S)).match(/Sorted: [a-z ]+/)?.[0]}'`, evidence: await L.SHOT(S, "rep-insurance-sort-" + label.replace(/\W+/g, "").slice(0, 14)), impact: "usability", repro: `Choose ${label}.` }); };
    await sortCheck("Sort: Value (low → high)", (a, b) => a <= b, valueOf);
    await sortCheck("Sort: Value (high → low)", (a, b) => a >= b, valueOf);
    await sortCheck("Sort: Title (A → Z)", (a, b) => String(a).localeCompare(String(b)) <= 0, (c) => c[hdr.indexOf("Title")]);
    const gainOf = (c) => { const g = c[hdr.indexOf("Change")]; return g === "—" ? -Infinity : Number(g.replace(/[^0-9.-]/g, "")) * (g.startsWith("-") ? 1 : 1); };
    await sortCheck("Sort: Change (high → low)", (a, b) => a >= b, gainOf);
    // photos toggle
    const hasPhoto = () => S.evaluate("[...document.querySelectorAll('table thead th')].some((th) => th.textContent.trim() === 'Photo')");
    const before = await hasPhoto();
    await clickEl(S, `[...document.querySelectorAll('input[type=checkbox]')].find((c) => c.closest('label') && /Include photos/.test(c.closest('label').textContent))`, { js: true }); await sleep(500);
    const after = await hasPhoto();
    R.check(before && !after, { page: RI, control: "Include photos", expected: "Photo column removed when unticked", actual: `before ${before}, after ${after}`, evidence: "", impact: "usability", repro: "Untick Include photos." });
    // links + print
    const hrefs = await S.evaluate("[...document.querySelectorAll('main a')].map((a) => a.textContent.trim() + '=>' + a.getAttribute('href'))");
    await clickEl(S, `[...document.querySelectorAll('button')].find((b) => /Print \\/ Save PDF/.test(b.textContent))`, { js: true }); await sleep(400);
    R.check((await S.look()).print === 1, { page: RI, control: "Print / Save PDF", expected: "Calls print once (stub)", actual: `print calls ${(await S.look()).print}`, evidence: "", impact: "usability", repro: "Click." });
    await clickEl(S, `[...document.querySelectorAll('main a')].find((a) => /Open Exhibitions/.test(a.textContent))`, { js: true }); await S.waitFor("location.pathname !== '/reports/insurance'", 15000); await sleep(1500);
    const exPath = await S.path();
    R.check(exPath === "/museum", { page: RI, control: "'Open Exhibitions' link", expected: "Opens Exhibitions (/museum)", actual: `Opens ${exPath} (the Vault); the same label on /portfolio/insurance. ${hrefs.join(" | ")}`, evidence: await L.SHOT(S, "rep-open-exhibitions"), impact: "misleading result", repro: "Click 'Open Exhibitions' on /reports/insurance." });
    await S.visit("/reports/insurance"); await S.waitFor("document.querySelector('main a')", 30000); await sleep(1500);
    await clickEl(S, `[...document.querySelectorAll('main a')].find((a) => /Back to Portfolio/.test(a.textContent))`, { js: true }); await S.waitFor("location.pathname === '/portfolio'", 15000).catch(() => {});
    R.check((await S.path()).startsWith("/portfolio"), { page: RI, control: "Back to Portfolio", expected: "Goes to /portfolio (Insights)", actual: await S.path(), evidence: "", impact: "usability", repro: "Click." });
    // print media
    await S.visit("/reports/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 90000); await sleep(2000);
    await S.send("Emulation.setEmulatedMedia", { media: "print" }); await sleep(600);
    const pm = await S.evaluate(`({ noprint: [...document.querySelectorAll('.no-print')].every((e) => getComputedStyle(e).display === 'none'), topnav: [...document.querySelectorAll('[class*=TopNav], header, .fixed.top-0')].filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 20).length })`);
    const shotP = await L.SHOT(S, "rep-insurance-print-media");
    await S.send("Emulation.setEmulatedMedia", { media: "" });
    R.check(pm.noprint, { page: RI + " | print media", control: "Insurance report print layout", expected: "Controls hidden; only the report prints", actual: `.no-print hidden: ${pm.noprint}; site top bar still visible in print: ${pm.topnav > 0}`, evidence: shotP, impact: "usability", repro: "Emulate print media." });

    // ================= /portfolio/insurance
    const PI = "/portfolio/insurance | owner, Personal, 26 owned + 5 sold";
    await S.visit("/portfolio/insurance"); await sleep(3500);
    t = await L.mainText(S); rows = await tbl();
    const pc = t.match(/Stated value: (\$[\d,]+)(\*?) Purchase cost: (\$[\d,]+) Unrealized change: ([+-]?\$[\d,]+|—) On (\d+) of (\d+) items/);
    R.check(pc && pc[1] === money(expVal) && pc[3] === money(expCost) && Number(pc[5]) === E.gainN && rows.length === owned.length, { page: PI, control: "Inventory Schedule totals and rows", expected: `${owned.length} rows, stated ${money(expVal)}*, cost ${money(expCost)}, change on ${E.gainN} items`, actual: `${pc ? pc[0] : t.slice(0, 160)}; rows ${rows.length}`, evidence: await L.SHOT(S, "port-insurance"), impact: "misleading result", repro: "Recompute." });
    const badP = [];
    for (const r of owned) { const c = rows.find((x) => x[0].startsWith(r.title)); if (!c) { badP.push(r.title + " missing"); continue; } const want = money(amt(r)) + (ghost(r) ? "*" : ""); if (c[4] !== want) badP.push(`${r.title.slice(0, 12)} ${c[4]} vs ${want}`); }
    R.check(badP.length === 0, { page: PI, control: "Row values", expected: "Value matches the stated value (* if purchase-based)", actual: badP.slice(0, 5).join("; ") || "all rows match", evidence: "", impact: "misleading result", repro: "Compare." });
    await clickEl(S, `[...document.querySelectorAll('button')].find((b) => /Print \\/ Save PDF/.test(b.textContent))`, { js: true }); await sleep(400);
    R.check((await S.look()).print === 1, { page: PI, control: "Print / Save PDF", expected: "Calls print", actual: `print calls ${(await S.look()).print}`, evidence: "", impact: "usability", repro: "Click." });
    await clickEl(S, `[...document.querySelectorAll('main a')].find((a) => /Open Exhibitions/.test(a.textContent))`, { js: true }); await S.waitFor("location.pathname !== '/portfolio/insurance'", 15000); await sleep(1000);
    R.check((await S.path()) === "/museum", { page: PI, control: "'Open Exhibitions' link", expected: "Opens Exhibitions", actual: await S.path(), evidence: "", impact: "misleading result", repro: "Click." });

    // ================= /reports/weekly
    const WK = "/reports/weekly | owner, Personal, 26 owned + 5 sold + 1 supply";
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 3", 90000); await sleep(1500);
    await S.visit("/reports/weekly"); await sleep(3500);
    t = await L.mainText(S); const shotW = await L.SHOT(S, "rep-weekly");
    const sold = all.filter((r) => r.status === "SOLD"); const soldSum = sold.reduce((s, r) => s + (num(r.sold_price) || 0), 0);
    const forSale = all.filter((r) => r.status === "FOR_SALE").length; const pub = all.filter((r) => r.is_public === true).length;
    const wv = t.match(/VAULT VALUE (\$[\d,]+) (\d+) items you own\. Purchase cost (\$[\d,]+)/i);
    const w = { sold: t.match(/SOLD RECORDED (\d+) (\$[\d,]+) sold proceeds/i), fs: t.match(/FOR SALE (\d+)/i), pub: t.match(/PUBLIC ITEMS (\d+)/i), news: t.match(/NEW THIS WEEK (\d+)/i), stale: t.match(/STALE VALUES (\d+)/i) };
    R.check(wv && wv[1] === money(E.filled) && Number(wv[2]) === E.count && w.sold && Number(w.sold[1]) === sold.length && w.sold[2] === money(soldSum) && Number(w.fs[1]) === forSale && Number(w.pub[1]) === pub, { page: WK, control: "Weekly report stat cards (Vault Value, Sold Recorded, For Sale, Public Items)", expected: `Vault value ${money(E.filled)} on ${E.count} items; Sold ${sold.length} / ${money(soldSum)}; For Sale ${forSale}; Public ${pub}`, actual: `${wv && wv[0]} | sold ${w.sold && w.sold[0]} | for sale ${w.fs && w.fs[1]} | public ${w.pub && w.pub[1]}`, evidence: shotW, impact: "misleading result", repro: "Compare to records." });
    const created7 = all.filter((r) => r.status !== "WISHLIST" && Number(r.created_at) >= Date.now() - 7 * 86400e3);
    R.check(w.news && Number(w.news[1]) === created7.filter((r) => !isSupply(r)).length, { page: WK, control: "New This Week count", expected: `Collectible items added in the last 7 days: ${created7.filter((r) => !isSupply(r)).length} (supplies are not collection items elsewhere in the app)`, actual: `${w.news && w.news[1]} (counts the supply box too: ${created7.length})`, evidence: shotW, impact: "misleading result", repro: "Add a Supplies & Display item, open the weekly report." });
    const gapExpected = all.filter((r) => r.status !== "WISHLIST").filter((r) => { const photo = !!(r.image_front_url || r.image_back_url || (r.images_json || []).length); return !(photo && amt(r) > 0 && X.explicit(r) && (r.notes || r.cert_number || r.serial_number || r.storage_location)); });
    const gap = (t.match(/Insurance report \((\d+)\)/i) || [])[1];
    const tabGap = coll_count(all, isSupply) - all.filter((r) => !isSupply(r)).filter((r) => { const photo = !!(r.image_front_url || (r.images_json || []).length); const price = num(r.purchase_price); const ident = [r.grade, r.cert_number, r.serial_number, r.number, r.subtitle].some((v) => typeof v === "string" && v.trim()); return photo && X.basis(r).b === "explicit" && price !== null && price > 0 && ident; }).length;
    R.check(Number(gap) === tabGap, { page: WK, control: "'Insurance report (N)' action count vs the Insurance tab", expected: `The same number of items still needing documentation as the Insurance tab (${tabGap} need review)`, actual: `Weekly report says ${gap}; Insurance tab says ${tabGap} (different checklist: weekly asks photo + value + notes/cert/serial/storage; the tab asks photo + value + price + identity; weekly counts sold and supply items)`, evidence: shotW, impact: "misleading result", repro: "Compare 'Insurance report (N)' with Documentation readiness." });
    // links
    const wl = [["Capture", "/capture"], ["Vault", "/vault"], ["Import", "/vault/import"], ["Insurance Report", "/reports/insurance"], ["For Sale Prep", "/vault/for-sale"]];
    for (const [lab, want] of wl) {
      await S.visit("/reports/weekly"); await sleep(2000);
      await clickEl(S, `[...document.querySelectorAll('main a')].find((a) => a.textContent.trim() === ${JSON.stringify(lab)})`, { js: true });
      await S.waitFor("location.pathname !== '/reports/weekly'", 15000).catch(() => {}); await sleep(1200);
      R.check((await S.path()).split("?")[0] === want, { page: WK, control: `Link '${lab}'`, expected: `Opens ${want}`, actual: await S.path(), evidence: "", impact: "blocked workflow", repro: `Click ${lab}.` });
    }
    await S.visit("/reports/weekly"); await sleep(2000);
    const itemHref = await S.evaluate("[...document.querySelectorAll('main a[href^=\"/vault/item/\"]')].map((a) => a.getAttribute('href'))[0]");
    await clickEl(S, `document.querySelector('main a[href^="/vault/item/"]')`, { js: true }); await S.waitFor("location.pathname.startsWith('/vault/item/')", 15000).catch(() => {}); await sleep(2500);
    R.check((await S.path()) === itemHref && /QA|Album|Sold|Supply/.test(await S.text()), { page: WK, control: "Item row in a list (opens the item)", expected: "Opens that item", actual: `${await S.path()} (${itemHref})`, evidence: "", impact: "blocked workflow", repro: "Click an item row on the weekly report." });
    R.nt({ page: WK, control: "Entry points to /reports/weekly", expected: "n/a", actual: "No link anywhere in the app points to /reports/weekly (searched the source and the signed-in crawl); the page is reachable only by typing the address. Its own text calls it 'a local-first weekly report foundation'. Recorded as an improvement note.", evidence: "", impact: "improvement", repro: "Search the app for a link to the weekly report." });
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
function coll_count(all, isSupply) { return all.filter((r) => !isSupply(r)).length; }
