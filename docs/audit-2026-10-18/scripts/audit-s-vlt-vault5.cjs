// VLT suite 8: /vault with the empty Business profile, one item, load failures (refused / offline), and phone 390 (browser-emulated).
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, ids, stats, admin, blockRest, offline, typeInto, PAGE_SEARCH, touchSwipe } = X; const r = R("VLT");
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
(async () => {
  const m = X.man(); const P = m.personalId, B = m.businessId, st = m.stamp;
  const bid = `qa_vlt_${st}_b1`;
  const allP = await X.rows(P); const listedP = allP.filter((x) => !X.isSold(x));
  await admin.from("vault_items").delete().eq("id", bid);
  await admin.from("vault_items").delete().eq("id", `qa_vlt_${st}_mvb1`); // the throwaway row moved to Business by suite 6
  const bAll = (await admin.from("vault_items").select("id").eq("profile_id", B)).data;
  const BS = await X.session("business");
  try {
    // ---------- Business: empty
    await BS.visit("/vault"); const t = squash(await BS.text());
    const links = await BS.evaluate("[...document.querySelectorAll('main a, main button')].map((a) => (a.innerText || '').replace(/\\s+/g, ' ').trim() + '|' + (a.getAttribute('href') || '')).filter((x) => /Scan your first|Quick Add|Add manually|Import/.test(x))");
    r.check(bAll.length === 0 && /Your vault is empty/.test(t) && !/QA Album/.test(t) && links.length >= 3, { page: "/vault | owner, Business, 0 items", control: "Empty Business vault", expected: "States the vault is empty with Scan your first item / Quick Add / Add manually / Import, and none of the Personal items", actual: `${(/Your vault is empty[^.]*\./.exec(t) || ["no empty message"])[0]} | ${JSON.stringify(links)}`, evidence: await BS.jshot("vlt-vault-business-empty"), impact: "misleading result", repro: "Switch to the Business profile; open /vault" });
    const cards = await stats(BS);
    r.check(cards.itemsCard === "0" && cards.totalValue === "$0", { page: "/vault | owner, Business, 0 items", control: "Summary cards on an empty vault", expected: "Items 0, Total value $0, no filters pressed incorrectly", actual: JSON.stringify({ items: cards.itemsCard, tv: cards.totalValue, doc: cards.docReady + "/" + cards.docOf, rev: cards.needsReview }), impact: "misleading result", repro: "open /vault empty" });
    const hasViewToggle = await BS.evaluate("[...document.querySelectorAll('button')].some((b) => /^(Wall|Gallery|Flip)$/.test(b.innerText.trim()))");
    r.pass({ page: "/vault | owner, Business, 0 items", control: "View toggles (Wall/Gallery/Flip) on an empty vault", expected: "(observation) hidden while there are no items", actual: `visible: ${hasViewToggle}`, impact: "none", repro: "inspect" });
    // controls on empty page: Search, chips, Tools
    await typeInto(BS, PAGE_SEARCH, "anything"); const t2 = squash(await BS.text());
    r.check(/Your vault is empty|No items match/i.test(t2), { page: "/vault | owner, Business, 0 items", control: "Search on an empty vault", expected: "Still an empty-state message (no crash, no stale Personal items)", actual: t2.slice(t2.indexOf("Filters") >= 0 ? t2.indexOf("Filters") : 600, 900), impact: "usability", repro: "type in Search" });
    for (const p of ["/vault/print", "/vault/readiness", "/vault/halls", "/vault/frames", "/vault/sync", "/vault/sports"]) {
      await BS.visit(p); const x = squash(await BS.text()); const leak = /QA Album|QA VLT|QA Sold/.test(x);
      r.check(!leak, { page: `${p} | owner, Business, 0 items`, control: "Empty Business profile: no Personal data on the page", expected: "No Personal items appear", actual: `${x.slice(x.indexOf("Level 1") >= 0 ? x.indexOf("Level 1") : 40, 260)}${leak ? " <<LEAK>>" : ""}`, evidence: leak ? await BS.jshot("vlt-leak-" + p.split("/").pop()) : "", impact: "privacy/data loss", repro: `Business profile; open ${p}` });
    }
    await BS.visit("/vault/halls"); const hx = squash(await BS.text());
    r.check(/Your halls are empty/.test(hx), { page: "/vault/halls | owner, Business, 0 items", control: "Halls with an empty vault", expected: "'Your halls are empty' with Add your first item", actual: hx.slice(hx.indexOf("Halls"), hx.indexOf("Halls") + 260), evidence: await BS.jshot("vlt-halls-business-empty"), impact: "usability", repro: "Business; /vault/halls" });
    await BS.visit("/vault/print"); const px = squash(await BS.text());
    r.check(!/TOTAL ITEMS 0/.test(px) || /no items|empty/i.test(px), { page: "/vault/print | owner, Business, 0 items", control: "Collection report of an empty vault", expected: "An empty-state sentence, not a report with zeros", actual: px.slice(px.indexOf("Save as PDF"), px.indexOf("Save as PDF") + 200), evidence: await BS.jshot("vlt-print-empty"), impact: "improvement", repro: "Business; /vault/print" });
    // ---------- Business: one item
    const ins = await admin.from("vault_items").insert({ id: bid, profile_id: B, title: "QA VLT Single Business Item", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", status: "COLLECTION", is_public: false, created_at: Date.now(), purchase_price: 40, current_value: 100 });
    if (ins.error) throw new Error(ins.error.message);
    await BS.visit("/vault"); const one = await stats(BS); const oneIds = await ids(BS); const t3 = squash(await BS.text());
    r.check(oneIds.length === 1 && one.itemsCard === "1" && one.totalValue === "$100" && /1 universe\b/.test(t3) && !/1 universes/.test(t3), { page: "/vault | owner, Business, 1 item (cost $40, value $100)", control: "One-item Vault", expected: "1 tile; Items 1 ('1 universe', singular); Total value $100; +$60", actual: JSON.stringify({ tiles: oneIds.length, items: one.itemsCard, tv: one.totalValue, gain: one.gainLine, universeWord: (/\d+ universes?/.exec(t3) || [""])[0] }), evidence: await BS.jshot("vlt-vault-business-one"), impact: "misleading result", repro: "Business with one item; open /vault" });
    await X.setMode(BS, "Flip"); const fl = /(\d+) \/ (\d+)/.exec(squash(await BS.text()));
    r.check(!!fl && fl[0] === "1 / 1", { page: "/vault | owner, Business, 1 item", control: "Flip with one item", expected: "'1 / 1'", actual: fl && fl[0], impact: "usability", repro: "Flip" });
    await BS.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await BS.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await sleep(800);
    const fl2 = /(\d+) \/ (\d+)/.exec(squash(await BS.text()));
    r.check(!!fl2 && fl2[1] === "1", { page: "/vault | owner, Business, 1 item", control: "Flip: Right arrow at the last card", expected: "Stays on 1 / 1 (no blank card)", actual: fl2 && fl2[0], impact: "usability", repro: "ArrowRight on a single card" });
    await X.setMode(BS, "Wall");
  } finally { await admin.from("vault_items").delete().eq("id", bid); await BS.close(); }

  // ---------- load failures on /vault
  const F = await X.session("owner");
  try {
    await F.visit("/robots.txt"); await blockRest(F, true); await F.go("/vault");
    let tx = ""; let t = 0; for (; t < 40; t++) { await sleep(1000); tx = squash(await F.text()); if (/COULD NOT LOAD|couldn.t load|Your vault is empty|No items match|QA Album/i.test(tx)) break; }
    r.check(/COULD NOT LOAD|couldn.t load/i.test(tx) && !/Your vault is empty/.test(tx), { page: "/vault | owner, Personal, 44 records, data connection refused, nothing saved on this device", control: "Vault when the cloud refuses (503)", expected: "'We couldn't load your vault' with Retry; never 'Your vault is empty'", actual: `after ${t}s: ${tx.slice(tx.indexOf("Items For Sale") >= 0 ? tx.indexOf("Items For Sale") : 200, 520)}`, evidence: await F.jshot("vlt-vault-refused"), impact: "misleading result", repro: "Fresh browser; refuse supabase REST; open /vault" });
    const zeros = await stats(F);
    r.check(!(zeros.itemsCard === "0" && zeros.totalValue === "$0"), { page: "/vault | owner, Personal, 44 records, data connection refused, nothing saved on this device", control: "Summary cards and universe counts while the load has failed", expected: "While the page says it could not load, it does not also show $0 / 0 items / 0% as if those were the figures", actual: JSON.stringify({ items: zeros.itemsCard, tv: zeros.totalValue, doc: zeros.docReady + "/" + zeros.docOf, chips: zeros.chips.slice(0, 3) }), evidence: "shots/vlt-vault-refused.jpg", impact: "misleading result", repro: "Fresh browser; refuse supabase REST; open /vault; read the cards above the error" });
    const retry = await F.evaluate("[...document.querySelectorAll('button')].some((b) => /^(Retry|Try again)$/.test(b.textContent.trim()))");
    r.check(retry, { page: "/vault | refused connection", control: "Vault load-error 'Retry'", expected: "A Retry button", actual: String(retry), impact: "usability", repro: "same" });
    await blockRest(F, false); await clickEl(F, "[...document.querySelectorAll('button')].find((b) => /^(Retry|Try again)$/.test(b.textContent.trim()))", { js: true }); await sleep(3000); await F.settle({ max: 40000 });
    const rec = (await ids(F)).length;
    r.check(rec === listedP.length, { page: "/vault | after the connection is back", control: "Vault 'Retry' recovers", expected: `Retry loads the ${listedP.length} items`, actual: `${rec} items`, evidence: await F.jshot("vlt-vault-retry"), impact: "blocked workflow", repro: "Restore connection; Retry" });
    // saved copy, refused
    await blockRest(F, true, ["*supabase.co/rest/v1/vault_items*"]); await F.visit("/vault");
    for (let i = 0; i < 30 && !(await F.evaluate("!!document.querySelector('[data-testid=stale-notice]')")); i++) await sleep(1000);
    const notice = await F.evaluate("(document.querySelector('[data-testid=stale-notice]') || {}).innerText"); const n2 = (await ids(F)).length;
    r.check(!!notice && /couldn.t refresh/i.test(notice) && n2 === listedP.length, { page: "/vault | saved copy, vault_items refused", control: "Vault stale-data notice", expected: "Saved items shown with 'Showing saved data - couldn't refresh' and Retry", actual: `notice='${notice}'; items ${n2}`, evidence: await F.jshot("vlt-vault-stale"), impact: "misleading result", repro: "Load /vault, refuse vault_items, reload" });
    await blockRest(F, false);
    // all REST refused with saved copy
    await blockRest(F, true); await F.visit("/vault"); await sleep(8000);
    const n3 = (await ids(F)).length; const notice3 = await F.evaluate("(document.querySelector('[data-testid=stale-notice]') || {}).innerText"); const t3 = squash(await F.text());
    r.check(n3 > 0 && !!notice3, { page: "/vault | saved copy, ALL data requests refused", control: "Vault with saved copy when every request fails", expected: "Saved items with the 'couldn't refresh' notice (not a silent copy)", actual: `items ${n3}; notice='${notice3}'; sync line: ${(/Could not reach the cloud[^.]*\./.exec(t3) || ["none"])[0]}`, evidence: await F.jshot("vlt-vault-allrefused"), impact: "misleading result", repro: "Load /vault, refuse all supabase REST, reload" });
    await blockRest(F, false);
    await offline(F, true); await F.go("/vault"); await sleep(6000); const off = squash(await F.text());
    r.check(!/Your vault is empty/.test(off), { page: "/vault | offline (browser-emulated) reload", control: "Vault reload while offline", expected: "Saved Vault or an explicit offline page; never an empty-vault message", actual: off.slice(0, 200), evidence: await F.jshot("vlt-vault-offline"), impact: "misleading result", repro: "Offline; reload /vault" });
    await offline(F, false);
  } finally { await F.close(); }

  if (process.env.SKIP_PHONE) return;
  // ---------- phone 390 (browser-emulated)
  const M = await X.session("owner", { width: 390, height: 844, mobile: true });
  try {
    await M.visit("/vault"); await M.evaluate("localStorage.setItem('vltd_vault_view_mode', 'gallery'); true"); await M.visit("/vault");
    const ov = await M.evaluate("document.documentElement.scrollWidth <= innerWidth");
    r.check(ov, { page: "/vault | owner, Personal, 390px phone (browser-emulated)", control: "Vault layout at 390px", expected: "No sideways page scroll", actual: `fits: ${ov}`, evidence: await M.jshot("vlt-vault-390", { full: true }), impact: "usability", repro: "Open /vault at 390" });
    const s390 = await stats(M);
    r.check(s390.itemsCard === String(X.expected(allP).count), { page: "/vault | owner, Personal, 390 phone", control: "Summary cards at 390px", expected: `Items ${X.expected(allP).count}`, actual: JSON.stringify({ items: s390.itemsCard, tv: s390.totalValue }), impact: "misleading result", repro: "read cards" });
    await M.evaluate("window.scrollTo(0,0); true");
    const cw = await M.evaluate("(() => { const s = [...document.querySelectorAll('main div')].find((d) => /overflow-x-auto/.test(d.className) && d.querySelector('button[aria-label*=\"Show the complete list\"]')); return s ? { sw: s.scrollWidth, cw: s.clientWidth } : null; })()");
    if (cw && cw.sw > cw.cw + 10) {
      const bx = await M.evaluate("(() => { const s = [...document.querySelectorAll('main div')].find((d) => /overflow-x-auto/.test(d.className) && d.querySelector('button[aria-label*=\"Show the complete list\"]')); s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
      await sleep(400); const l0 = await M.evaluate("[...document.querySelectorAll('main div')].find((d) => /overflow-x-auto/.test(d.className) && d.querySelector('button[aria-label*=\"Show the complete list\"]')).scrollLeft");
      await touchSwipe(M, bx.x + 100, bx.y, bx.x - 120, bx.y); await sleep(900);
      const l1 = await M.evaluate("[...document.querySelectorAll('main div')].find((d) => /overflow-x-auto/.test(d.className) && d.querySelector('button[aria-label*=\"Show the complete list\"]')).scrollLeft");
      r.check(l1 > l0 + 40, { page: "/vault | owner, Personal, 390 phone (browser-emulated)", control: "Summary-card strip swipe (browser-emulated touch)", expected: "Swiping the card strip scrolls it sideways to the other cards", actual: `scrollLeft ${l0} -> ${l1}; strip ${cw.sw}px wide in ${cw.cw}px`, evidence: await M.jshot("vlt-vault-390-cards"), impact: "usability", repro: "Swipe left on the cards (emulated)" });
    }
    await typeInto(M, PAGE_SEARCH, "zebra"); const g390 = await ids(M);
    r.check(g390.length === 1, { page: "/vault | owner, Personal, 390 phone", control: "Search at 390px", expected: "1 result", actual: String(g390.length), evidence: await M.jshot("vlt-vault-390-search"), impact: "usability", repro: "search zebra" });
    await typeInto(M, PAGE_SEARCH, "");
    const cols = await M.evaluate("(() => { const g = [...document.querySelectorAll('main div.grid')].find((d) => d.querySelector('a[href^=\"/vault/item/\"]') && getComputedStyle(d).gridTemplateColumns.split(' ').length >= 2); return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : null; })()");
    r.check(cols === 2, { page: "/vault | owner, Personal, 390 phone", control: "Gallery columns at 390px", expected: "2 columns", actual: String(cols), impact: "cosmetic", repro: "Gallery at 390" });
    const tap = await M.evaluate("(() => { const bad = []; for (const b of document.querySelectorAll('main button, main a')) { const r = b.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && r.height < 32 && /^(Wall|Gallery|Flip|Graded|Uncategorized|Show Sold|Advanced)/.test((b.innerText || '').trim())) bad.push((b.innerText || '').trim().slice(0, 14) + ' ' + Math.round(r.height)); } return bad; })()");
    r.check(tap.length === 0, { page: "/vault | owner, Personal, 390 phone", control: "Tap targets of the filter pills at 390px", expected: "Each at least 32px tall (44px preferred)", actual: JSON.stringify(tap), impact: "usability", repro: "measure the pills" });
    await clickEl(M, 'button[aria-label="Select items"]'); await sleep(500);
    r.check((await M.evaluate("document.querySelectorAll('button[aria-label^=\"Select \"]').length")) > 20, { page: "/vault | owner, Personal, 390 phone", control: "Select items at 390px", expected: "Selection mode works on a phone", actual: String(await M.evaluate("document.querySelectorAll('button[aria-label^=\"Select \"]').length")), impact: "usability", repro: "tap select icon" });
  } finally { await M.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
