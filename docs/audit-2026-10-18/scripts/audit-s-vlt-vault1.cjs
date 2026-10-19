// VLT suite 4: /vault baseline numbers, view modes, search, universe chips, Graded/Uncategorized/Show Sold (owner, Personal, desktop 1440).
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, mouseClick, money, ids, setMode, typeInto, PAGE_SEARCH, stats, searchText, gaps, counted, isSupply } = X; const r = R("VLT");
const PG = (x) => `/vault | owner, Personal, 34 listed + sold, mixed universes | ${x}`;
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const uni = (u) => (["POP_CULTURE", "SPORTS", "TCG", "MUSIC", "JEWELRY_APPAREL", "GAMES", "BUILT_BOTANY", "MISC", "AUTOMOTIVE", "ART"].includes(String(u).toUpperCase()) ? String(u).toUpperCase() : "MISC");
const LABEL = { POP_CULTURE: "Pop Culture", SPORTS: "Sports", TCG: "TCG & Non Sport Card", MUSIC: "Music", GAMES: "Games", MISC: "Misc", ART: "Art", JEWELRY_APPAREL: "Jewelry & Apparel", BUILT_BOTANY: "Built, Botany & Bar", AUTOMOTIVE: "Gears & Gasoline" };

(async () => {
  const m = X.man(); const P = m.personalId;
  const all = await X.rows(P);
  const listed = all.filter((x) => !X.isSold(x)); // what the list shows (supplies and wishlist included)
  const soldRows = all.filter(X.isSold);
  const cnt = all.filter(counted);
  const E = X.expected(all);
  const idOf = (rows) => rows.map((x) => x.id);
  const S = await X.session("owner");
  try {
    await S.evaluate("1"); await S.visit("/vault");
    await S.evaluate("localStorage.removeItem('vltd_value_mode_v1'); localStorage.removeItem('vltd_vault_view_mode'); sessionStorage.clear(); true"); await S.visit("/vault");

    // ---------- A. baseline numbers
    let st = await stats(S); const wallIds = await ids(S);
    const byU = {}; for (const x of listed) byU[uni(x.universe)] = (byU[uni(x.universe)] || 0) + 1;
    const expChips = Object.entries(byU).map(([k, n]) => `${LABEL[k]} ${n}`).sort();
    const gapsAll = cnt.map(gaps); const ready = gapsAll.filter((g) => g.length === 0).length;
    r.check(same(wallIds, idOf(listed)), { page: PG("Wall, default"), control: "Item list (Wall view)", expected: `Lists every owned/listed item, sold excluded: ${listed.length} (incl. 1 supply and 1 wishlist item)`, actual: `shown ${wallIds.length}; missing=${idOf(listed).filter((i) => !wallIds.includes(i)).join(",")}; extra=${wallIds.filter((i) => !idOf(listed).includes(i)).join(",")}`, evidence: await S.jshot("vlt-vault-baseline-1440"), impact: "misleading result", repro: "Open /vault" });
    r.check(String(st.itemsCard) === String(E.count) && st.totalValue === money(E.filled) && String(st.docReady) === String(ready) && String(st.needsReview) === String(E.count - ready), { page: PG("summary cards"), control: "Summary cards (Total Value, Items, Documentation Complete, Needs Review)", expected: `Total value ${money(E.filled)}, Items ${E.count}, Documentation complete ${ready} of ${E.count}, Needs review ${E.count - ready} (counts exclude the supply and wishlist items and sold)`, actual: JSON.stringify({ tv: st.totalValue, items: st.itemsCard, doc: st.docReady + "/" + st.docOf, rev: st.needsReview }), evidence: "shots/vlt-vault-baseline-1440.jpg", impact: "misleading result", repro: "Open /vault; compare cards with values computed from vault_items" });
    const gainExp = `${E.gain >= 0 ? "+" : "-"}${money(E.gain)}`;
    r.check(st.gainLine === gainExp && new RegExp(`Change on ${E.gainN} of ${E.count} items · cost basis ${money(E.costBase).replace("$", "\\$")}`).test(st.gainBasis || ""), { page: PG("summary cards"), control: "Total Value card gain line", expected: `${gainExp}, 'Change on ${E.gainN} of ${E.count} items · cost basis ${money(E.costBase)}'`, actual: `${st.gainLine} | ${st.gainBasis}`, impact: "misleading result", repro: "Read the Total Value card" });
    r.check(same(st.chips, expChips), { page: PG("universe chips"), control: "Universe chips and their counts", expected: `One chip per universe holding items, counts equal the records: ${expChips.join("; ")}`, actual: JSON.stringify(st.chips), impact: "misleading result", repro: "Read the chip row under the header" });
    r.pass({ page: PG("card vs list counts"), control: "Items card (32) vs chip total / Wall '34 items'", expected: "(observation) Items card counts only collection items; the list, the chips and the Wall count also include the supply item and wishlist item", actual: `Items card=${st.itemsCard}; chips sum=${st.chips.reduce((a, c) => a + Number(c.split(" ").pop()), 0)}; Wall count text=${st.wallCount}; nothing on the page says supplies/wishlist are listed but not counted`, evidence: "shots/vlt-vault-baseline-1440.jpg", impact: "improvement", repro: "Compare the Items card with the Wall count" });
    const pr = await S.evaluate("(() => { const t = document.body.innerText; return { priv: /(\\d+) private/.exec(t)?.[1], pub: /(\\d+) public/.exec(t)?.[1] }; })()");
    const expPub = listed.filter((x) => x.is_public === true).length;
    r.check(String(pr.pub) === String(expPub) && String(pr.priv) === String(listed.length - expPub), { page: PG("header chips"), control: "'N private' / 'N public' chips", expected: `${listed.length - expPub} private, ${expPub} public (non-sold items)`, actual: JSON.stringify(pr), impact: "misleading result", repro: "Read the chips above the universe row" });

    // ---------- B. view modes
    await X.setMode(S, "Gallery"); const gIds = await ids(S);
    r.check(same(gIds, idOf(listed)), { page: PG("Gallery"), control: "View: Gallery", expected: "Same items as the Wall", actual: `shown ${gIds.length}/${listed.length}`, evidence: await S.jshot("vlt-vault-gallery-1440"), impact: "misleading result", repro: "Click Gallery" });
    const stored = await S.evaluate("Object.entries(localStorage).filter(([k]) => /view/i.test(k) && /vault/i.test(k)).map(([k, v]) => k + '=' + v)");
    await S.visit("/vault"); const afterReload = await S.evaluate("[...document.querySelectorAll('button[aria-pressed=true]')].map((b) => b.textContent.trim()).filter((t) => /^(Wall|Gallery|Flip)$/.test(t))");
    r.check(afterReload[0] === "Gallery", { page: PG("reload"), control: "View mode remembered", expected: "Gallery stays selected after reload", actual: JSON.stringify({ stored, afterReload }), impact: "usability", repro: "Choose Gallery; reload" });
    await X.setMode(S, "Flip");
    const fl = squash(await S.text()); const fm = /(\d+) \/ (\d+)/.exec(fl);
    r.check(!!fm && Number(fm[2]) === listed.length, { page: PG("Flip"), control: "View: Flip", expected: `Card stack of all ${listed.length} items ('1 / ${listed.length}')`, actual: fm ? fm[0] : fl.slice(-300), evidence: await S.jshot("vlt-vault-flip-1440"), impact: "misleading result", repro: "Click Flip" });
    await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await sleep(900);
    const fm2 = /(\d+) \/ (\d+)/.exec(squash(await S.text()));
    r.check(!!fm2 && fm2[1] === "2", { page: PG("Flip"), control: "Flip keyboard Right arrow", expected: "Advances to '2 / N'", actual: fm2 && fm2[0], impact: "usability", repro: "In Flip, press ArrowRight" });
    await X.setMode(S, "Wall");

    // ---------- C. page search
    const queries = [
      ["zebra", "title and purchase source, case-insensitive"], ["ZEBRA", "upper case"], ["  zebra  ", "surrounding spaces"], ["needle42", "notes"], ["shelf q", "storage location"], ["CGC 9.8", "grade"],
      ["cert-vlt-777", "cert number"], ["#42", "number"], ["variant cover", "subtitle"], ["Zebra Mart", "purchase source"], ["sports", "category/universe words"], ["(50%)", "special characters"], ["O'Brien", "apostrophe"], ["\\", "backslash"], ["[x]", "brackets"], ["nonexistentxyz", "no match"],
    ];
    for (const [q, what] of queries) {
      await X.typeInto(S, PAGE_SEARCH, q);
      const want = listed.filter((x) => searchText(x).includes(q.trim().toLowerCase()));
      const got = await ids(S); const s2 = await stats(S);
      const ok = same(got, idOf(want)) && (want.length > 0 || s2.emptyState);
      r.check(ok, { page: PG("Wall, page search"), control: `Search the vault: '${q}' (${what})`, expected: `Shows exactly the ${want.length} items whose text fields contain it (${want.slice(0, 3).map((x) => x.title.slice(0, 22)).join("; ")})${want.length === 0 ? " and an explicit no-match message" : ""}`, actual: `shown ${got.length}: ${got.slice(0, 4).join(",")}; empty-message=${s2.emptyState}; filter pills=${JSON.stringify(s2.filterPills).slice(0, 120)}`, evidence: ok ? "" : await S.jshot("vlt-vault-search-" + q.replace(/\W+/g, "") ), impact: "misleading result", repro: `Open /vault; type '${q}' in Search the vault` });
    }
    // the summary cards follow the search (their numbers describe the filtered list)
    await X.typeInto(S, PAGE_SEARCH, "zebra"); const sz = await stats(S);
    r.check(sz.itemsCard === "1" && sz.pressedItems === "false", { page: PG("search 'zebra'"), control: "Summary cards while searching", expected: "Items card shows 1 and is no longer 'pressed' (filters active)", actual: JSON.stringify({ items: sz.itemsCard, pressed: sz.pressedItems, tv: sz.totalValue }), impact: "misleading result", repro: "Search zebra" });
    // clear chips
    const pills = (await stats(S)).filterPills;
    r.check(pills.some((p) => /Search “zebra”/.test(p)) && pills.includes("Clear all"), { page: PG("search 'zebra'"), control: "Active-filter pills", expected: "A 'Search “zebra”' pill and 'Clear all' appear", actual: JSON.stringify(pills), impact: "usability", repro: "Search zebra" });
    await clickEl(S, "[...document.querySelectorAll('section[aria-label=\"Active filters\"] button')].find((b) => /Search “zebra”/.test(b.textContent))", { js: true }); await sleep(800);
    const afterX = await ids(S); const val = await S.evaluate(`document.querySelector('input[aria-label="Search the vault"]').value`);
    r.check(val === "" && same(afterX, idOf(listed)), { page: PG("search 'zebra'"), control: "Search pill (x) clears the search", expected: "Search box emptied, full list back", actual: `value='${val}' shown=${afterX.length}`, impact: "usability", repro: "Click the search pill" });
    await X.typeInto(S, PAGE_SEARCH, "zebra"); await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Clear all')", { js: true }); await sleep(800);
    r.check((await S.evaluate(`document.querySelector('input[aria-label="Search the vault"]').value`)) === "" && same(await ids(S), idOf(listed)), { page: PG("search 'zebra'"), control: "Clear all", expected: "Empties search and all filters", actual: "list restored: " + same(await ids(S), idOf(listed)), impact: "usability", repro: "Search, click Clear all" });
    // no-match message + button
    await X.typeInto(S, PAGE_SEARCH, "nonexistentxyz");
    const nm = squash(await S.text());
    r.check(/No items match/i.test(nm), { page: PG("search no match, Wall"), control: "No-match message (Wall view)", expected: "States that no items match (not a blank page, not 'Your vault is empty')", actual: nm.slice(nm.indexOf("Filters") >= 0 ? nm.indexOf("Filters") : 700, 1300), evidence: await S.jshot("vlt-vault-nomatch-wall"), impact: "misleading result", repro: "Search nonexistentxyz in Wall view" });
    await X.setMode(S, "Gallery"); const nmg = squash(await S.text());
    const btn = await S.evaluate("[...document.querySelectorAll('button')].some((b) => /^Clear Filters$/.test(b.textContent.trim()))");
    r.check(/No items match your current filters/.test(nmg) && btn && !/Your vault is empty/.test(nmg), { page: PG("search no match, Gallery"), control: "No-match message + 'Clear Filters' (Gallery view)", expected: "'No items match your current filters' with a Clear Filters button", actual: `${/No items match your current filters/.test(nmg)}; button=${btn}`, evidence: await S.jshot("vlt-vault-nomatch-gallery"), impact: "misleading result", repro: "Gallery view; search nonexistentxyz" });
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => /^Clear Filters$/.test(b.textContent.trim()))", { js: true }); await sleep(900);
    r.check(same(await ids(S), idOf(listed)), { page: PG("search no match, Gallery"), control: "Clear Filters (empty state)", expected: "Restores the whole list", actual: String((await ids(S)).length), impact: "usability", repro: "Click Clear Filters" });

    // ---------- E. universe chips + Graded + Uncategorized + Show Sold
    for (const [key, lab] of [["SPORTS", "Sports"], ["POP_CULTURE", "Pop Culture"], ["ART", "Art"], ["MISC", "Misc"]]) {
      await clickEl(S, `[...document.querySelectorAll('main button')].find((b) => /^${lab.replace(/[&]/g, "\\&")} \\d+$/.test(b.innerText.replace(/\\s+/g, ' ').trim()))`, { js: true }); await sleep(1000);
      const want = listed.filter((x) => uni(x.universe) === key); const got = await ids(S); const s2 = await stats(S);
      const wantCounted = want.filter(counted).length;
      r.check(same(got, idOf(want)) && String(s2.itemsCard) === String(wantCounted), { page: PG(`universe chip ${lab}`), control: `Universe chip '${lab}'`, expected: `Lists only the ${want.length} ${lab} items (${want.map((x) => x.title.slice(0, 18)).slice(0, 3).join("; ")}...) and the Items card follows (${wantCounted})`, actual: `shown ${got.length}; card ${s2.itemsCard}; pills ${JSON.stringify(s2.filterPills).slice(0, 100)}`, evidence: await S.jshot("vlt-vault-universe-" + key), impact: "misleading result", repro: `Click ${lab} chip` });
    }
    // category chips inside a universe
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /^Sports \\d+$/.test(b.innerText.replace(/\\s+/g, ' ').trim()))", { js: true }); await sleep(900);
    const catBtns = await S.evaluate("[...document.querySelectorAll('main button')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim()).filter((t) => /Sports Cards|Memorabilia|Autograph|Jersey/i.test(t))");
    r.pass({ page: PG("Sports universe"), control: "Category chips inside a universe", expected: "(observation) category chips appear under the toolbar once a universe is chosen", actual: JSON.stringify(catBtns), impact: "none", repro: "Choose Sports" });
    if (catBtns.length) {
      await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /Sports Cards/i.test(b.innerText))", { js: true }); await sleep(900);
      const sportsCards = listed.filter((x) => uni(x.universe) === "SPORTS" && /sports cards/i.test(x.category_label || ""));
      const got = await ids(S);
      r.check(same(got, idOf(sportsCards)), { page: PG("Sports > Sports Cards"), control: "Category chip 'Sports Cards'", expected: `Only the ${sportsCards.length} Sports Cards items`, actual: `shown ${got.length}`, evidence: await S.jshot("vlt-vault-category"), impact: "misleading result", repro: "Sports, then Sports Cards" });
    }
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'All')", { js: true }); await sleep(900);
    r.check(same(await ids(S), idOf(listed)), { page: PG("universe All"), control: "Universe chip 'All'", expected: "Back to every item (category filter cleared with the universe)", actual: String((await ids(S)).length), impact: "usability", repro: "Choose Sports, then All" });
    // Graded
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /^Graded \\d+$/.test(b.innerText.replace(/\\s+/g, ' ').trim()))", { js: true }); await sleep(900);
    const gradedWant = listed.filter((x) => x.grade);
    r.check(same(await ids(S), idOf(gradedWant)), { page: PG("Graded"), control: "Graded (pill)", expected: `Only the ${gradedWant.length} graded items: ${gradedWant.map((x) => x.grade).join(", ")}`, actual: `shown ${(await ids(S)).length}`, evidence: await S.jshot("vlt-vault-graded"), impact: "misleading result", repro: "Click Graded" });
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /^Graded \\d+$/.test(b.innerText.replace(/\\s+/g, ' ').trim()))", { js: true }); await sleep(700);
    // Uncategorized (count 0)
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /^Uncategorized \\d+$/.test(b.innerText.replace(/\\s+/g, ' ').trim()))", { js: true }); await sleep(900);
    const uncText = squash(await S.text()); const uncIds = await ids(S);
    r.check(uncIds.length === 0 && /No items match/i.test(uncText), { page: PG("Uncategorized (0)"), control: "Uncategorized (pill showing 0)", expected: "With no uncategorized items, it shows an explicit 'No items match' (not an empty page)", actual: `shown ${uncIds.length}; message=${/No items match/i.test(uncText)}`, evidence: await S.jshot("vlt-vault-uncategorized"), impact: "misleading result", repro: "Click Uncategorized" });
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /^Uncategorized \\d+$/.test(b.innerText.replace(/\\s+/g, ' ').trim()))", { js: true }); await sleep(700);
    // Show Sold
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /^Show Sold \\d+$/.test(b.innerText.replace(/\\s+/g, ' ').trim()))", { js: true }); await sleep(1200);
    const withSold = await ids(S); const s3 = await stats(S);
    r.check(same(withSold, idOf(all.filter((x) => X.isSold(x) || !X.isSold(x)))) && String(s3.itemsCard) === String(E.count), { page: PG("Show Sold"), control: "Show Sold (pill)", expected: `Adds the ${soldRows.length} sold items to the list (${all.length} shown) while the Items card stays ${E.count} (sold are never counted)`, actual: `shown ${withSold.length}; card ${s3.itemsCard}; pills ${JSON.stringify(s3.filterPills).slice(0, 90)}`, evidence: await S.jshot("vlt-vault-show-sold"), impact: "misleading result", repro: "Click Show Sold" });
    const soldBadge = await S.evaluate("[...document.querySelectorAll('main a[href*=\"sold=1\"]')].length");
    r.check(soldBadge === soldRows.length, { page: PG("Show Sold"), control: "Show Sold: sold items link to their sold record", expected: `${soldRows.length} tiles link with ?sold=1`, actual: String(soldBadge), impact: "usability", repro: "Show Sold; inspect tiles" });
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /^Show Sold \\d+$/.test(b.innerText.replace(/\\s+/g, ' ').trim()))", { js: true }); await sleep(700);
    // Show menu (universe chip visibility)
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Show' && b.getAttribute('aria-haspopup'))", { js: true }); await sleep(600);
    const menu = await S.evaluate("[...document.querySelectorAll('label')].filter((l) => l.querySelector('input[type=checkbox]')).map((l) => l.innerText.replace(/\\s+/g, ' ').trim())");
    r.check(menu.length === 10, { page: PG("Show menu"), control: "Show (universe titles) menu", expected: "Lists all 10 universes with their counts as checkboxes", actual: JSON.stringify(menu), evidence: await S.jshot("vlt-vault-show-menu"), impact: "usability", repro: "Click Show" });
    await clickEl(S, "[...document.querySelectorAll('label')].find((l) => /^Art\\b/.test(l.innerText.trim())).querySelector('input')", { js: true }); await sleep(800);
    const chips2 = (await stats(S)).chips;
    r.check(!chips2.some((c) => /^Art /.test(c)), { page: PG("Show menu"), control: "Show menu: untick Art", expected: "The Art chip disappears from the row (items remain in 'All')", actual: JSON.stringify(chips2), impact: "usability", repro: "Show > untick Art" });
    await S.visit("/vault"); const chips3 = (await stats(S)).chips;
    r.check(!chips3.some((c) => /^Art /.test(c)), { page: PG("Show menu, reload"), control: "Show menu choice remembered", expected: "Art chip still hidden after reload", actual: JSON.stringify(chips3), impact: "usability", repro: "Untick Art; reload" });
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Show' && b.getAttribute('aria-haspopup'))", { js: true }); await sleep(500);
    await clickEl(S, "[...document.querySelectorAll('label')].find((l) => /^Art\\b/.test(l.innerText.trim())).querySelector('input')", { js: true }); await sleep(900);
    r.check((await stats(S)).chips.some((c) => /^Art /.test(c)), { page: PG("Show menu"), control: "Show menu: tick Art again", expected: "Art chip returns", actual: JSON.stringify((await stats(S)).chips), impact: "usability", repro: "Show > tick Art" });
  } finally { console.log("errors", S.consoleErrors.slice(0, 4)); await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
