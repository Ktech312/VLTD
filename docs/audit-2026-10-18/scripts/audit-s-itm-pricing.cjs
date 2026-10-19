// ITM pricing card extras (comparables, paste sold results, confidence, search links) and the Home sales card drill-down to /vault/sold#sales-analytics.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, typeIn, ENTER, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, P } = X;
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
const num = (s) => Number(String(s || "").replace(/[^0-9.\-]/g, ""));
(async () => {
  let S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  const { ck, nt, out } = X.makeCk(() => S, {});
  const PG = (e = "") => `/vault/item/[id] | owner, Personal, ${dev}${e ? ", " + e : ""}`;
  try {
    const id = await mkItem("prx", { title: "QA ITM pricing extras", purchase_price: 50 });
    await X.openItem(S, id); await dismissBanner(S);
    // search links
    const links = await S.evaluate(`[...document.querySelectorAll('a[href^="http"]')].map(a => ({ t: a.innerText.trim(), href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') }))`);
    const bad = links.filter((l) => l.target !== "_blank" || !/noopener/.test(l.rel || ""));
    await ck(links.length >= 3 && bad.length === 0 && links.filter((l) => !/covrprice[.]com/.test(l.href)).every((l) => /QA(%20|\+)ITM/.test(l.href)), { page: PG(), control: "Pricing research links (eBay Sold Listings, MyComicShop, CovrPrice, Google)", expected: "Each opens in a new tab safely (noopener) and searches for this item's title", actual: `${links.length} links: ${links.map((l) => l.t).join(", ")}; unsafe=${bad.length}`, repro: "Read the links under PRICING MVP" });
    const cp0 = (await S.look()).clip.length; const covr = await S.evaluate(`!![...document.querySelectorAll('a')].find(a => /CovrPrice/.test(a.innerText))`);
    if (covr) { await mclick(S, byText("^CovrPrice", "a")); await sleep(600); const lk = await S.look(); await ck(lk.clip.length > cp0 && /QA ITM pricing extras/.test(lk.clip[lk.clip.length - 1] || ""), { page: PG(), control: "CovrPrice link (cannot carry a search)", expected: "Clicking copies the item title for pasting into their search box", actual: `clipboard: ${(lk.clip || []).slice(-1)[0]}; window.open: ${JSON.stringify(lk.opens.slice(-1))}`, repro: "Click CovrPrice under PRICING MVP" }); }
    // add a comp
    await mclick(S, byText("^Details$", "button")); await sleep(500);
    await mclick(S, byText("^\\+ Add comp$", "button")); await sleep(400);
    const fill = async (ph, v) => { await mclick(S, `document.querySelector('input[placeholder="${ph}"]')`); await typeIn(S, v, { clear: true }); };
    await fill("Source (eBay…)", "eBay QA"); await fill("Sold price", "80"); await fill("Sale date", "2026-10-01");
    await mclick(S, byText("^Add$", "button")); await sleep(1800);
    let d = await dbWait(id, (r) => Array.isArray(r.comparables) && r.comparables.length === 1, 25000);
    await ck(d.ok && Number(d.row.comparables[0].salePrice) === 80, { page: PG(), control: "+ Add comp (eBay QA, $80)", expected: "The comparable is saved on the item", actual: `db comparables=${JSON.stringify(d.row.comparables)}`, repro: "Add comp; source, price, date; Add" });
    // add comp with a negative / zero price must be refused
    await mclick(S, byText("^\\+ Add comp$", "button")); await sleep(300);
    await fill("Source (eBay…)", "eBay NEG"); await fill("Sold price", "-20");
    await mclick(S, byText("^Add$", "button")); await sleep(1500);
    d = await dbItem(id);
    await ck(d.comparables.length === 1, { page: PG(), control: "+ Add comp with a negative price (-20)", expected: "Refused: nothing added", actual: `comparables now ${d.comparables.length}`, repro: "Add comp with price -20" });
    await mclick(S, byText("^Cancel$", "button")); await sleep(300);
    // use as value
    await mclick(S, `document.querySelector('button[title="Use this sale as the current value"]')`); await sleep(1800);
    d = await dbWait(id, (r) => Number(r.current_value) === 80, 25000);
    await ck(d.ok, { page: PG(), control: "Use this sale as the current value", expected: "current_value becomes 80 and MARKET reads $80", actual: `db current_value=${d.row.current_value}; MARKET: ${((await text(S)).match(/MARKET\s*\$\S+/) || [""])[0]}`, repro: "Click the check on a comparable" });
    // remove comp
    await mclick(S, `document.querySelector('button[aria-label="Remove this comparable"]')`); await sleep(1800);
    d = await dbWait(id, (r) => !r.comparables || r.comparables.length === 0, 25000);
    await ck(d.ok, { page: PG(), control: "Remove this comparable", expected: "The comparable is removed (and only it)", actual: `db comparables=${JSON.stringify(d.row.comparables)}`, repro: "Click the trash on a comparable" });
    // confidence
    const conf = await S.evaluate(`!![...document.querySelectorAll('button')].find(b => /Change…|Confidence/.test(b.innerText))`);
    await mclick(S, byText("^Change…$|^Change\\.\\.\\.$", "button")); await sleep(500);
    const opts = await S.evaluate(`[...document.querySelectorAll('[role=menuitem],[role=option],button')].map(b => b.innerText.trim()).filter(x => /^(High|Medium|Low|Unknown)$/.test(x))`);
    if (opts.includes("High")) {
      await mclick(S, byText("^High$", "[role=menuitem],[role=option],button")); await sleep(1800);
      d = await dbWait(id, (r) => r.price_confidence === "high", 25000);
      await ck(d.ok, { page: PG(), control: "Confidence -> High", expected: "price_confidence = high saved", actual: `db price_confidence=${d.row.price_confidence}`, repro: "Confidence: Change…; High" });
    } else nt({ page: PG(), control: "Confidence picker", expected: "options High/Medium/Low", actual: `found: ${opts.join(",")}`, impact: "none" });
    // paste sold results
    await mclick(S, byText("^Paste sold results$", "button")); await sleep(500);
    const ta = await S.evaluate(`!!document.querySelector('textarea')`);
    nt({ page: PG(), control: "Paste sold results", expected: "Observation: opens a paste box (parse of pasted marketplace text is local; nothing is fetched)", actual: `textarea shown=${ta}`, impact: "none", repro: "Click Paste sold results" });
    await ESC(S);
    await S.close();

    // ---------- Home sales card drill-down ----------
    S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
    await S.visit("/dashboard"); await sleep(3500); await dismissBanner(S);
    const card = await S.evaluate(`(() => { const a = [...document.querySelectorAll('a[href="/vault/sold#sales-analytics"]')]; return a.map(x => x.innerText.replace(/\\s+/g,' ').slice(0, 160)); })()`);
    const PGh = `/dashboard | owner, Personal, ${dev}`;
    const homeRev = num((card[0] || "").match(/\$[\d,]+/)?.[0]); const homeCount = num((card[0] || "").match(/(\d+) sold/)?.[1]);
    const homeProfit = (card[0] || "").match(/Profit ([+\-]\$[\d,]+)/)?.[1];
    await mclick(S, `document.querySelector('a[href="/vault/sold#sales-analytics"]')`); await sleep(3500);
    const path = await S.path(); const t = await text(S);
    const anc = await S.evaluate(`(() => { const e = document.getElementById('sales-analytics'); if (!e) return null; const r = e.getBoundingClientRect(); return { inView: r.top < innerHeight && r.bottom > 0, top: Math.round(r.top) }; })()`);
    await ck(path === "/vault/sold" && anc && anc.inView, { page: PGh, control: "Home 'Sales revenue' card (drill-down)", expected: "Opens /vault/sold with the analytics section in view", actual: `landed on ${path}${await S.evaluate("location.hash")}; section in view=${anc && anc.inView}`, repro: "Home: click the Sales revenue card" });
    const chip = (label) => { const mm = t.match(new RegExp(label + "\\s+(\\+?-?\\$[\\d,]+)")); return mm ? num(mm[1]) : null; };
    const soldN = Number((t.match(/SOLD\s+(\d+)\s+REVENUE/i) || [])[1]); const soldRev = chip("REVENUE"); const soldProfit = chip("REALIZED PROFIT");
    await ck(homeCount === soldN && homeRev === soldRev, { page: `${PGh} vs /vault/sold`, control: "Home sales card figures vs the Sold page", expected: "Same number of sales and same revenue on both pages", actual: `Home card: ${card[0] || "not found"} | Sold page: ${soldN} sold, revenue $${soldRev}`, impact: "misleading result", repro: "Compare the Home Sales revenue card with Sold" });
    await ck(homeProfit && num(homeProfit) === soldProfit, { page: `${PGh} vs /vault/sold`, control: "Home profit figure vs Realized profit", expected: "Same profit after fees", actual: `Home ${homeProfit} vs Sold ${soldProfit}`, impact: "misleading result", repro: "Compare Profit on Home with Realized profit on Sold" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "pricing suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { console.log(JSON.stringify(X.sumRows(out))); try { await S.close(); } catch {} process.exit(0); }
})();
