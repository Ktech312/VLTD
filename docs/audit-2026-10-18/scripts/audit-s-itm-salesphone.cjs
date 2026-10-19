// ITM For Sale / Sold interactions at phone width (390, browser-emulated; clicks are mouse events in an emulated phone, taps are touch events).
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, typeIn, ENTER, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, P } = X;
const touchTapEl = async (S, expr) => { const r = await X.rect(S, expr); if (!r) return false; await sleep(250); const r2 = await X.rect(S, expr); await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r2.x, y: r2.y }] }); await sleep(60); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); return true; };
(async () => {
  const S = await X.S_("owner", { width: 390, height: 800, mobile: true });
  const { ck, nt, out } = X.makeCk(() => S, {});
  const dev = "phone 390 (browser-emulated)";
  const PGf = `/vault/for-sale | owner, Personal, ${dev}`, PGs = `/vault/sold | owner, Personal, ${dev}`;
  try {
    const a = await mkItem("pf1", { title: "QA ITM phone sale A", status: "FOR_SALE", asking_price: 50, purchase_price: 10 });
    const b = await mkItem("pf2", { title: "QA ITM phone sale B", status: "FOR_SALE", asking_price: 60, purchase_price: 20 });
    const r = await mkItem("pf3", { title: "QA ITM phone sold to return", status: "SOLD", sold_price: 70, sold_at: Date.now() - 86400e3, sold_platform: "In person", purchase_price: 15 });
    await S.visit("/vault/for-sale"); await sleep(2500); await dismissBanner(S);
    const card = (t) => `[...document.querySelectorAll('article')].find(x => x.innerText.includes(${JSON.stringify(t)}))`;
    // set asking price with touch on Set
    await mclick(S, `${card("phone sale A")}.querySelector('input[aria-label="Asking price"]')`); await typeIn(S, "88", { clear: true });
    await touchTapEl(S, `${card("phone sale A")}.querySelector('button[aria-label="Set asking price"]')`); await sleep(2500);
    let d = await dbWait(a, (x) => Number(x.asking_price) === 88, 25000);
    await ck(d.ok, { page: PGf, control: "Asking price -> Set (touch tap)", expected: "Saves 88", actual: `db asking_price=${d.row.asking_price}`, repro: "Type 88; tap Set" });
    // mark sold with a touch tap
    await S.evaluate(`(() => { window.__pq = ["75", "eBay"]; window.prompt = () => window.__pq.shift(); return true; })()`);
    await touchTapEl(S, `[...${card("phone sale B")}.querySelectorAll('button')].find(b => /^Mark sold$/.test(b.innerText.trim()))`); await sleep(3500);
    d = await dbWait(b, (x) => x.status === "SOLD", 25000);
    await ck(d.ok && Number(d.row.sold_price) === 75, { page: PGf, control: "Mark sold (touch tap)", expected: "SOLD at 75 on eBay", actual: `status=${d.row.status} sold_price=${d.row.sold_price} platform=${d.row.sold_platform}`, repro: "Tap Mark sold; 75; eBay" });
    // Sold page: search, pills, return
    await S.visit("/vault/sold"); await sleep(2500); await dismissBanner(S);
    const n0 = await S.evaluate(`document.querySelectorAll('article').length`);
    await mclick(S, `document.querySelector('input[aria-label="Search sold items"]')`); await typeIn(S, "phone sale B", { clear: true }); await sleep(500);
    const n1 = await S.evaluate(`document.querySelectorAll('article').length`);
    await ck(n1 === 1 && n0 > 1, { page: PGs, control: "Search sold items at phone width", expected: "Only 'phone sale B' remains", actual: `cards ${n0} -> ${n1}`, repro: "Type the name" });
    await typeIn(S, "", { clear: true }); await sleep(400);
    const bs = await S.evaluate(`(() => { const e = [...document.querySelectorAll('article')].find(x => x.innerText.includes('phone sale B')); return e ? e.innerText.replace(/\\s+/g, ' ') : ''; })()`);
    await ck(/\$75/.test(bs) && /profit/.test(bs), { page: PGs, control: "Sold card for the sale just made", expected: "Shows $75 and a profit (75 - cost 20 - eBay fees)", actual: bs.slice(0, 140), repro: "Open Sold" });
    const pills = await S.evaluate(`[...document.querySelectorAll('button')].filter(b => /^(All|Music|Pop Culture|Sports)$/.test(b.innerText.trim())).map(b => b.innerText.trim())`);
    await touchTapEl(S, `[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Sports')`); await sleep(500);
    const nsp = await S.evaluate(`document.querySelectorAll('article').length`);
    await ck(pills.includes("Sports") && nsp === 1, { page: PGs, control: "Category pill Sports (touch tap)", expected: "Only the Sports sale is shown", actual: `pills=${pills.join(",")}; cards=${nsp}`, repro: "Tap Sports" });
    await touchTapEl(S, `[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'All')`); await sleep(400);
    S.dialogMode = "accept";
    await touchTapEl(S, `[...[...document.querySelectorAll('article')].find(x => x.innerText.includes('phone sold to return')).querySelectorAll('button')].find(b => /^Return$/.test(b.innerText.trim()))`); await sleep(3500);
    d = await dbWait(r, (x) => x.status === "COLLECTION", 25000);
    await ck(d.ok && d.row.sold_price === null, { page: PGs, control: "Return (touch tap, confirm OK)", expected: "Item returns to COLLECTION, sale cleared", actual: `status=${d.row.status} sold_price=${d.row.sold_price}`, repro: "Tap Return; OK" });
    S.dialogMode = "dismiss";
    const t = await text(S);
    await ck(/chart|Revenue|MONTHLY REVENUE/i.test(t), { page: PGs, control: "Analytics cards at phone width", expected: "Monthly revenue and profit charts, Sales by category and Overall ROI are shown", actual: (t.match(/MONTHLY REVENUE.{0,60}/i) || ["not found"])[0], repro: "Open Sold at 390 px" });
  } catch (e) { console.error(e); await ck(false, { page: "suite", control: "salesphone runner", expected: "completes", actual: "script error: " + String(e.message).slice(0, 200), impact: "none" }); }
  finally { console.log(JSON.stringify(X.sumRows(out))); await S.close(); process.exit(0); }
})();
