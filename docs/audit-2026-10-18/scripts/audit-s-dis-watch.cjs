// DIS suite W: /watchlist (+ /wishlist redirect) as the owner (Personal), Business profile, an unrelated viewer and a signed-out visitor. Seeded by audit-s-dis-seed2.cjs.
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin, man } = C;
const r = R("DIS");
const m = man(); const P = m.personalId; const st = m.stamp;
const PG = "/watchlist | owner, Personal, 4 wishlist + 3 watched";
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: "/watchlist", control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-watch.cjs" }); } };
const cards = (S) => S.evaluate(`[...document.querySelectorAll('main button')].filter((b) => /Current Value/.test(b.innerText) && /Target Price/.test(b.innerText)).map((b) => { const t = b.innerText.replace(/\\s+/g, ' '); const title = b.querySelector('.font-serif')?.textContent.trim(); const cv = (t.match(/Current Value (\\$[\\d,]+|--)/) || [])[1]; const tp = (t.match(/Target Price (\\$[\\d,]+|--)/) || [])[1]; return { title, cv, tp, kind: b.querySelector('span')?.textContent.trim(), text: t }; })`);
const num = (s) => (s && s !== "--" ? Number(s.replace(/[$,]/g, "")) : 0);
const chips = (S) => S.evaluate(`Object.fromEntries([...document.querySelectorAll('main button')].map((b) => b.textContent.trim()).filter((t) => /^(All|Wishlist|Items|Exhibitions|Price Alerts|Undecided) \\(\\d+\\)$/.test(t)).map((t) => { const m = t.match(/^(.*) \\((\\d+)\\)$/); return [m[1], Number(m[2])]; }))`);
const aside = (S) => S.evaluate("(() => { const a = document.querySelector('aside'); return a ? { title: a.querySelector('h2')?.textContent.trim(), text: a.innerText.replace(/\\s+/g, ' ') } : null; })()");
const selectCard = (S, title) => C.click(S, `([...document.querySelectorAll('main button')].find((b) => /Current Value/.test(b.innerText) && b.querySelector('.font-serif')?.textContent.trim() === ${JSON.stringify(title)}))`);
const gridText = (S) => S.evaluate("(() => { const a = [...document.querySelectorAll('main a')].find((x) => /Add Watch/.test(x.textContent)); const g = a && a.parentElement; return g ? g.innerText.replace(/\s+/g, ' ').replace(/Add Watch Track items or exhibitions you.re watching\./, '').trim() : ''; })()");
const stats = (S) => S.evaluate(`(() => { const t = document.querySelector('main').innerText.replace(/\\s+/g, ' '); const g = (re) => (t.match(re) || [])[1]; return { watching: g(/(\\d+) Watching/), alerts: g(/(\\d+) Alerts active/), value: g(/(\\$[\\d,]+) Watchlist value/), drop: g(/(\\$[\\d,]+) Price drop opps/) }; })()`);

(async () => {
  const S = await C.session("owner");
  await S.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await S.visit("/watchlist"); await sleep(3500);
  const shot0 = await S.jshot("dis-watchlist-owner");

  await section("data", async () => {
    const cs = await cards(S); const ch = await chips(S); const sx = await stats(S);
    r.check(cs.length === 7 && ch.All === 7 && ch.Wishlist === 4 && ch.Items === 7 && ch.Exhibitions === 0 && ch["Price Alerts"] === 4 && ch.Undecided === 1, { page: PG, control: "Watchlist filter chips: counts", expected: "All 7 (4 wishlist + 3 watched), Wishlist 4, Items 7, Exhibitions 0, Undecided 1 (the low-priority wish); Price Alerts = items with a real alert", actual: JSON.stringify(ch) + ` cards=${cs.length}`, evidence: shot0, impact: "misleading result", repro: "Open /watchlist with 4 wishlist and 3 watched rows" });
    const alpha = cs.find((c) => c.title === "QA dis Wish Alpha"); const bravo = cs.find((c) => c.title === "QA dis Wish Bravo"); const a1 = cs.find((c) => c.title === "QA Album 1 - watched");
    r.check(alpha && num(alpha.cv) === 0, { page: PG, control: "Wishlist card: 'Current Value' for a wish with only a target price of $100", expected: "no current value is known, so '--' (a wish has no market value of its own)", actual: `shows Current Value ${alpha && alpha.cv} for target $100 (target x 1.18); Bravo target $2,500 shows ${bravo && bravo.cv}`, evidence: shot0, impact: "misleading result", repro: "Add a wishlist item with target price 100; read its card" });
    r.check(a1 && a1.tp === "--", { page: PG, control: "Watched item card: 'Target Price' for an item whose target the owner never set", expected: "'--' (no target was ever entered)", actual: `value $100 watched item shows Target Price ${a1 && a1.tp} (86% of its value)`, evidence: shot0, impact: "misleading result", repro: "Swipe right on a public item in The Flip; open the Watchlist" });
    const realTotal = 100 + 250; // only the two watched items carry a real (public) value
    r.check(num(sx.value) === realTotal && sx.watching === "7", { page: PG, control: "Watchlist summary strip: 'Watchlist value'", expected: `$${realTotal} (sum of the real values of the watched items: 100 + 250)`, actual: `${sx.value} (includes the invented wishlist 'current values'); watching=${sx.watching}`, evidence: shot0, impact: "misleading result", repro: "Read the summary strip under the cards" });
    r.check(sx.alerts === "0", { page: PG, control: "Summary strip 'Alerts active' / 'Price Alerts' chip", expected: "0: no price alert can be set anywhere on this page", actual: `Alerts active=${sx.alerts}, chip Price Alerts=${ch["Price Alerts"]}; the detail panel says 'Alert Active' for these items`, evidence: shot0, impact: "misleading result", repro: "Open /watchlist; look for how to create an alert" });
    // exhibitions filter always empty
    r.check(ch.Exhibitions === 0, { page: PG, control: "'Exhibitions' filter / pill (with a saved exhibition in Favorites)", expected: "(observation) lists saved exhibitions; nothing on this page ever creates an exhibition entry", actual: "Exhibitions (0) with an exhibition favourited by this account's other pages = always empty", evidence: shot0, impact: "improvement", repro: "Click Exhibitions" });
  });

  await section("order", async () => {
    const cs = await cards(S);
    const added = { "QA dis Wish Charlie": 1, "QA dis Wish Bravo": 2, "QA dis Comic Delta #5": 3, "QA dis Wish Alpha": 5, "QA Album 13 - watched": 10, "QA Album 19 - watched no value": 20, "QA Album 1 - watched": 30 };
    const hrs = cs.map((c) => added[c.title]);
    const ok = hrs.every((h, i) => i === 0 || hrs[i - 1] <= h);
    r.check(ok, { page: PG, control: "Sort: Recently added (default)", expected: "newest first across wishlist and watched items (1h, 2h, 3h, 5h, 10h, 20h, 30h old)", actual: "order shown (hours since added): " + hrs.join(", "), evidence: shot0, impact: "misleading result", repro: "Open /watchlist; compare the 'Added' time of consecutive cards" });
    await C.pick(S, "Sort watchlist", "^Highest value"); await sleep(500);
    const v = (await cards(S)).map((c) => num(c.cv));
    r.check(v.every((x, i) => i === 0 || v[i - 1] >= x), { page: PG, control: "Sort: Highest value", expected: "current values never increase down the list", actual: v.join(", "), evidence: "n/a", impact: "misleading result", repro: "Choose Highest value" });
    await C.pick(S, "Sort watchlist", "^Target price"); await sleep(500);
    const t = (await cards(S)).map((c) => num(c.tp));
    r.check(t.every((x, i) => i === 0 || t[i - 1] >= x), { page: PG, control: "Sort: Target price", expected: "target prices never increase down the list", actual: t.join(", "), evidence: "n/a", impact: "misleading result", repro: "Choose Target price" });
    await C.pick(S, "Sort watchlist", "^Recently added"); await sleep(400);
  });

  await section("filters", async () => {
    await C.clickText(S, "^Wishlist \\(4\\)$", { scope: "main" }); await sleep(500);
    let cs = await cards(S); let ch = await chips(S);
    r.check(cs.length === 4 && cs.every((c) => /QA dis (Wish|Comic)/.test(c.title)), { page: PG, control: "Chip: Wishlist (4)", expected: "only the 4 wishlist entries", actual: cs.map((c) => c.title).join(" | "), evidence: "n/a", impact: "misleading result", repro: "Click Wishlist" });
    await C.clickText(S, "^Undecided \\(1\\)$", { scope: "main" }); await sleep(500);
    cs = await cards(S);
    r.check(cs.length === 1 && cs[0].title === "QA dis Wish Charlie", { page: PG, control: "Chip: Undecided (1)", expected: "the single low-priority wish", actual: cs.map((c) => c.title).join(" | "), evidence: "n/a", impact: "misleading result", repro: "Click Undecided" });
    await C.clickText(S, "^Exhibitions \\(0\\)$", { scope: "main" }); await sleep(500);
    cs = await cards(S); const gx = await gridText(S);
    r.check(cs.length === 0 && /No |nothing|empty|match/i.test(gx), { page: PG, control: "Chip: Exhibitions (0) -> empty result", expected: "an explicit 'nothing here' message (not just a blank grid)", actual: "cards=" + cs.length + "; grid text='" + gx.slice(0, 80) + "'", evidence: await S.jshot("dis-watchlist-exhibitions-empty"), impact: "usability", repro: "Click Exhibitions (0)" });
    await C.clickText(S, "^Price Drops$", { scope: "main" }); await sleep(500);
    cs = await cards(S); const pressed = await S.evaluate("[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Price Drops').getAttribute('aria-pressed')");
    r.check(cs.length === 4 && pressed === "true", { page: PG, control: "Pill: Price Drops", expected: "pill lit; list limited to price-alert entries (4); clicking it again clears the filter", actual: `cards=${cs.length}, aria-pressed=${pressed}`, evidence: "n/a", impact: "misleading result", repro: "Click Price Drops" });
    await C.clickText(S, "^Price Drops$", { scope: "main" }); await sleep(500);
    r.check((await cards(S)).length === 7, { page: PG, control: "Pill: Price Drops (second click)", expected: "filter cleared (7)", actual: String((await cards(S)).length), evidence: "n/a", impact: "usability", repro: "Click Price Drops twice" });
    await C.clickText(S, "^All \\(7\\)$", { scope: "main" }); await sleep(400);
    // search
    await C.typeInto(S, "input[placeholder='Search watchlist...']", "bravo");
    cs = await cards(S);
    r.check(cs.length === 1 && cs[0].title === "QA dis Wish Bravo", { page: PG, control: "Search watchlist...: 'bravo'", expected: "only Bravo", actual: cs.map((c) => c.title).join(" | "), evidence: "n/a", impact: "misleading result", repro: "Type bravo" });
    await C.typeInto(S, "input[placeholder='Search watchlist...']", "PSA 9");
    cs = await cards(S);
    r.check(cs.length === 1 && cs[0].title === "QA Album 1 - watched", { page: PG, control: "Search watchlist...: by grade text 'PSA 9'", expected: "the watched PSA 9 item", actual: cs.map((c) => c.title).join(" | "), evidence: "n/a", impact: "misleading result", repro: "Type PSA 9" });
    await C.typeInto(S, "input[placeholder='Search watchlist...']", "qqzzxx");
    cs = await cards(S); const t2 = await gridText(S);
    r.check(cs.length === 0 && /No (items|results|matches)|nothing matches|no match/i.test(t2), { page: PG, control: "Search watchlist...: no match", expected: "an explicit 'no matches' message", actual: `cards=${cs.length}; grid text='${t2.slice(0, 80)}'`, evidence: await S.jshot("dis-watchlist-nomatch"), impact: "usability", repro: "Type nonsense in the watchlist search" });
    await C.typeInto(S, "input[placeholder='Search watchlist...']", "");
    // view toggle
    await C.click(S, `document.querySelector('button[aria-label="List view"]')`); await sleep(400);
    const cols1 = await S.evaluate("getComputedStyle(document.querySelector('main section .grid.gap-3.mt-4, main section .mt-4.grid')).gridTemplateColumns.split(' ').length");
    const lp = await S.evaluate("document.querySelector('button[aria-label=\"List view\"]').getAttribute('aria-pressed')");
    await C.click(S, `document.querySelector('button[aria-label="Grid view"]')`); await sleep(400);
    const cols2 = await S.evaluate("getComputedStyle(document.querySelector('main section .grid.gap-3.mt-4, main section .mt-4.grid')).gridTemplateColumns.split(' ').length");
    r.check(cols1 === 1 && lp === "true" && cols2 >= 2, { page: PG, control: "List view / Grid view toggle", expected: "list = one column (pressed state follows); grid = two or more columns", actual: `list columns=${cols1} pressed=${lp}; grid columns=${cols2}`, evidence: "n/a", impact: "usability", repro: "Click List view then Grid view" });
  });

  await section("panel", async () => {
    await selectCard(S, "QA dis Wish Bravo"); await sleep(400);
    let a = await aside(S);
    r.check(a && a.title === "QA dis Wish Bravo" && /Current Value \$2,950/.test(a.text) && /\$2,500/.test(a.text), { page: PG, control: "Card click -> detail panel", expected: "panel describes the clicked card (Bravo)", actual: a && a.text.slice(0, 170), evidence: "n/a", impact: "misleading result", repro: "Click a card" });
    // prev / next
    const idx0 = (await cards(S)).findIndex((c) => c.title === "QA dis Wish Bravo");
    await C.click(S, `document.querySelector('aside button[aria-label="Next item"]')`); await sleep(400);
    const a2 = await aside(S); const list = await cards(S);
    r.check(a2.title === list[idx0 + 1].title, { page: PG, control: "Detail panel: Next item", expected: "moves to the next card in the list", actual: `${a2.title} (expected ${list[idx0 + 1].title})`, evidence: "n/a", impact: "usability", repro: "Click Next item" });
    await C.click(S, `document.querySelector('aside button[aria-label="Previous item"]')`); await sleep(400);
    r.check((await aside(S)).title === "QA dis Wish Bravo", { page: PG, control: "Detail panel: Previous item", expected: "moves back", actual: (await aside(S)).title, evidence: "n/a", impact: "usability", repro: "Click Previous" });
    // ends: first card -> previous disabled
    await selectCard(S, list[0].title); await sleep(300);
    const prevDis = await S.evaluate("document.querySelector('aside button[aria-label=\"Previous item\"]').disabled");
    await selectCard(S, list[list.length - 1].title); await sleep(300);
    const nextDis = await S.evaluate("document.querySelector('aside button[aria-label=\"Next item\"]').disabled");
    r.check(prevDis === true && nextDis === true, { page: PG, control: "Detail panel: Previous/Next at the ends", expected: "disabled on the first / last card", actual: `prev disabled on first=${prevDis}; next disabled on last=${nextDis}`, evidence: "n/a", impact: "usability", repro: "Select the first then the last card" });
    // close
    await selectCard(S, "QA dis Wish Bravo"); await sleep(300);
    await C.click(S, `document.querySelector('aside button[aria-label="Close details"]')`); await sleep(500);
    const a3 = await aside(S);
    r.check(a3 === null || a3.title !== list[0].title && false, { page: PG, control: "Detail panel: Close details (X)", expected: "the panel closes", actual: a3 ? `panel still open, now showing '${a3.title}' (the first card)` : "closed", evidence: await S.jshot("dis-watchlist-close-details"), impact: "usability", repro: "Select a card; click X in the panel" });
    // Add Watch tile
    const aw = await C.click(S, `([...document.querySelectorAll('main a')].find((a) => /Add Watch/.test(a.textContent)))`); await sleep(1500);
    const awp = await S.path(); const awt = clean(await S.text()).slice(0, 160);
    r.check(/watch/i.test(awt) && !/\/vault\/add/.test(awp), { page: PG, control: "'+ Add Watch' tile ('Track items or exhibitions you're watching')", expected: "a way to add a watch (a form or a picker for something to watch)", actual: `goes to ${awp}: ${awt}`, evidence: await S.jshot("dis-watchlist-add-watch"), impact: "misleading result", repro: "Click + Add Watch" });
    await S.visit("/watchlist"); await sleep(2500);
  });

  await section("edit", async () => {
    await selectCard(S, "QA dis Wish Alpha"); await sleep(300);
    const getTarget = async () => (await admin.from("wishlist").select("target_price,notes").eq("id", `qa_dis_w1_${st}`).single()).data;
    // set target
    await C.click(S, `document.querySelector('aside button[aria-label="Set target price"]')`); await sleep(300);
    await C.typeInto(S, "aside input[placeholder='Target price']", "150");
    await C.click(S, `([...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Save'))`); await sleep(2500);
    let a = await aside(S); let db = await getTarget();
    r.check(a && /Target Price \$150/.test(a.text) && Number(db.target_price) === 150 && /Target price set to \$150/.test(clean(await S.text())), { page: PG, control: "Target price: pencil -> 150 -> Save", expected: "panel shows $150, toast confirms, database row target_price = 150", actual: `panel: ${a && (a.text.match(/Target Price \S+/) || [])[0]}; db=${db.target_price}`, evidence: "n/a", impact: "data loss", repro: "Select Alpha; pencil; type 150; Save" });
    // cancel keeps
    await C.click(S, `document.querySelector('aside button[aria-label="Set target price"]')`); await sleep(300);
    await C.typeInto(S, "aside input[placeholder='Target price']", "999");
    await C.clickText(S, "^Cancel$", { scope: "aside" }); await sleep(800);
    db = await getTarget();
    r.check(Number(db.target_price) === 150 && /\$150/.test((await aside(S)).text), { page: PG, control: "Target price: Cancel", expected: "leaves $150 untouched", actual: `db=${db.target_price}`, evidence: "n/a", impact: "data loss", repro: "Pencil; type 999; Cancel" });
    // Escape cancels
    await C.click(S, `document.querySelector('aside button[aria-label="Set target price"]')`); await sleep(300);
    await C.typeInto(S, "aside input[placeholder='Target price']", "777");
    await C.key(S, "Escape", "Escape", 27); await sleep(600);
    db = await getTarget();
    r.check(Number(db.target_price) === 150, { page: PG, control: "Target price: Escape key", expected: "cancels the edit", actual: `db=${db.target_price}`, evidence: "n/a", impact: "data loss", repro: "Pencil; type; Escape" });
    // invalid text
    await C.click(S, `document.querySelector('aside button[aria-label="Set target price"]')`); await sleep(300);
    await C.typeInto(S, "aside input[placeholder='Target price']", "abc");
    await C.click(S, `([...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Save'))`); await sleep(500); const tx = clean(await S.text()); await sleep(1800);
    db = await getTarget();
    r.check(Number(db.target_price) === 150 || /valid|number|invalid/i.test(tx), { page: PG, control: "Target price: invalid text 'abc' then Save", expected: "refused with a message (or at least the existing $150 is kept)", actual: `db target=${db.target_price}; toast: ${(tx.match(/Target price (cleared|set to \S+)/) || ["none"])[0]}`, evidence: await S.jshot("dis-watchlist-target-abc"), impact: "data loss", repro: "Pencil; type abc; Save" });
    // put back to 150 then explicit zero
    await C.click(S, `document.querySelector('aside button[aria-label="Set target price"]')`); await sleep(300);
    await C.typeInto(S, "aside input[placeholder='Target price']", "150");
    await C.click(S, `([...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Save'))`); await sleep(2000);
    await C.click(S, `document.querySelector('aside button[aria-label="Set target price"]')`); await sleep(300);
    await C.typeInto(S, "aside input[placeholder='Target price']", "0");
    await C.click(S, `([...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Save'))`); await sleep(500); const t0 = clean(await S.text()); await sleep(1800);
    db = await getTarget();
    r.check(/Target price cleared/.test(t0) && (db.target_price === null || Number(db.target_price) === 0), { page: PG, control: "Target price: explicit 0 then Save", expected: "treated as 'no target' and says so ('Target price cleared')", actual: `db=${db.target_price}; toast cleared=${/Target price cleared/.test(t0)}`, evidence: "n/a", impact: "usability", repro: "Pencil; type 0; Save" });
    // restore 100 for later checks
    await C.click(S, `document.querySelector('aside button[aria-label="Set target price"]')`); await sleep(300);
    await C.typeInto(S, "aside input[placeholder='Target price']", "100");
    await C.click(S, `([...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Save'))`); await sleep(2000);
    // notes
    await C.clickText(S, "^Edit$", { scope: "aside" }); await sleep(300);
    await C.typeInto(S, "aside textarea", "[QA audit] note edited");
    await C.click(S, `([...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Save'))`); await sleep(500); const toastNotes = clean(await S.text()); await sleep(2000);
    db = await getTarget();
    r.check(db.notes === "[QA audit] note edited" && /Notes saved/.test(toastNotes), { page: PG, control: "Notes: Edit -> type -> Save", expected: "toast 'Notes saved' and the database row has the new note", actual: `db notes='${db.notes}'`, evidence: "n/a", impact: "data loss", repro: "Select Alpha; Notes Edit; type; Save" });
    await C.clickText(S, "^Edit$", { scope: "aside" }); await sleep(300);
    await C.typeInto(S, "aside textarea", "SHOULD NOT SAVE");
    await C.clickText(S, "^Cancel$", { scope: "aside" }); await sleep(800);
    db = await getTarget();
    r.check(db.notes === "[QA audit] note edited", { page: PG, control: "Notes: Cancel", expected: "note unchanged", actual: `db notes='${db.notes}'`, evidence: "n/a", impact: "data loss", repro: "Edit; type; Cancel" });
    // reload persists, clean second browser sees it
    const S2 = await C.session("owner");
    await S2.visit("/watchlist"); await sleep(3500);
    const c2 = await cards(S2); const alpha2 = c2.find((c) => c.title === "QA dis Wish Alpha");
    await selectCard(S2, "QA dis Wish Alpha"); await sleep(400); const a2 = await aside(S2);
    r.check(alpha2 && alpha2.tp === "$100" && a2 && /\[QA audit\] note edited/.test(a2.text), { page: PG, control: "Persistence of target price and note in a CLEAN second browser", expected: "target $100 and the edited note are there", actual: `target=${alpha2 && alpha2.tp}; note shown=${a2 && /note edited/.test(a2.text)}`, evidence: "n/a", impact: "data loss", repro: "Edit, then open /watchlist in a fresh browser signed in as the same account" });
    await S2.close();
    // a watched item cannot be edited
    await selectCard(S, "QA Album 1 - watched"); await sleep(300);
    const pencil = await S.evaluate("!!document.querySelector('aside button[aria-label=\"Set target price\"]')");
    const editBtn = await S.evaluate("[...document.querySelectorAll('aside button')].some((b) => b.textContent.trim() === 'Edit')");
    r.check(!pencil && !editBtn, { page: PG, control: "Detail panel for a WATCHED item: target-price pencil and Notes Edit", expected: "(observation) not offered for watched items; Notes show fixed text 'Saved from Discover...'", actual: `pencil=${pencil}, notes edit=${editBtn}; notes text: ${((await aside(S)).text.match(/Notes (.{0,70})/) || [])[1]}`, evidence: "n/a", impact: "improvement", repro: "Select a watched item" });
  });

  await section("actions", async () => {
    await S.visit("/watchlist"); await sleep(3000);
    // Add to Vault on a WATCHED item
    await selectCard(S, "QA Album 19 - watched no value"); await sleep(300);
    const vb4 = (await admin.from("vault_items").select("id").eq("profile_id", P)).data.length;
    await C.clickText(S, "^\\+ Add to Vault$", { scope: "aside" }); await sleep(1500);
    const vb5 = (await admin.from("vault_items").select("id").eq("profile_id", P)).data.length;
    const tt = clean(await S.text());
    r.check(vb5 === vb4 + 1, { page: PG, control: "+ Add to Vault on a WATCHED item", expected: "the item is added to the vault (label promises it)", actual: `vault items ${vb4} -> ${vb5}; message: ${(tt.match(/Open Add Item[^.]*\./) || ["none"])[0]}`, evidence: await S.jshot("dis-watchlist-add-to-vault-watched"), impact: "misleading result", repro: "Select a watched item; click + Add to Vault" });
    // Add to Vault on a manual wish (Charlie)
    await selectCard(S, "QA dis Wish Charlie"); await sleep(300);
    await admin.from("vault_items").delete().eq("profile_id", P).ilike("title", "%Wish Charlie%");
    await C.clickText(S, "^\\+ Add to Vault$", { scope: "aside" }); await sleep(900); const toastMoved = clean(await S.text()); await sleep(2600);
    const moved =(await admin.from("vault_items").select("id,title,profile_id,status").eq("profile_id", P).ilike("title", "%Wish Charlie%")).data;
    const stillWish = (await admin.from("wishlist").select("id").eq("id", `qa_dis_w3_${st}`)).data;
    const gone = !(await cards(S)).some((c) => c.title === "QA dis Wish Charlie");
    r.check(moved.length === 1 && stillWish.length === 0 && gone && /Moved "QA dis Wish Charlie" to your vault/.test(toastMoved), { page: PG, control: "+ Add to Vault on a manual wishlist item", expected: "creates exactly one vault item with that title in this profile, removes it from the wishlist (screen and database), says so", actual: `vault rows=${moved.length}, wishlist rows left=${stillWish.length}, card gone=${gone}`, evidence: await S.jshot("dis-watchlist-moved"), impact: "data loss", repro: "Select Wish Charlie; + Add to Vault" });
    if (moved.length) await admin.from("vault_items").delete().in("id", moved.map((x) => x.id));
    // Dismiss on a watched item
    await S.visit("/watchlist"); await sleep(3000);
    await selectCard(S, "QA Album 19 - watched no value"); await sleep(300);
    const wb = (await admin.from("watchlist").select("item_id").eq("owner_profile_id", P)).data.length;
    await C.clickText(S, "^Dismiss$", { scope: "aside" }); await sleep(2500);
    const wa = (await admin.from("watchlist").select("item_id").eq("owner_profile_id", P)).data;
    const left = (await cards(S)).map((c) => c.title);
    r.check(wa.length === wb - 1 && !wa.some((x) => x.item_id === `qa_vz_${st}_19`) && !left.includes("QA Album 19 - watched no value") && left.includes("QA Album 1 - watched") && left.includes("QA Album 13 - watched"), { page: PG, control: "Dismiss on a watched item", expected: "removes only that watched row (screen + database); the other watched items stay", actual: `db rows ${wb} -> ${wa.length}; remaining cards: ${left.length}`, evidence: "n/a", impact: "data loss", repro: "Select a watched item; Dismiss" });
    await S.visit("/watchlist"); await sleep(3000);
    r.check(!(await cards(S)).some((c) => c.title === "QA Album 19 - watched no value"), { page: PG, control: "Dismiss: after reload", expected: "stays gone", actual: "gone=" + !(await cards(S)).some((c) => c.title === "QA Album 19 - watched no value"), evidence: "n/a", impact: "data loss", repro: "Reload" });
    // Share (selected) with stubs
    await selectCard(S, "QA dis Wish Bravo"); await sleep(300);
    await C.clickText(S, "^Share$", { scope: "aside" }); await sleep(800);
    const look = await S.look();
    r.check(look && look.share === 1 && look.shared && look.shared.title === "QA dis Wish Bravo", { page: PG, control: "Detail panel: Share (navigator.share stubbed)", expected: "shares the selected item's title", actual: JSON.stringify(look && look.shared), evidence: "window.__aud", impact: "misleading result", repro: "Select an item; Share" });
    // Dismiss a wishlist item (Bravo) only affects it
    const wl0 = (await admin.from("wishlist").select("id").eq("profile_id", P)).data.length;
    await C.clickText(S, "^Dismiss$", { scope: "aside" }); await sleep(2500);
    const wl1 = (await admin.from("wishlist").select("id").eq("profile_id", P)).data.map((x) => x.id);
    r.check(wl1.length === wl0 - 1 && !wl1.includes(`qa_dis_w2_${st}`) && wl1.includes(`qa_dis_w1_${st}`), { page: PG, control: "Dismiss on a wishlist item", expected: "removes only that wishlist row", actual: `wishlist rows ${wl0} -> ${wl1.length}`, evidence: "n/a", impact: "data loss", repro: "Select Bravo; Dismiss" });
  });

  await section("share-wishlist", async () => {
    await S.visit("/watchlist"); await sleep(3000);
    await C.clickText(S, "^Share wishlist$"); await sleep(3500);
    const look = await S.look();
    const tokenRow = (await admin.from("wishlist_shares").select("token").eq("profile_id", P).maybeSingle()).data;
    const url = look && (look.shared?.url || (look.clip || [])[0]);
    r.check(tokenRow && tokenRow.token && url && url.endsWith("/wishlist/" + tokenRow.token), { page: PG, control: "Share wishlist (share sheet / clipboard stubbed)", expected: "creates a share link for this profile's wishlist and hands the /wishlist/<token> URL to share/copy", actual: `token created=${!!(tokenRow && tokenRow.token)}; handed over: ${url}`, evidence: await S.jshot("dis-wishlist-share"), impact: "misleading result", repro: "Click Share wishlist" });
    const labels = await S.evaluate("[...document.querySelectorAll('header button, button')].map((b) => b.textContent.trim()).filter((t) => /wishlist link|Stop sharing|Share wishlist/.test(t))");
    r.check(labels.includes("Copy wishlist link") && labels.includes("Stop sharing"), { page: PG, control: "Header buttons after sharing is on", expected: "'Copy wishlist link' and 'Stop sharing' appear", actual: labels.join(" | "), evidence: "n/a", impact: "usability", repro: "After Share wishlist" });
    if (tokenRow) {
      const V = await C.session("visitor");
      await V.visit("/wishlist/" + tokenRow.token); await sleep(3000);
      const vt = clean(await V.text());
      r.check(/QA dis Wish Alpha/.test(vt) && /Comic Delta/.test(vt) && !/PRIVATE-NOTE-WISH|\$2,500|\$100\b|target/i.test(vt) && !/Wish Bravo/.test(vt), { page: `/wishlist/<valid token> | signed-out visitor`, control: "Public wishlist page", expected: "lists the remaining wishlist items (Alpha, Comic Delta; Bravo was dismissed, Charlie moved to the vault) with NO private notes or target prices", actual: vt.slice(vt.indexOf("Collector") > 0 ? 40 : 0, 380), evidence: await V.jshot("dis-wishlist-public-token"), impact: "privacy/data loss", repro: "Open the share link signed out" });
      await V.visit("/wishlist/not-a-real-token-123"); await sleep(2500);
      const it = clean(await V.text());
      r.check(/not found|isn.t shared|no longer|invalid|unavailable|expired/i.test(it) && !/QA dis Wish/.test(it), { page: "/wishlist/<invalid token> | visitor", control: "Invalid wishlist token", expected: "a clear 'link not found / not shared' message, no data", actual: it.slice(40, 240), evidence: await V.jshot("dis-wishlist-invalid-token"), impact: "usability", repro: "Open /wishlist/not-a-real-token-123" });
      await V.visit("/wishlist/"); await sleep(1500);
      r.check(true, { page: "/wishlist/ (no token) | visitor", control: "Bare /wishlist/ path", expected: "(observation) where it lands", actual: `${await V.path()} | ${clean(await V.text()).slice(40, 120)}`, evidence: "n/a", impact: "improvement", repro: "Open /wishlist/" });
      // stop sharing -> token dies
      await C.clickText(S, "^Stop sharing$"); await sleep(2500);
      const after = (await admin.from("wishlist_shares").select("token").eq("profile_id", P).maybeSingle()).data;
      await V.visit("/wishlist/" + tokenRow.token); await sleep(2500);
      const dead = clean(await V.text());
      r.check(!after && !/QA dis Wish Alpha/.test(dead), { page: PG, control: "Stop sharing", expected: "removes the link: the old URL stops showing the wishlist; toast 'Wishlist link turned off'", actual: `share row left=${!!after}; old link shows wishlist=${/QA dis Wish Alpha/.test(dead)}`, evidence: "n/a", impact: "privacy/data loss", repro: "Stop sharing; open the old link signed out" });
      await V.close();
    }
  });

  await section("isolation", async () => {
    // Business profile: nothing from Personal
    const B = await C.session("business");
    await B.visit("/watchlist"); await sleep(3500);
    const bc = await cards(B); const bch = await chips(B);
    r.check(bc.length === 0 && bch.All === 0, { page: "/watchlist | owner, Business profile active", control: "Watchlist under the Business profile", expected: "empty: the Personal profile's wishlist and watched items are not shown", actual: `cards=${bc.length}, All=${bch.All}`, evidence: await B.jshot("dis-watchlist-business"), impact: "privacy/data loss", repro: "Switch to Business; open /watchlist" });
    await B.close();
    const K = await C.session("viewer");
    await K.visit("/watchlist"); await sleep(3500);
    const kc = await cards(K);
    r.check(kc.length === 0, { page: "/watchlist | unrelated viewer", control: "Watchlist for a different account", expected: "empty: nothing from the owner's account", actual: `cards=${kc.length}`, evidence: "n/a", impact: "privacy/data loss", repro: "Sign in as another user; open /watchlist" });
    await K.close();
    const V = await C.session("visitor");
    await V.visit("/watchlist"); await sleep(2500);
    r.check(/\/login/.test(await V.path()), { page: "/watchlist | signed-out visitor", control: "Signed-out access", expected: "asked to sign in (next=/watchlist)", actual: await V.path(), evidence: "n/a", impact: "privacy/data loss", repro: "Open /watchlist signed out" });
    await V.visit("/wishlist"); await sleep(2500);
    r.check(/\/login/.test(await V.path()) && /watchlist/.test(await V.path()), { page: "/wishlist | signed-out visitor", control: "/wishlist redirect", expected: "goes to the watchlist path and then to sign-in", actual: await V.path(), evidence: "n/a", impact: "usability", repro: "Open /wishlist signed out" });
    await V.close();
    await S.visit("/wishlist"); await sleep(2500);
    r.check((await S.path()) === "/watchlist", { page: "/wishlist | owner", control: "/wishlist redirect (signed in)", expected: "lands on /watchlist", actual: await S.path(), evidence: "n/a", impact: "usability", repro: "Open /wishlist" });
  });

  await S.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
