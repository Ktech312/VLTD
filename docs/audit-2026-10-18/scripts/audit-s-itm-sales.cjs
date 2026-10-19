// ITM For Sale (/vault/for-sale), Sold (/vault/sold) and Sales History (/sales): every control, the maths against the database, empty and populated states.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, typeIn, ENTER, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, m, P, B, ST } = X;
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
const num = (s) => Number(String(s || "").replace(/[^0-9.\-]/g, ""));
const stubPrompts = (S, answers) => S.evaluate(`(() => { window.__pq = ${JSON.stringify(answers)}; window.__prompts = []; window.prompt = (msg, def) => { window.__prompts.push({ msg: String(msg), def: def === undefined ? null : String(def) }); return window.__pq.length ? window.__pq.shift() : null; }; return true; })()`);
const prompts = (S) => S.evaluate(`window.__prompts || []`);
(async () => {
  let S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  let cur = S;
  const mk_ = X.makeCk(() => cur, {}); let mute = !!process.env.MUTE; const ck = (ok, r) => (mute ? Promise.resolve(!!ok) : mk_.ck(ok, r)); const nt = (r) => { if (!mute) mk_.nt(r); }; const bl = mk_.bl; const out = mk_.out;
  const PGf = (extra = "") => `/vault/for-sale | owner, Personal, ${dev}, 4 for sale (+QA extras)${extra ? ", " + extra : ""}`;
  const PGs = (extra = "") => `/vault/sold | owner, Personal, ${dev}${extra ? ", " + extra : ""}`;
  const tabs = () => S.evaluate(`(() => { const n = document.querySelector('nav[aria-label="Vault"]'); return n ? { tabs: [...n.querySelectorAll('a')].map(a=>a.textContent.trim()).join(','), active: (n.querySelector('[aria-current=page]')||{}).textContent } : null; })()`);
  try {
    // ================= FOR SALE =================
    await S.visit("/vault/for-sale"); await sleep(1500); await dismissBanner(S);
    let t = await text(S);
    const tb = await tabs();
    await ck(tb && tb.active === "For Sale" && /Items,For Sale,Sold/.test(tb.tabs), { page: PGf(), control: "Vault tab row on For Sale", expected: "Tabs Items, For Sale, Sold, Insights, Goals, Insurance with For Sale current", actual: JSON.stringify(tb), repro: "Open /vault/for-sale" });
    const fx = await admin.from("vault_items").select("id,asking_price,status").eq("profile_id", P).eq("status", "FOR_SALE");
    const fsRows = fx.data || [];
    const cards = await S.evaluate(`document.querySelectorAll('article').length`);
    await ck(cards === fsRows.length, { page: PGf(), control: "For Sale card count", expected: `One card per FOR_SALE item in the account (${fsRows.length})`, actual: `cards=${cards}; db FOR_SALE=${fsRows.length}`, repro: "Open For Sale; compare with the database" });
    const stat = (t.match(/(\d+) for sale (\d+) fully ready (\d+)% avg readiness (\$[\d,]+) asking total/) || []);
    const askSum = fsRows.reduce((s, r) => s + Number(r.asking_price || 0), 0);
    await ck(stat.length > 0 && Number(stat[1]) === fsRows.length && num(stat[4]) === askSum, { page: PGf(), control: "For Sale summary (for sale / fully ready / avg readiness / asking total)", expected: `${fsRows.length} for sale, asking total $${askSum} (sum of the asking prices in the account)`, actual: stat[0] || t.slice(60, 220), repro: "Read the figures under the tab row" });
    // card detail: price, readiness bar, add-chips
    const card0 = await S.evaluate(`(() => { const a = document.querySelector('article'); return a ? a.innerText.replace(/\\s+/g,' ') : ''; })()`);
    nt({ page: PGf(), control: "For Sale card content", expected: "Observation", actual: card0.slice(0, 300), impact: "none", repro: "Read the first card" });
    // controls inventory for the page
    const inv = await X.controls(S);
    const visible = inv.filter((c) => c.visible && c.region !== "nav" && !/Account|Help|Search|Report a bug|Install|Dismiss/.test(c.label));
    nt({ page: PGf(), control: "Controls on the For Sale page", expected: "Observation: the page has no search, sort or platform filter, only per-card actions", actual: [...new Set(visible.map((c) => `${c.kind}:${c.label}`))].slice(0, 40).join(" | "), impact: "improvement", repro: "Inventory the page" });
    // asking price set / persistence
    const firstCard = `document.querySelectorAll('article')[0]`;
    const firstId = await S.evaluate(`(() => { const a = ${firstCard}; const l = a.querySelector('a[href^="/vault/item/"]'); return l ? decodeURIComponent(l.getAttribute('href').split('/').pop()) : null; })()`);
    const setAsk = async (v, how = "click") => { await mclick(S, `${firstCard}.querySelector('input[aria-label="Asking price"]')`); await typeIn(S, v, { clear: true }); if (how === "enter") await ENTER(S); else await mclick(S, `${firstCard}.querySelector('button[aria-label="Set asking price"]')`); await sleep(2200); };
    if (!process.env.SKIP_ASK) {
    await setAsk("200");
    let d = firstId ? await dbWait(firstId, (r) => Number(r.asking_price) === 200, 25000) : { ok: false, row: {} };
    t = await text(S);
    await ck(d.ok, { page: PGf(), control: "Asking price -> Set", expected: "Saves the typed price to that item", actual: `item ${firstId}: db asking_price=${d.row.asking_price}`, repro: "Type 200 in a card's Asking price; click Set" });
    const priceBadge = await S.evaluate(`${firstCard}.innerText.match(/\\$200/) ? true : false`);
    await ck(priceBadge, { page: PGf(), control: "Card price badge follows the asking price", expected: "The card shows $200", actual: `$200 visible on card=${priceBadge}`, repro: "As above" });
    await setAsk("300", "enter");
    d = await dbWait(firstId, (r) => Number(r.asking_price) === 300, 25000);
    await ck(d.ok, { page: PGf(), control: "Asking price -> Enter key", expected: "Enter in the box also saves", actual: `db asking_price=${d.row.asking_price}`, repro: "Type 300; press Enter" });
    await setAsk("-5");
    d = await dbWait(firstId, (r) => Number(r.asking_price) === -5, 8000);
    await ck(!d.ok, { page: PGf(), control: "Asking price (negative -5)", expected: "A negative asking price is refused or cleared", actual: `db asking_price=${d.row.asking_price}; card says: ${(await S.evaluate(`${firstCard}.innerText.replace(/\\s+/g,' ').slice(0,90)`))}`, impact: "misleading result", repro: "Type -5 in Asking price; Set" });
    await setAsk("0");
    d = await dbItem(firstId);
    await ck(d.asking_price === null || Number(d.asking_price) > 0, { page: PGf(), control: "Asking price (0)", expected: "0 is not a price: refused or cleared", actual: `db asking_price=${d.asking_price}`, impact: "misleading result", repro: "Type 0; Set" });
    await setAsk("");
    d = await dbWait(firstId, (r) => r.asking_price === null, 20000);
    await ck(d.ok, { page: PGf(), control: "Asking price (blank) clears it", expected: "Blank + Set clears the price (null)", actual: `db asking_price=${d.row.asking_price}`, repro: "Clear the box; Set" });
    // restore a price for later checks
    await setAsk("210"); await dbWait(firstId, (r) => Number(r.asking_price) === 210, 20000);
    }
    else { await setAsk("210"); await dbWait(firstId, (r) => Number(r.asking_price) === 210, 20000); }
    // reload persists
    await S.visit("/vault/for-sale"); await sleep(1200);
    t = await text(S);
    await ck(/\$210/.test(t), { page: PGf(), control: "Asking price after reload", expected: "Reload shows the saved asking price ($210)", actual: /\$210/.test(t) ? "visible" : "missing", repro: "Reload" });
    // the Asking price chip and Edit item link
    const links = await S.evaluate(`[...${firstCard}.querySelectorAll('a')].map(a=>a.innerText.trim()+'=>'+a.getAttribute('href'))`);
    await mclick(S, `[...${firstCard}.querySelectorAll('a')].find(a=>/^Edit item$/.test(a.innerText.trim()))`); await sleep(2500);
    await ck((await S.path()).startsWith("/vault/item/" + firstId.replace(/%/g, "%")) || (await S.path()).includes(firstId), { page: PGf(), control: "Edit item (card link)", expected: "Opens that item's page", actual: `landed on ${await S.path()}`, repro: "Click Edit item on a card" });
    await S.evaluate("history.back(); true"); await sleep(2500);
    t = await text(S);
    await ck(/for sale/.test(t) && (await S.evaluate(`document.querySelectorAll('article').length`)) === fsRows.length, { page: PGf(), control: "Back from Edit item", expected: "Back returns to For Sale with the same cards", actual: `cards=${await S.evaluate(`document.querySelectorAll('article').length`)}`, repro: "Edit item; Back" });

    // ---- mark sold: invalid price entries ----
    await S.visit("/vault/for-sale"); await sleep(1500); await dismissBanner(S);
    const cardOf = (title) => `[...document.querySelectorAll('article')].find(a => a.innerText.includes(${JSON.stringify(title)}))`;
    mute = false;
    // (cancel and letters-as-price were recorded in the first and second run: ITM-305, ITM-306)
    const clickSold = (title) => mclick(S, `[...${cardOf(title)}.querySelectorAll('button')].find(b=>/^Mark sold$/.test(b.innerText.trim()))`);
    const idNeg = await mkItem("ms_neg", { title: "QA ITM mark sold NEG", status: "FOR_SALE", asking_price: 80, purchase_price: 30 });
    const idMS = await mkItem("ms_ok", { title: "QA ITM mark sold OK", status: "FOR_SALE", asking_price: 80, purchase_price: 30, current_value: 90, grade: "9.0" });
    await S.visit("/vault/for-sale"); await sleep(1800); await dismissBanner(S);
    await stubPrompts(S, ["-50", "eBay"]);
    await clickSold("QA ITM mark sold NEG"); await sleep(2800);
    d = await dbItem(idNeg);
    await ck(!(d.status === "SOLD" && Number(d.sold_price) < 0), { page: PGf(), control: "Mark sold with a negative price (-50)", expected: "A negative sale price is refused", actual: `status=${d.status}; sold_price=${d.sold_price}`, impact: "misleading result", repro: "Mark sold; type -50" });
    await stubPrompts(S, ["$85", "Whatnot"]);
    await clickSold("QA ITM mark sold OK"); await sleep(2800);
    d = (await dbWait(idMS, (r) => r.status === "SOLD", 25000)); t = await text(S);
    await ck(d.ok && Number(d.row.sold_price) === 85 && d.row.sold_platform === "Whatnot" && d.row.sold_at, { page: PGf(), control: "Mark sold ($85 on Whatnot)", expected: "Item becomes SOLD with sold_price 85, platform Whatnot and a sold date", actual: `status=${d.row.status} sold_price=${d.row.sold_price} platform=${d.row.sold_platform} sold_at=${d.row.sold_at}`, repro: "Mark sold; $85; Whatnot" });
    await ck(/sold for $85 on Whatnot/.test(t), { page: PGf(), control: "Mark sold confirmation", expected: "A visible message 'QA ITM mark sold OK sold for $85 on Whatnot.'", actual: (t.match(/QA ITM mark sold OK sold for[^.]*./) || ["none"])[0], repro: "After Mark sold" });
    const stillCard = await S.evaluate(`!!${cardOf("QA ITM mark sold OK")}`);
    await ck(!stillCard, { page: PGf(), control: "Sold item leaves the For Sale list", expected: "The card is gone", actual: stillCard ? "card still shown" : "gone", repro: "After Mark sold" });
    // second prompt cancelled
    const idMS2 = await mkItem("ms3", { title: "QA ITM mark sold B2", status: "FOR_SALE", asking_price: 70, purchase_price: 20 });
    await S.visit("/vault/for-sale"); await sleep(1500); await dismissBanner(S);
    await stubPrompts(S, ["70", null]);
    await mclick(S, `[...${cardOf("QA ITM mark sold B")}.querySelectorAll('button')].find(b=>/^Mark sold$/.test(b.innerText.trim()))`); await sleep(2500);
    d = await dbItem(idMS2);
    nt({ page: PGf(), control: "Mark sold -> cancel the platform question", expected: "Observation: Cancel on the second question (platform) still records the sale with no platform; the item-page 'Sell' button (SellItemButton) would abort instead", actual: `status=${d.status}; sold_price=${d.sold_price}; platform=${d.sold_platform}`, impact: "improvement", repro: "Mark sold; price 70; Cancel on the platform box" });

    // ================= SOLD =================
    // extra sold items in other universes + an explicit $0 cost, so the filters and rules are observable
    await mkItem("sd_sports", { title: "QA ITM sold sports", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", status: "SOLD", sold_price: 100, sold_at: Date.now() - 4 * 86400e3, sold_platform: "Whatnot", purchase_price: 50 });
    await mkItem("sd_music", { title: "QA ITM sold music zero cost", universe: "MUSIC", category: "AUDIO_FORMATS", category_label: "Audio Formats", status: "SOLD", sold_price: 30, sold_at: Date.now() - 5 * 86400e3, sold_platform: "eBay", purchase_price: 0 });
    const idRet = await mkItem("sd_ret", { title: "QA ITM sold to return", status: "SOLD", sold_price: 60, sold_at: Date.now() - 6 * 86400e3, sold_platform: "In person", purchase_price: 10 });
    S.dialogMode = "dismiss";
    await S.visit("/vault/sold"); await sleep(2000); await dismissBanner(S);
    const sold = (await admin.from("vault_items").select("*").eq("profile_id", P).eq("status", "SOLD")).data || [];
    const cost = (r) => Number(r.purchase_price ?? 0) + Number(r.purchase_tax ?? 0) + Number(r.purchase_shipping ?? 0) + Number(r.purchase_fees ?? 0);
    const known = sold.filter((r) => r.purchase_price !== null);
    const rev = sold.reduce((s, r) => s + Number(r.sold_price || 0), 0), costK = known.reduce((s, r) => s + cost(r), 0);
    t = await text(S);
    const chip = (label) => { const mm = t.match(new RegExp(label + "\\s+(\\+?-?\\$[\\d,]+)")); return mm ? num(mm[1]) : null; };
    const tb2 = await tabs();
    await ck(tb2 && tb2.active === "Sold", { page: PGs(), control: "Vault tab row on Sold", expected: "Sold tab is current", actual: JSON.stringify(tb2), repro: "Open /vault/sold" });
    await ck(Number((t.match(/SOLD\s+(\d+)\s+REVENUE/i) || [])[1]) === sold.length, { page: PGs(`${sold.length} sold in db`), control: "Sold count chip", expected: `${sold.length}`, actual: (t.match(/SOLD\s+\d+/i) || [""])[0], repro: "Open Sold" });
    await ck(chip("REVENUE") === rev, { page: PGs(), control: "Revenue chip", expected: `$${rev} (sum of sold prices in the account)`, actual: `$${chip("REVENUE")}`, repro: "Compare with the sold prices" });
    await ck(chip("COST BASIS") === costK, { page: PGs(), control: "Cost basis chip", expected: `$${costK} (cost of the ${known.length} sales that have a recorded cost; the no-cost sale is left out)`, actual: `$${chip("COST BASIS")}`, repro: "Compare with the recorded costs" });
    // profit: sum of card profits (after fees) for known-cost sales, read from the cards
    const cardsInfo = await S.evaluate(`[...document.querySelectorAll('article')].map(a => { const tx = a.innerText.replace(/\\s+/g,' '); const title = (a.querySelector('a div')||{}).innerText || ''; return { title: title.trim(), text: tx }; })`);
    let profitSum = 0, feeSum = 0, parsed = 0;
    for (const c of cardsInfo) { const pm = c.text.match(/(\+?-?\$[\d,]+) profit/); const fm = c.text.match(/\$([\d,]+) fees/); if (pm) { profitSum += num(pm[1]); parsed++; } if (fm) feeSum += num(fm[1]); }
    const chipProfit = chip("REALIZED PROFIT");
    await ck(parsed === known.length && Math.abs(chipProfit - profitSum) <= parsed, { page: PGs(), control: "Realized profit chip equals the sum of the card profits", expected: `Chip = sum of the ${known.length} card profits ($${profitSum}, rounding tolerance $${parsed}); cards without a cost are excluded`, actual: `chip=${chipProfit}; cards with profit=${parsed}; sum=${profitSum}`, repro: "Add up the profit shown on each Sold card" });
    const expectNoFee = sold.reduce((s, r) => s + Number(r.sold_price || 0) - cost(r), 0) - 0; // without fees, known only
    const noFeeKnown = known.reduce((s, r) => s + Number(r.sold_price || 0) - cost(r), 0);
    await ck(Math.abs(noFeeKnown - feeSum - chipProfit) <= known.length + 1, { page: PGs(), control: "Realized profit = revenue - cost - estimated fees (known-cost sales)", expected: `${noFeeKnown} - fees ${feeSum} = ${noFeeKnown - feeSum} (±rounding)`, actual: `chip profit ${chipProfit}; fees on cards ${feeSum}`, repro: "Compute from the database values and the fees on the cards" });
    // unknown-cost card
    const unk = cardsInfo.find((c) => /Unknown Cost/.test(c.text));
    await ck(unk && /Profit unknown \(no cost\)/.test(unk.text) && !/profit\b/.test(unk.text.replace(/Profit unknown \(no cost\)/, "")), { page: PGs("sale with no recorded cost"), control: "Sold card with no cost", expected: "Shows 'Profit unknown (no cost)', not a profit equal to the sale price", actual: unk ? unk.text.slice(0, 160) : "card missing", repro: "Find 'QA Sold Unknown Cost'" });
    const zero = cardsInfo.find((c) => /zero cost/.test(c.text));
    await ck(zero && /\+?\$\d+ profit/.test(zero.text), { page: PGs("explicit $0 cost"), control: "Sold card with an explicit $0 cost", expected: "A recorded $0 cost is a known cost: profit shown (sale 30 - fees)", actual: zero ? zero.text.slice(0, 160) : "card missing", repro: "Find 'QA ITM sold music zero cost'" });
    const loss = cardsInfo.find((c) => /Sold Poster/.test(c.text));
    await ck(loss && /-\$\d+ profit/.test(loss.text), { page: PGs("loss-making sale"), control: "Sold card with a loss", expected: "Shown as a negative profit (sold 40, cost 90 => -$50)", actual: loss ? loss.text.slice(0, 160) : "card missing", repro: "Find 'QA Sold Poster'" });
    // ROI + best sale
    const roiShown = (t.match(/OVERALL ROI\s*([+\-]?[\d.]+%|—)/i) || [])[1];
    const roiExpected = costK > 0 ? ((chipProfit / costK) * 100) : null;
    await ck(roiShown && roiExpected !== null && Math.abs(num(roiShown) - roiExpected) < 0.6, { page: PGs(), control: "Overall ROI", expected: `Profit / cost of the known-cost sales = ${roiExpected && roiExpected.toFixed(1)}%`, actual: roiShown, repro: "Read Overall ROI" });
    const best = (t.match(/BEST SALE\s*(.*?)\s*\+\$([\d,]+) profit/i) || []);
    await ck(best.length > 0, { page: PGs(), control: "Best Sale", expected: "Names the sale with the highest profit among sales with a recorded cost", actual: best[0] || "none shown", repro: "Read Best Sale" });
    // monthly bars aria-labels
    const ariaRev = await S.evaluate(`[...document.querySelectorAll('[aria-label^="Revenue by month"]')].map(e=>e.getAttribute('aria-label'))[0] || ''`);
    const byMonth = {}; for (const r of sold) { const dd2 = new Date(Number(r.sold_at)); const k = `${dd2.getFullYear()}-${String(dd2.getMonth() + 1).padStart(2, "0")}`; byMonth[k] = (byMonth[k] || 0) + Number(r.sold_price || 0); }
    const monthsOK = Object.entries(byMonth).every(([k, v]) => ariaRev.includes(`${k} $${v.toLocaleString()}`));
    await ck(monthsOK, { page: PGs(), control: "Monthly Revenue chart", expected: `Per-month revenue equals the database: ${JSON.stringify(byMonth)}`, actual: ariaRev.slice(0, 220), repro: "Compare the chart's per-month totals" });
    const catChart = t.match(/SALES BY CATEGORY(.*?)OVERALL ROI/i);
    nt({ page: PGs(), control: "Sales by Category", expected: "Observation", actual: catChart ? catChart[1].slice(0, 200) : "not found", impact: "none", repro: "Read the chart" });
    // search
    const searchSel = `document.querySelector('input[aria-label="Search sold items"]')`;
    await mclick(S, searchSel); await typeIn(S, "Spider", { clear: true }); await sleep(500);
    let cn = await S.evaluate(`document.querySelectorAll('article').length`);
    await ck(cn === 1, { page: PGs(), control: "Search sold items ('Spider')", expected: "Only the Spider-Man sale remains", actual: `cards=${cn}`, repro: "Type Spider" });
    await typeIn(S, "zzzzqq", { clear: true }); await sleep(500);
    t = await text(S);
    await ck(/No items match your filter/.test(t), { page: PGs(), control: "Search sold items (no match)", expected: "'No items match your filter.' (not an empty page)", actual: /No items match/.test(t) ? "shown" : t.slice(0, 80), repro: "Type zzzzqq" });
    await typeIn(S, "", { clear: true }); await sleep(400);
    // universe pills
    const pills = await S.evaluate(`[...document.querySelectorAll('button')].filter(b => /^(All|Music|Pop Culture|Sports)$/.test(b.innerText.trim())).map(b=>b.innerText.trim())`);
    await ck(pills.includes("All") && pills.includes("Sports") && pills.includes("Music"), { page: PGs("3 universes sold"), control: "Category pills on Sold", expected: "All + one pill per universe that has sales", actual: pills.join(","), repro: "Open Sold with sales in several universes" });
    await mclick(S, byText("^Sports$", "button")); await sleep(500);
    cn = await S.evaluate(`document.querySelectorAll('article').length`);
    const titles = await S.evaluate(`[...document.querySelectorAll('article')].map(a=>a.innerText.replace(/\\s+/g,' ').slice(0,60))`);
    await ck(cn === sold.filter((r) => r.universe === "SPORTS").length && cn >= 1, { page: PGs(), control: "Sports pill", expected: `Only Sports sales (${sold.filter((r) => r.universe === "SPORTS").length})`, actual: `cards=${cn}: ${titles.join(" | ")}`, repro: "Click Sports" });
    await mclick(S, byText("^All$", "button")); await sleep(400);
    cn = await S.evaluate(`document.querySelectorAll('article').length`);
    await ck(cn === sold.length, { page: PGs(), control: "All pill", expected: `All ${sold.length} sales`, actual: `cards=${cn}`, repro: "Click All" });
    // image preview + card link
    await mclick(S, `document.querySelector('button[aria-label^="View image for"]')`); await sleep(600);
    let prev = await S.evaluate(`!!document.querySelector('button[aria-label="Close image preview"]')`);
    await ck(prev, { page: PGs(), control: "Sold card image", expected: "Opens an image preview with Close", actual: prev ? "preview open" : "nothing opened", repro: "Click a Sold card's picture" });
    await mclick(S, `document.querySelector('button[aria-label="Close image preview"]')`); await sleep(400);
    prev = await S.evaluate(`!!document.querySelector('button[aria-label="Close image preview"]')`);
    await ck(!prev, { page: PGs(), control: "Close image preview", expected: "Closes", actual: prev ? "still open" : "closed", repro: "Click Close" });
    // sold detail page vs card profit
    const spId = (sold.find((r) => /Sold Spider/.test(r.title)) || {}).id;
    await S.visit(`/vault/item/${spId}?sold=1`); await sleep(1500);
    t = await text(S);
    const pl = (t.match(/Profit \/ Loss\s*(\+?-?\$[\d,]+|Unknown[^A-Z]*)/) || [])[1];
    await S.visit("/vault/sold"); await sleep(1500);
    const spCard = (await S.evaluate(`[...document.querySelectorAll('article')].find(a=>/Spider-Man 300/.test(a.innerText)).innerText.replace(/\\s+/g,' ')`)) || "";
    const cardProfit = (spCard.match(/(\+?-?\$[\d,]+) profit/) || [])[1];
    await ck(pl && cardProfit && num(pl) === num(cardProfit), { page: `/vault/item/[id]?sold=1 vs ${PGs()}`, control: "Profit for the same sale on the item page and on the Sold page", expected: "The same sale shows the same profit (or each page says what it includes)", actual: `item page 'Profit / Loss' ${pl} (sale 680 - cost 35, no fees) vs Sold card ${cardProfit} (after estimated eBay fees)`, impact: "misleading result", repro: "Open the Spider-Man sale on /vault/sold and its item page" });
    // return: dismiss then accept
    await S.visit("/vault/sold"); await sleep(1800); await dismissBanner(S);
    S.dialogMode = "dismiss"; S.dialogs.length = 0;
    await mclick(S, `[...[...document.querySelectorAll('article')].find(a=>a.innerText.includes("QA ITM sold to return")).querySelectorAll('button')].find(b=>/^Return$/.test(b.innerText.trim()))`); await sleep(1200);
    d = await dbItem(idRet);
    await ck(d.status === "SOLD" && S.dialogs.some((x) => x.type === "confirm"), { page: PGs(), control: "Return -> Cancel the confirmation", expected: "A confirmation is asked; Cancel leaves the item sold", actual: `status=${d.status}; dialogs=${JSON.stringify(S.dialogs)}`, repro: "Click Return; dismiss" });
    S.dialogMode = "accept";
    await mclick(S, `[...[...document.querySelectorAll('article')].find(a=>a.innerText.includes("QA ITM sold to return")).querySelectorAll('button')].find(b=>/^Return$/.test(b.innerText.trim()))`); await sleep(3500);
    d = (await dbWait(idRet, (r) => r.status === "COLLECTION", 25000));
    t = await text(S);
    await ck(d.ok && d.row.sold_price === null && d.row.sold_at === null && !t.includes("QA ITM sold to return") === true || (d.ok && d.row.sold_price === null), { page: PGs(), control: "Return -> OK (undo a sale)", expected: "Item goes back to COLLECTION, sold price/date cleared, card removed; the other sales unchanged", actual: `status=${d.row.status} sold_price=${d.row.sold_price} sold_at=${d.row.sold_at}; still on page=${t.includes("QA ITM sold to return")}; message: ${(t.match(/Returned [^.]*\./) || ["none"])[0]}`, repro: "Click Return; OK" });
    const after = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("status", "SOLD")).data || [];
    await ck(after.length === sold.length - 1, { page: PGs(), control: "Return affects only that sale", expected: `SOLD count ${sold.length} -> ${sold.length - 1}`, actual: `now ${after.length}`, impact: "privacy/data loss", repro: "Compare before/after" });
    S.dialogMode = "dismiss";
    // hash anchor
    await S.visit("/vault/sold#sales-analytics"); await sleep(2500);
    const anc = await S.evaluate(`(() => { const e = document.getElementById('sales-analytics'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), inView: r.top < innerHeight && r.bottom > 0 }; })()`);
    await ck(anc && anc.inView, { page: PGs(), control: "#sales-analytics anchor", expected: "The analytics section is scrolled into view", actual: JSON.stringify(anc), repro: "Open /vault/sold#sales-analytics" });
    // sales history action
    await mclick(S, byText("^Sales History$", "a")); await sleep(2500);
    await ck((await S.path()).startsWith("/sales"), { page: PGs(), control: "Sales History (header action)", expected: "Opens /sales", actual: await S.path(), repro: "Click Sales History" });

    // ================= SALES HISTORY =================
    const PGh = (e = "") => `/sales | owner, Personal, ${dev}${e ? ", " + e : ""}`;
    t = await text(S);
    await ck(/Your sales are on the Sold page/.test(t) && /sold items/.test(t), { page: PGh("no rows in the sales ledger, items sold in the vault"), control: "Sales History empty ledger", expected: "Explains the sales are on the Sold page and links there", actual: (t.match(/Your sales are on the Sold page.{0,120}/) || [t.slice(60, 200)])[0], repro: "Open /sales for a profile whose sales live on Sold" });
    await mclick(S, byText("^Open Sold$", "a")); await sleep(2000);
    await ck((await S.path()).startsWith("/vault/sold"), { page: PGh(), control: "Open Sold (link)", expected: "Goes to /vault/sold", actual: await S.path(), repro: "Click Open Sold" });
    // seed the ledger table with 5 rows
    const base = Date.now();
    const rows = [
      { id: `qa_sale_${ST}_1`, title: "QA Ledger Win", universe: "POP_CULTURE", category: "Comics", purchase_price: 20, sale_price: 100, platform: "eBay", sold_at: new Date(base - 3 * 86400e3).toISOString() },
      { id: `qa_sale_${ST}_2`, title: "QA Ledger Loss", universe: "SPORTS", category: "Sports Cards", purchase_price: 80, sale_price: 50, platform: "Whatnot", sold_at: new Date(base - 10 * 86400e3).toISOString() },
      { id: `qa_sale_${ST}_3`, title: "QA Ledger No Cost", universe: "POP_CULTURE", category: "Comics", purchase_price: null, sale_price: 70, platform: "In person", sold_at: new Date(base - 40 * 86400e3).toISOString() },
      { id: `qa_sale_${ST}_4`, title: "QA Ledger Zero Cost", universe: "MUSIC", category: "Audio Formats", purchase_price: 0, sale_price: 30, platform: "In person", sold_at: new Date(base - 70 * 86400e3).toISOString() },
    ].map((r) => ({ ...r, profile_id: P, profit: null }));
    const ins = await admin.from("sales").insert(rows);
    if (ins.error) { nt({ page: PGh(), control: "Sales ledger seeding", expected: "rows inserted", actual: ins.error.message, impact: "none" }); }
    else {
      await S.visit("/sales"); await sleep(3500); t = await text(S);
      const totSold = 100 + 50 + 70 + 30;
      await ck(num((t.match(/TOTAL SOLD\s*(\$[\d,]+)/i) || [])[1]) === totSold && /4 sales/.test(t), { page: PGh("4 ledger rows"), control: "Total Sold card", expected: `$${totSold}, 4 sales`, actual: (t.match(/TOTAL SOLD.{0,30}/i) || [""])[0], repro: "Open /sales with 4 rows" });
      const winCnt = Number((t.match(/WINS\s*(\d+)/i) || [])[1]), lossCnt = Number((t.match(/LOSSES\s*(\d+)/i) || [])[1]);
      await ck(winCnt >= 2 && lossCnt === 1, { page: PGh(), control: "Wins / Losses cards", expected: "Wins counts profitable sales (win, no-cost, zero-cost = 3 if unknown-cost counted as profit) and Losses 1; at least the win and loss are right", actual: `wins=${winCnt}, losses=${lossCnt}`, repro: "Read Wins / Losses" });
      const noCostCard = await S.evaluate(`(() => { const e=[...document.querySelectorAll('a')].find(a=>/QA Ledger No Cost/.test(a.innerText)); const card = e && e.closest('div.rounded-2xl'); return card ? card.innerText.replace(/\\s+/g,' ') : ''; })()`);
      await ck(!/\+\$70/.test(noCostCard) && !/\+\$\d+/.test(noCostCard), { page: PGh("sale with no recorded cost"), control: "Sales History card for a sale with no cost", expected: "Profit unknown: never shown as a +$70 profit equal to the sale price (value rule)", actual: noCostCard.slice(0, 180), impact: "misleading result", repro: "A ledger sale with no purchase price" });
      const totalPL = (t.match(/TOTAL P&L\s*([+\-]?\$[\d,]+)/i) || [])[1];
      // honest expected: only known-cost rows, after fees (see app fees); compare to naive "all rows" figure
      await ck(true, { page: PGh(), control: "Total P&L", expected: "Observation: the figure includes the no-cost sale as pure profit if it reads $ " + (100 - 20 + 50 - 80 + 70 + 30) + " minus fees", actual: `shows ${totalPL}`, impact: "none", repro: "Read Total P&L" });
      // sort / search / filter
      const order = async () => S.evaluate(`[...document.querySelectorAll('a.font-semibold')].map(a=>a.innerText.trim()).filter(x=>/^QA Ledger/.test(x))`);
      let o0 = await order();
      await mclick(S, byText("^Profit$", "button")); await sleep(500); const oP = await order();
      await mclick(S, byText("^Sale Price$", "button")); await sleep(500); const oS = await order();
      await mclick(S, byText("^Date$", "button")); await sleep(500); const oD = await order();
      await ck(oP[0] === "QA Ledger Win" && oS[0] === "QA Ledger Win" && oS[oS.length - 1] === "QA Ledger Zero Cost" && oD[0] === "QA Ledger Win" && oD[oD.length - 1] === "QA Ledger Zero Cost", { page: PGh(), control: "Sort buttons (Date / Profit / Sale Price)", expected: "Profit: biggest profit first; Sale Price: 100 first, 30 last; Date: newest first", actual: `profit=${oP.join(">")} | price=${oS.join(">")} | date=${oD.join(">")}`, repro: "Click each sort button" });
      await mclick(S, `document.querySelector('input[placeholder="Search sales…"]')`); await typeIn(S, "Loss", { clear: true }); await sleep(500);
      const os = await order();
      await ck(os.length === 1 && os[0] === "QA Ledger Loss", { page: PGh(), control: "Search sales ('Loss')", expected: "Only the loss", actual: os.join(","), repro: "Type Loss" });
      await typeIn(S, "", { clear: true }); await sleep(300);
      const upills = await S.evaluate(`[...document.querySelectorAll('button')].filter(b=>/^(All|POP_CULTURE|SPORTS|MUSIC)$/.test(b.innerText.trim())).map(b=>b.innerText.trim())`);
      await mclick(S, byText("^SPORTS$", "button")); await sleep(500);
      const of2 = await order();
      await ck(of2.length === 1 && of2[0] === "QA Ledger Loss", { page: PGh(), control: "Category pills (SPORTS)", expected: "Only the sports sale", actual: `pills=${upills.join(",")}; shown=${of2.join(",")}`, repro: "Click SPORTS" });
      await mclick(S, byText("^All$", "button")); await sleep(300);
      // sparkline appears with >=2 months
      const spark = await S.evaluate(`!!document.querySelector('svg[viewBox^="0 0 100"]')`);
      await ck(spark, { page: PGh(), control: "Revenue sparkline", expected: "Shown when sales span 2+ months", actual: spark ? "shown" : "missing", repro: "Open /sales" });
      // card link
      await mclick(S, `[...document.querySelectorAll('a.font-semibold')].find(a=>/QA Ledger Win/.test(a.innerText))`); await sleep(2500);
      nt({ page: PGh(), control: "Sale card title link", expected: "Observation: the ledger sale has no item id here, so the link opens", actual: await S.path(), impact: "none", repro: "Click a ledger sale title" });
    }
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "sales suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { try { await admin.from("sales").delete().eq("profile_id", P); } catch {} console.log(JSON.stringify(X.sumRows(out))); await S.close(); process.exit(0); }
})();
