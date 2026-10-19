// ITM Sales History (/sales) rerun in clean browsers: empty ledger, seeded ledger (4 rows), and the sale recorded from the For Sale page.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, typeIn, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, P, ST } = X;
const num = (s) => Number(String(s || "").replace(/[^0-9.\-]/g, ""));
const PGh = (e = "") => `/sales | owner, Personal, desktop 1440${e ? ", " + e : ""}`;
(async () => {
  let S = null; const { ck, nt, out } = X.makeCk(() => S, {});
  try {
    await admin.from("sales").delete().eq("profile_id", P);
    // ---- A. empty ledger, items sold in the vault ----
    S = await X.S_("owner", { width: 1440, height: 900 });
    await S.visit("/sales"); await sleep(2500); await dismissBanner(S);
    let t = await text(S);
    const soldN = ((await admin.from("vault_items").select("id").eq("profile_id", P).eq("status", "SOLD")).data || []).length;
    await ck(/Your sales are on the Sold page/.test(t) && new RegExp(soldN + " sold items").test(t), { page: PGh(`empty ledger, ${soldN} items sold in the vault`), control: "Sales History empty ledger", expected: `Says the sales are on the Sold page and counts them (${soldN})`, actual: (t.match(/Your sales are on the Sold page.{0,110}/) || [t.slice(60, 220)])[0], repro: "Open /sales in a clean browser for a profile whose sales live on Sold" });
    await mclick(S, byText("^Open Sold$", "a")); await sleep(2500);
    await ck((await S.path()).startsWith("/vault/sold"), { page: PGh(), control: "Open Sold (link)", expected: "Goes to /vault/sold", actual: await S.path(), repro: "Click Open Sold" });
    await S.close();

    // ---- B. seeded ledger ----
    const base = Date.now();
    const rows = [
      { id: `qa_sale_${ST}_1`, title: "QA Ledger Win", universe: "POP_CULTURE", category: "Comics", purchase_price: 20, sale_price: 100, platform: "eBay", sold_at: new Date(base - 3 * 86400e3).toISOString() },
      { id: `qa_sale_${ST}_2`, title: "QA Ledger Loss", universe: "SPORTS", category: "Sports Cards", purchase_price: 80, sale_price: 50, platform: "Whatnot", sold_at: new Date(base - 10 * 86400e3).toISOString() },
      { id: `qa_sale_${ST}_3`, title: "QA Ledger No Cost", universe: "POP_CULTURE", category: "Comics", purchase_price: null, sale_price: 70, platform: "In person", sold_at: new Date(base - 40 * 86400e3).toISOString() },
      { id: `qa_sale_${ST}_4`, title: "QA Ledger Zero Cost", universe: "MUSIC", category: "Audio Formats", purchase_price: 0, sale_price: 30, platform: "In person", sold_at: new Date(base - 70 * 86400e3).toISOString() },
    ].map((r) => ({ ...r, profile_id: P, profit: null }));
    const ins = await admin.from("sales").insert(rows); if (ins.error) throw new Error("seed sales: " + ins.error.message);
    S = await X.S_("owner", { width: 1440, height: 900 });
    await S.visit("/sales"); await sleep(3500); await dismissBanner(S); t = await text(S);
    await ck(num((t.match(/TOTAL SOLD\s*(\$[\d,]+)/i) || [])[1]) === 250 && /4 sales/.test(t), { page: PGh("4 ledger rows"), control: "Total Sold card", expected: "$250, 4 sales (100+50+70+30)", actual: (t.match(/TOTAL SOLD.{0,30}/i) || [""])[0], repro: "Open /sales with 4 rows" });
    const winCnt = Number((t.match(/WINS\s*(\d+)/i) || [])[1]), lossCnt = Number((t.match(/LOSSES\s*(\d+)/i) || [])[1]);
    await ck(winCnt === 2 && lossCnt === 1, { page: PGh(), control: "Wins / Losses cards", expected: "Wins 2 (the win and the $0-cost sale), Losses 1; a sale with no recorded cost is neither", actual: `wins=${winCnt}, losses=${lossCnt}`, impact: "misleading result", repro: "Read Wins / Losses" });
    const cardText = async (title) => S.evaluate(`(() => { const e=[...document.querySelectorAll('a')].find(a=>a.innerText.trim()===${JSON.stringify(title)}); const card = e && e.closest('div.rounded-2xl'); return card ? card.innerText.replace(/\\s+/g,' ') : ''; })()`);
    const nc = await cardText("QA Ledger No Cost");
    await ck(!/\+\$\d+/.test(nc), { page: PGh("sale with no recorded cost"), control: "Sale card with no purchase price", expected: "Profit unknown: not shown as a +$70 gain equal to the sale price (value rule)", actual: nc.slice(0, 160), impact: "misleading result", repro: "A ledger sale without a purchase price" });
    const wc = await cardText("QA Ledger Win"), lc = await cardText("QA Ledger Loss"), zc = await cardText("QA Ledger Zero Cost");
    const winP = num((wc.match(/\+\$[\d,]+/) || [])[0]);
    await ck(winP > 0 && winP < 80 && /Bought\s*\$20/.test(wc) && /Sold\s*\$100/.test(wc), { page: PGh(), control: "Sale card for a win (cost 20, sold 100, eBay)", expected: "Profit under $80 because eBay fees are taken off; Bought $20, Sold $100", actual: wc.slice(0, 160), repro: "Read the card" });
    await ck(/-\$\d+/.test(lc) && /Bought\s*\$80/.test(lc), { page: PGh(), control: "Sale card for a loss (cost 80, sold 50)", expected: "A negative P&L and Bought $80, Sold $50", actual: lc.slice(0, 160), repro: "Read the card" });
    await ck(/Bought\s*—/.test(zc) === false || /Bought\s*\$0/.test(zc), { page: PGh("explicit $0 cost"), control: "Sale card with a recorded $0 cost", expected: "Shows Bought $0 (a recorded zero), not a dash that reads as 'unknown'", actual: zc.slice(0, 160), impact: "misleading result", repro: "A ledger sale with purchase_price 0" });
    const order = async () => S.evaluate(`[...document.querySelectorAll('a.font-semibold')].map(a=>a.innerText.trim()).filter(x=>/^QA Ledger/.test(x))`);
    const pBadges = async () => S.evaluate(`[...document.querySelectorAll('a.font-semibold')].filter(a=>/^QA Ledger/.test(a.innerText.trim())).map(a => { const c=a.closest('div.rounded-2xl'); const b=c.querySelector('div.rounded-full'); return a.innerText.trim()+'='+(b?b.innerText.trim():''); })`);
    await mclick(S, byText("^Profit$", "button")); await sleep(500); const oP = await order();
    await mclick(S, byText("^Sale Price$", "button")); await sleep(500); const oS = await order();
    await mclick(S, byText("^Date$", "button")); await sleep(500); const oD = await order();
    await ck(JSON.stringify(oS) === JSON.stringify(["QA Ledger Win", "QA Ledger No Cost", "QA Ledger Loss", "QA Ledger Zero Cost"]) && JSON.stringify(oD) === JSON.stringify(["QA Ledger Win", "QA Ledger Loss", "QA Ledger No Cost", "QA Ledger Zero Cost"]), { page: PGh(), control: "Sort buttons: Sale Price and Date", expected: "Sale Price: 100, 70, 50, 30; Date: newest first (3d, 10d, 40d, 70d)", actual: `price=${oS.join(">")} | date=${oD.join(">")}`, repro: "Click Sale Price, then Date" });
    const badges = await pBadges();
    const pv = Object.fromEntries(badges.map((b) => [b.split("=")[0], num(b.split("=")[1])]));
    const sortedByBadge = Object.keys(pv).sort((a, b) => pv[b] - pv[a]);
    await ck(JSON.stringify(oP) === JSON.stringify(sortedByBadge), { page: PGh(), control: "Sort by Profit", expected: "Cards ordered by the profit shown on each card (high to low)", actual: `order=${oP.join(">")}; badges=${badges.join(", ")}`, repro: "Click Profit" });
    await mclick(S, `document.querySelector('input[placeholder="Search sales…"]')`); await typeIn(S, "Loss", { clear: true }); await sleep(500);
    let os = await order();
    await ck(os.length === 1 && os[0] === "QA Ledger Loss", { page: PGh(), control: "Search sales ('Loss')", expected: "Only the loss", actual: os.join(","), repro: "Type Loss" });
    await typeIn(S, "zzzz", { clear: true }); await sleep(500); t = await text(S);
    await ck(/No sales match your filter/.test(t), { page: PGh(), control: "Search sales (no match)", expected: "'No sales match your filter.'", actual: /No sales match/.test(t) ? "shown" : t.slice(60, 140), repro: "Type zzzz" });
    await typeIn(S, "", { clear: true }); await sleep(300);
    await mclick(S, byText("^SPORTS$", "button")); await sleep(500);
    os = await order();
    await ck(os.length === 1 && os[0] === "QA Ledger Loss", { page: PGh(), control: "Category pills (SPORTS)", expected: "Only the sports sale", actual: os.join(","), repro: "Click SPORTS" });
    await mclick(S, byText("^All$", "button")); await sleep(300);
    await ck(await S.evaluate(`!!document.querySelector('svg[viewBox^="0 0 100"]')`), { page: PGh(), control: "Revenue sparkline", expected: "Shown when sales span 2+ months", actual: "checked", repro: "Open /sales" });
    await S.close();

    // ---- C. a sale recorded on the For Sale page, then Sales History (clean browser) ----
    await admin.from("sales").delete().eq("profile_id", P);
    const idSale = await mkItem("hist1", { title: "QA ITM history sale", status: "FOR_SALE", asking_price: 90, purchase_price: 30 });
    S = await X.S_("owner", { width: 1440, height: 900 });
    await S.visit("/vault/for-sale"); await sleep(2000); await dismissBanner(S);
    await S.evaluate(`(() => { window.__pq = ["$85", "Whatnot"]; window.prompt = () => window.__pq.shift(); return true; })()`);
    await mclick(S, `[...[...document.querySelectorAll('article')].find(a=>a.innerText.includes("QA ITM history sale")).querySelectorAll('button')].find(b=>/^Mark sold$/.test(b.innerText.trim()))`); await sleep(3000);
    const d = await dbWait(idSale, (r) => r.status === "SOLD", 25000);
    await S.visit("/sales"); await sleep(3500); t = await text(S);
    const hc = await S.evaluate(`(() => { const e=[...document.querySelectorAll('a')].find(a=>a.innerText.trim()==='QA ITM history sale'); const c=e && e.closest('div.rounded-2xl'); return c ? c.innerText.replace(/\\s+/g,' ') : ''; })()`);
    await ck(d.ok && /Sold\s*\$85/.test(hc), { page: PGh("item sold on the For Sale page for $85"), control: "Sales History card for a sale made on For Sale", expected: "The sale appears with Sold $85 (vault sold_price=85)", actual: `db sold_price=${d.row.sold_price}; Sales History card: ${hc || "no card"}; Total Sold card: ${(t.match(/TOTAL SOLD.{0,30}/i) || [""])[0]}`, impact: "misleading result", repro: "For Sale: Mark sold at $85. Open Sales History in the same browser" });
    await S.close();
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "sales2 suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { try { await admin.from("sales").delete().eq("profile_id", P); } catch {} console.log(JSON.stringify(X.sumRows(out))); try { await S.close(); } catch {} process.exit(0); }
})();
