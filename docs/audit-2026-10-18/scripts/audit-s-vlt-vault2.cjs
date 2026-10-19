// VLT suite 5: /vault sort options, review filters, summary-card destinations, Back/Forward/reload/direct URL on filtered views (owner, Personal, 1440).
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, money, ids, setMode, typeInto, PAGE_SEARCH, stats, gaps, counted } = X; const r = R("VLT");
const PG = (x) => `/vault | owner, Personal, 36 listed (34 counted) + 6 sold | ${x}`;
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const uni = (u) => String(u).toUpperCase();
const sortSel = async (S, value) => { await S.evaluate(`(() => { const s = document.querySelector('select[aria-label="Sort the vault"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await sleep(1100); };
const clickBtn = (S, re, scope = "main") => clickEl(S, `[...document.querySelectorAll('${scope} button')].find((b) => ${re}.test(b.innerText.replace(/\\s+/g, ' ').trim()) || ${re}.test(b.getAttribute('aria-label') || ''))`, { js: true });
(async () => {
  const m = X.man(); const P = m.personalId;
  const all = await X.rows(P); const listed = all.filter((x) => !X.isSold(x)); const cnt = listed.filter(counted);
  const by = Object.fromEntries(all.map((x) => [x.id, x])); const idOf = (rows) => rows.map((x) => x.id);
  const E = X.expected(all);
  const S = await X.session("owner");
  try {
    await S.visit("/vault"); await S.evaluate("localStorage.removeItem('vltd_value_mode_v1'); localStorage.setItem('vltd_vault_view_mode', 'gallery'); sessionStorage.clear(); true"); await S.visit("/vault");
    // ---------- sort (Gallery view)
    const order = async () => (await ids(S));
    await sortSel(S, "newest"); let o = await order();
    const wantNewest = [...listed].sort((a, b) => Number(b.created_at) - Number(a.created_at)).map((x) => x.id);
    r.check(JSON.stringify(o) === JSON.stringify(wantNewest), { page: PG("Gallery"), control: "Sort: Newest", expected: "Items by created-at, newest first", actual: `first 5: ${o.slice(0, 5).join(",")}; expected first 5: ${wantNewest.slice(0, 5).join(",")}`, evidence: await S.jshot("vlt-vault-sort-newest"), impact: "misleading result", repro: "Gallery view; Sort = Newest" });
    await sortSel(S, "title"); o = await order();
    const wantTitle = [...listed].sort((a, b) => String(a.title).localeCompare(String(b.title))).map((x) => x.id);
    r.check(JSON.stringify(o) === JSON.stringify(wantTitle), { page: PG("Gallery"), control: "Sort: Title A-Z", expected: "Alphabetical by title (localeCompare)", actual: `first 5: ${o.slice(0, 5).map((i) => by[i]?.title.slice(0, 22)).join(" | ")}`, impact: "misleading result", repro: "Sort = Title A-Z" });
    const effv = (x) => X.effective(x);
    for (const [mode, label, cmp] of [["value_desc", "Value ↓", (a, b) => effv(b) - effv(a)], ["value_asc", "Value ↑", (a, b) => effv(a) - effv(b)]]) {
      await sortSel(S, mode); o = await order(); const vals = o.map((i) => effv(by[i]));
      const mono = vals.every((v, i) => i === 0 || (mode === "value_desc" ? vals[i - 1] >= v : vals[i - 1] <= v));
      r.check(mono && o.length === listed.length, { page: PG("Gallery"), control: `Sort: ${label}`, expected: "Ordered by the item's value (explicit valuation; items without a valuation count as $0)", actual: `values in order (first 8): ${vals.slice(0, 8).join(", ")}; monotonic=${mono}`, evidence: await S.jshot("vlt-vault-sort-" + mode), impact: "misleading result", repro: `Sort = ${label}` });
    }
    // Value sort vs what the page shows as the item's value: unpriced items show 'at purchase cost' amounts elsewhere
    await sortSel(S, "value_desc"); o = await order();
    const topUnpriced = o.slice(0, 40).findIndex((i) => X.basis(by[i]).b === "purchase");
    const lastPriced = o.map((i) => X.basis(by[i]).b).lastIndexOf("explicit");
    r.pass({ page: PG("Gallery"), control: "Sort: Value ↓ treatment of unpriced items", expected: "(observation) Items valued only at purchase cost sort as $0, i.e. after every explicitly valued item and mixed with missing-value items, although Home, the Vault card and Insights count them at purchase cost", actual: `first purchase-cost-only item at position ${topUnpriced + 1}; last explicitly valued item at position ${lastPriced + 1}`, evidence: "", impact: "improvement", repro: "Sort = Value ↓ and compare with the Total Value basis" });
    // Gain sorts
    await sortSel(S, "gain_desc"); o = await order();
    const rule = (x) => { const g = X.explicit(x) && X.cost(x) > 0 ? X.effective(x) - X.cost(x) : null; return g; };
    const noCostId = "qa_vlt_" + m.stamp + "_novcost", zeroId = "qa_vlt_" + m.stamp + "_zerov";
    const topMeasured = [...listed].filter((x) => rule(x) !== null).sort((a, b) => rule(b) - rule(a))[0];
    r.check(o[0] === topMeasured.id, { page: PG("Gallery"), control: "Sort: Gain ↓", expected: `Biggest measured gain first (${topMeasured.title}, ${rule(topMeasured) >= 0 ? "+" : "-"}$${Math.abs(rule(topMeasured))}); an item with a value but NO recorded cost is not a measurable gain anywhere else in the app ('not counted: without a recorded cost')`, actual: `first: ${by[o[0]]?.title} (value ${by[o[0]]?.current_value}, cost ${by[o[0]]?.purchase_price}); position of 'QA VLT Value Without Cost' ($5,000 value, no cost) = ${o.indexOf(noCostId) + 1}`, evidence: await S.jshot("vlt-vault-sort-gain-desc"), impact: "misleading result", repro: "Sort = Gain ↓ with an item that has a value but no cost" });
    await sortSel(S, "gain_asc"); o = await order();
    const lowestMeasured = [...listed].filter((x) => rule(x) !== null).sort((a, b) => rule(a) - rule(b))[0];
    r.check(o[0] === lowestMeasured.id, { page: PG("Gallery"), control: "Sort: Gain ↑", expected: `Biggest measured loss first (${lowestMeasured.title}, -$${Math.abs(rule(lowestMeasured))}; an explicit $0 value on a $30 cost is a -$30 change per the app's own rule)`, actual: `first: ${by[o[0]]?.title}; 'QA VLT Explicit Zero Value' (-$30) is at position ${o.indexOf(zeroId) + 1}`, evidence: await S.jshot("vlt-vault-sort-gain-asc"), impact: "misleading result", repro: "Sort = Gain ↑ with an item valued $0 that cost $30" });
    // sort pill and clear
    const pl = (await stats(S)).filterPills;
    r.check(pl.some((p) => /^Sorted: gain asc/.test(p)), { page: PG("Gallery"), control: "Active-filter pill for the sort", expected: "A 'Sorted: ...' pill appears when sort is not Newest and removes it", actual: JSON.stringify(pl), impact: "usability", repro: "Choose Gain ↑" });
    await clickEl(S, "[...document.querySelectorAll('section[aria-label=\"Active filters\"] button')].find((b) => /Sorted:/.test(b.textContent))", { js: true }); await sleep(900);
    r.check((await S.evaluate("document.querySelector('select[aria-label=\"Sort the vault\"]').value")) === "newest", { page: PG("Gallery"), control: "Sorted pill (x)", expected: "Back to Newest", actual: await S.evaluate("document.querySelector('select[aria-label=\"Sort the vault\"]').value"), impact: "usability", repro: "Click the Sorted pill" });
    // Wall: Newest vs A-Z and flat sorts
    await setMode(S, "Wall"); await sortSel(S, "newest"); o = await order();
    const sameAsNewest = JSON.stringify(o) === JSON.stringify(wantNewest);
    r.check(sameAsNewest, { page: PG("Wall"), control: "Sort: Newest (Wall view, the default view)", expected: "Newest first, like the other views (the page's default Sort is 'Newest')", actual: `Wall order = A-Z by title: ${JSON.stringify(o) === JSON.stringify(wantTitle)}; first 5: ${o.slice(0, 5).map((i) => by[i]?.title.slice(0, 18)).join(" | ")}`, evidence: await S.jshot("vlt-vault-wall-newest"), impact: "misleading result", repro: "Open /vault (Wall); Sort says Newest; compare order with Gallery" });
    await sortSel(S, "value_desc"); o = await order(); const wv = o.map((i) => effv(by[i]));
    r.check(wv.every((v, i) => i === 0 || wv[i - 1] >= v) && (await S.evaluate("/Ordered by the Sort you chose/.test(document.body.innerText)")), { page: PG("Wall"), control: "Sort: Value ↓ (Wall)", expected: "One run ordered by value with the A-Z letters replaced by 'Ordered by the Sort you chose'", actual: `values: ${wv.slice(0, 6).join(",")}`, evidence: await S.jshot("vlt-vault-wall-valuesort"), impact: "misleading result", repro: "Wall view; Sort = Value ↓" });
    await sortSel(S, "title"); o = await order();
    r.check(JSON.stringify(o) === JSON.stringify(wantTitle), { page: PG("Wall"), control: "Sort: Title A-Z (Wall)", expected: "A-Z", actual: o.slice(0, 4).map((i) => by[i]?.title.slice(0, 18)).join(" | "), impact: "misleading result", repro: "Wall; Sort = Title A-Z" });
    await sortSel(S, "newest");

    // ---------- review filters
    await S.visit("/vault"); await setMode(S, "Gallery");
    const docIds = cnt.filter((x) => gaps(x).length === 0).map((x) => x.id), needIds = cnt.filter((x) => gaps(x).length > 0).map((x) => x.id);
    await clickBtn(S, /^Documentation complete/); await sleep(1100);
    let got = await ids(S); let txt = squash(await S.text());
    r.check(same(got, docIds) && /Documentation complete: 1 of 34 items/.test(txt), { page: PG("Documentation Complete card"), control: "Documentation Complete (summary card)", expected: `List narrows to the ${docIds.length} item(s) with photo+value+cost+identity (QA VLT Complete Record) and says 'Documentation complete: 1 of 34 items'`, actual: `shown ${got.length}: ${got.join(",")}; heading=${(/Documentation complete: [^.]*?items/.exec(txt) || [""])[0]}`, evidence: await S.jshot("vlt-vault-review-doc"), impact: "misleading result", repro: "Click the Documentation Complete card" });
    const links = await S.evaluate("[...document.querySelectorAll('section[aria-label=\"Active filters\"] a')].map((a) => a.innerText.trim() + ' -> ' + a.getAttribute('href'))");
    r.check(links.some((l) => /\/insurance$/.test(l)) && links.some((l) => /\/portfolio\/insurance$/.test(l)), { page: PG("Documentation Complete card"), control: "'Open the insurance packet' / 'Insurance summary' links", expected: "Links to /insurance and /portfolio/insurance", actual: JSON.stringify(links), impact: "blocked workflow", repro: "Documentation Complete card; read links under the checklist" });
    await clickBtn(S, /^Documentation complete/); await sleep(900);
    r.check(same(await ids(S), idOf(listed)), { page: PG("Documentation Complete card"), control: "Documentation Complete card pressed again", expected: "Toggles off: full list", actual: String((await ids(S)).length), impact: "usability", repro: "Click the card twice" });
    await clickBtn(S, /^Needs review/); await sleep(1100);
    got = await ids(S);
    r.check(same(got, needIds), { page: PG("Needs Review card"), control: "Needs Review (summary card)", expected: `${needIds.length} counted items that miss part of the checklist (supply and wishlist items excluded)`, actual: `shown ${got.length}`, evidence: await S.jshot("vlt-vault-review-needs"), impact: "misleading result", repro: "Click Needs Review" });
    const exp = { photo: 0, value: 0, cost: 0, cost_zero: 0, identity: 0 }; for (const x of cnt) for (const g of gaps(x)) exp[g]++;
    const pillTxt = await S.evaluate("[...document.querySelectorAll('section[aria-label=\"Active filters\"] button')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim())");
    const GP = { photo: "Missing photo", value: "Needs valuation", cost: "Purchase price not recorded", cost_zero: "Purchase price recorded as $0", identity: "Missing identifying detail" };
    r.check(Object.entries(GP).every(([g, lab]) => pillTxt.includes(`${lab} ${exp[g]}`)), { page: PG("Needs Review card"), control: "Missing-piece pills and their counts", expected: Object.entries(GP).map(([g, l]) => `${l} ${exp[g]}`).join("; "), actual: JSON.stringify(pillTxt.filter((t) => /Missing|Needs valuation|Purchase price/.test(t))), impact: "misleading result", repro: "Needs Review card; read the pills" });
    for (const [g, lab] of Object.entries(GP)) {
      await clickBtn(S, new RegExp("^" + lab.replace(/[$]/g, "\\$") + " \\d+$"), "section[aria-label=\"Active filters\"]"); await sleep(1000);
      const want = cnt.filter((x) => gaps(x).includes(g)).map((x) => x.id); const gt = await ids(S); const t2 = squash(await S.text());
      r.check(same(gt, want) && (want.length === 0 ? /No items match/.test(t2) : true), { page: PG("Needs Review > " + lab), control: `Gap pill '${lab}'`, expected: `Narrows to the ${want.length} items with that gap`, actual: `shown ${gt.length}${want.length === 0 ? "; message: " + /No items match "[^"]*"\./.exec(t2) : ""}`, evidence: gt.length === want.length ? "" : await S.jshot("vlt-vault-gap-" + g), impact: "misleading result", repro: `Needs Review > ${lab}` });
      await clickBtn(S, new RegExp("^" + lab.replace(/[$]/g, "\\$") + " \\d+$"), "section[aria-label=\"Active filters\"]"); await sleep(600);
    }
    await clickBtn(S, /^Back to all items$/); await sleep(900);
    r.check(same(await ids(S), idOf(listed)), { page: PG("Needs Review"), control: "Back to all items", expected: "Full list", actual: String((await ids(S)).length), impact: "usability", repro: "Needs Review > Back to all items" });
    // combined with a universe
    await clickBtn(S, /^Sports \d+$/); await sleep(800); await clickBtn(S, /^Needs review/); await sleep(1000);
    const wantC = cnt.filter((x) => uni(x.universe) === "SPORTS" && gaps(x).length > 0).map((x) => x.id);
    const s9 = await stats(S);
    r.check(same(await ids(S), wantC), { page: PG("Sports + Needs Review"), control: "Review filter combined with a universe chip", expected: `${wantC.length} Sports items needing review`, actual: `shown ${(await ids(S)).length}; cards: items ${s9.itemsCard}, review ${s9.needsReview}`, impact: "misleading result", repro: "Click Sports then Needs Review" });
    await clickBtn(S, /^Clear all$/); await sleep(700);
    // URL param entry
    await S.visit("/vault?review=needs_review&gap=photo");
    const urlWant = cnt.filter((x) => gaps(x).includes("photo")).map((x) => x.id);
    r.check(same(await ids(S), urlWant), { page: PG("direct URL ?review=needs_review&gap=photo"), control: "Direct URL /vault?review=needs_review&gap=photo", expected: `Opens the list of ${urlWant.length} items missing a photo`, actual: `shown ${(await ids(S)).length}; pills ${JSON.stringify((await stats(S)).filterPills).slice(0, 100)}`, evidence: await S.jshot("vlt-vault-url-gap"), impact: "blocked workflow", repro: "Open /vault?review=needs_review&gap=photo" });
    await S.visit("/vault?review=insurance_ready");
    r.check(same(await ids(S), docIds), { page: PG("direct URL ?review=insurance_ready"), control: "Direct URL /vault?review=insurance_ready", expected: "Opens the documentation-complete list", actual: String((await ids(S)).length), impact: "blocked workflow", repro: "Open /vault?review=insurance_ready" });

    // ---------- summary card destinations
    await S.visit("/vault");
    await clickEl(S, "main a[href=\"/portfolio\"][aria-label^=\"Total value\"]"); await sleep(2500); await S.settle({ max: 20000 });
    r.check((await S.path()) === "/portfolio", { page: PG("Total Value card"), control: "Total Value card / 'Financial breakdown'", expected: "Opens /portfolio (Insights)", actual: await S.path(), impact: "blocked workflow", repro: "Click the Total Value card" });
    await S.visit("/vault"); await typeInto(S, PAGE_SEARCH, "zebra"); await clickBtn(S, /items\. Show the complete list/); await sleep(900);
    const clr = await S.evaluate(`document.querySelector('input[aria-label="Search the vault"]').value`);
    r.check(clr === "" && same(await ids(S), idOf(listed)), { page: PG("Items card"), control: "Items card (with a search active)", expected: "Clears every filter and shows the complete list", actual: `search='${clr}'; shown ${(await ids(S)).length}`, impact: "usability", repro: "Search; click the Items card" });
    // value mode from the Vault card
    await clickBtn(S, /^Show priced only$/); await sleep(900);
    const sp = await stats(S); const pricedSum = cnt.filter((x) => X.basis(x).b === "explicit").reduce((a, x) => a + X.effective(x), 0);
    r.check(sp.totalValue === money(pricedSum), { page: PG("Total Value card"), control: "Show priced only (Vault card)", expected: `Total value becomes ${money(pricedSum)} (explicit valuations only)`, actual: sp.totalValue, evidence: await S.jshot("vlt-vault-priced-only"), impact: "misleading result", repro: "Click Show priced only on the Total Value card" });
    await S.visit("/dashboard"); const hv = squash(await S.text());
    r.check(hv.includes(money(pricedSum)) && /Include unpriced/.test(hv), { page: "/dashboard after Vault card toggle", control: "Value basis shared with Home", expected: "Home also shows the priced-only value and 'Include unpriced' (one shared setting)", actual: (/ESTIMATED VALUE [^A-Z]*/.exec(hv) || [""])[0], impact: "misleading result", repro: "Toggle on Vault, open Home" });
    await S.visit("/vault"); await clickBtn(S, /^Include unpriced$/); await sleep(800);
    r.check((await stats(S)).totalValue === money(E.filled), { page: PG("Total Value card"), control: "Include unpriced (Vault card)", expected: `Back to ${money(E.filled)}`, actual: (await stats(S)).totalValue, impact: "misleading result", repro: "Click Include unpriced" });

    // ---------- persistence: reload, Back/Forward
    await S.visit("/vault"); await typeInto(S, PAGE_SEARCH, "sports"); await clickBtn(S, /^Graded \d+$/); await sleep(900);
    const before = await ids(S);
    await S.visit("/vault");
    const afterReload = await ids(S); const vAfter = await S.evaluate(`document.querySelector('input[aria-label="Search the vault"]').value`);
    r.check(vAfter === "" && afterReload.length === listed.length, { page: PG("filtered, then reload"), control: "Reload on a filtered list", expected: "(observation) Filters live in the page only: reload returns to the full list", actual: `before reload ${before.length} items, after reload ${afterReload.length}; search='${vAfter}'; URL unchanged '/vault'`, impact: "improvement", repro: "Filter; press reload" });
    await typeInto(S, PAGE_SEARCH, "zebra"); const f1 = await ids(S);
    await clickEl(S, `a[href="/vault/item/${f1[0]}"]`); await sleep(2500); await S.settle({ max: 20000 });
    const itemPath = await S.path();
    await S.evaluate("history.back(); true"); await sleep(3000); await S.settle({ max: 20000 }); await sleep(1500);
    const backIds = await ids(S); const backSearch = await S.evaluate(`document.querySelector('input[aria-label="Search the vault"]')?.value`);
    r.check(itemPath === "/vault/item/" + f1[0] && (await S.path()) === "/vault" && backSearch === "zebra" && same(backIds, f1), { page: PG("filtered, open item, Back"), control: "Browser Back from an item", expected: "Back returns to /vault with the same search ('zebra') and list", actual: `item path ${itemPath}; after Back path ${await S.path()}, search='${backSearch}', shown ${backIds.length}`, evidence: await S.jshot("vlt-vault-back"), impact: "usability", repro: "Search zebra; open the item; press Back" });
    await S.evaluate("history.forward(); true"); await sleep(2500); await S.settle({ max: 20000 });
    r.check((await S.path()) === itemPath, { page: PG("Forward"), control: "Browser Forward", expected: "Forward returns to the item", actual: await S.path(), impact: "usability", repro: "After Back, press Forward" });
    // Show sold + sold item open
  } finally { console.log("errors", S.consoleErrors.slice(0, 4)); await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
