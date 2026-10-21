// Batch 4 gap closure on PRODUCTION (synthetic fixture): (1) the Sell button on a Vault list row, (2) Bulk with '1e3' in the value field.
//   AUDIT_MANIFEST=<manifest> node rb10-sell-bulk.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const L = require(path.join(SD, "audit-lib.cjs"));
const { mclick, byText, text, dbItem, dbWait, mkItem, sleep, dismissBanner, P, ST } = X;
const { click, typeInto, alertText, pickSelect, chooseViaButton, mkPng, tmp, rowsByTitle, btnExpr, removeItems } = T;
const LABEL = process.argv[2] || "run";
const r = L.R("RB10");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] };
const num = (s) => Number(String(s ?? "").replace(/[^0-9.\-]/g, ""));
let S, n = 0;
const created = [];
const shotPath = (rel) => rel ? path.join(L.AUD, rel).replace(/\//g, "\\") : "";
async function rec(ok, control, expected, actual, page) {
  let ev = ""; try { await sleep(300); ev = shotPath(await S.jshot(`rb10-${LABEL}-${++n}`)); } catch {}
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page: `${page} | owner, Personal, desktop 1440`, control, expected, actual, evidence: ev ? path.relative(L.AUD, ev).replace(/\\/g, "/") : "", impact: "RB10 (batch 4 gap closure)", repro: "" });
}
const refusal = (m) => /can't be negative|numbers only|not a number|enter an amount|enter one amount|decimal|not supported|too large|at least|Nothing was|not a valid|spaces inside|use a period|Enter the sale price/i.test(m || "");
const bodyT = async (x = S) => (await x.text()).replace(/\s+/g, " ");
const stubPrompts = (answers) => S.evaluate(`(() => { window.__pq = ${JSON.stringify(answers)}; window.__prompts = []; window.prompt = (msg) => { window.__prompts.push(String(msg)); return window.__pq.length ? window.__pq.shift() : null; }; return true; })()`);
const prompts = () => S.evaluate("window.__prompts || []");
const legacyHas = (id) => S.evaluate(`(() => { try { const l = JSON.parse(localStorage.getItem('vltd_sales_history') || '[]'); return Array.isArray(l) && l.some((x) => String(x.id) === ${JSON.stringify(id)}); } catch { return false; } })()`);

(async () => {
  S = await X.S_("owner", { width: 1440, height: 900 });
  try {
    // ============================================================ 1. the Sell button on a Vault list row
    const title = `QA RB10 sell ${ST}`;
    const id = await mkItem("rb10s", { title, purchase_price: 40, purchase_tax: 4, current_value: 150 });
    const openList = async () => {
      await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 3", 90000, "vault list").catch(() => {}); await sleep(2500); await dismissBanner(S);
      // the Sell button is on the Gallery / Flip cards (the Wall view has none)
      await mclick(S, byText("^Gallery$", "button")); await sleep(2000);
      const found = await S.evaluate(`!!document.body.innerText.includes(${JSON.stringify(title)})`);
      if (!found) { await S.evaluate(`(() => { const i = [...document.querySelectorAll('input')].find((e) => /search/i.test((e.placeholder || '') + (e.getAttribute('aria-label') || ''))); if (i) { i.focus(); } return !!i; })()`); await S.send("Input.insertText", { text: title }); await sleep(1500); }
    };
    // the Sell button of the row that holds the title (walks up from each Sell button until the row text contains the title)
    const sellBtn = `(() => { const bs = [...document.querySelectorAll('button')].filter((b) => /^(Sell|Selling\\.\\.\\.)$/.test(b.innerText.trim())); for (const b of bs) { let e = b; for (let i = 0; i < 8 && e; i++) { e = e.parentElement; if (e && (e.innerText || '').includes(${JSON.stringify(title)}) && (e.innerText || '').length < 900) return b; } } return null; })()`;
    await openList();
    const hasBtn = await S.evaluate(`!!(${sellBtn})`);
    await rec(hasBtn, "Vault list row for the synthetic item shows the Sell button", "the Sell button is on the item's row (this is the app's Sell action; the item detail page has no Sell button, it has the For Sale toggle and Cost to Sell)", `Sell button found=${hasBtn}`, "/vault");

    const untouched = async (what) => {
      const d = await dbItem(id); const legacy = await legacyHas(id); const t = await bodyT();
      return { ok: d.status !== "SOLD" && d.sold_price === null && d.sold_at === null && d.sold_platform === null && !legacy && !new RegExp(title + ".{0,200}Sold \\$").test(t), d, legacy, what };
    };
    for (const [label, answers] of [["letters 'abc'", ["abc", "eBay"]], ["negative -50", ["-50", "eBay"]], ["exponent '1e3'", ["1e3", "eBay"]], ["comma '1,5'", ["1,5", "eBay"]], ["blank", ["", "eBay"]], ["cancelled price prompt", [null, "eBay"]]]) {
      await stubPrompts(answers);
      await mclick(S, sellBtn); await sleep(2500);
      const t = await bodyT(); const asked = await prompts(); const u = await untouched(label);
      const msg = (t.match(/(can't be negative|use numbers only|use a period[^.]*|Enter the sale price[^.]*|Nothing was marked sold)/i) || [""])[0];
      const cancelled = answers[0] === null;
      await rec(u.ok && asked.length === 1 && (cancelled || refusal(msg)), `Sell with ${label} as the sale price`, cancelled ? "nothing changes (cancel)" : "a visible refusal; nothing is sold and nothing is written (database, this browser's sales list, the row); the platform question is never asked", `status=${u.d.status}; sold_price=${u.d.sold_price}; sold_platform=${u.d.sold_platform}; this browser's sales list has it=${u.legacy}; prompts asked=${asked.length}; visible message='${msg}'`, "/vault");
    }
    // one valid synthetic sale
    await stubPrompts(["$120", "eBay"]);
    await mclick(S, sellBtn); await sleep(3000);
    const sold = await dbWait(id, (x) => x.status === "SOLD" && Number(x.sold_price) === 120, 40000);
    await rec(sold.ok && sold.row.sold_platform === "eBay" && sold.row.sold_at, "Sell with a valid price ($120 on eBay)", "the item is SOLD in the account with sold_price 120, platform eBay and a sold date", `status=${sold.row.status}; sold_price=${sold.row.sold_price}; sold_platform=${sold.row.sold_platform}; sold_at=${sold.row.sold_at}`, "/vault");

    // after reload: item page, Sold card, Sales History (same browser), then a clean second browser
    const read = async (X2) => {
      const o = {};
      await X2.visit(`/vault/item/${id}?sold=1`); await sleep(3500);
      const it = await bodyT(X2);
      o.item = { price: (it.match(/Sold Price\s*(\$[\d,.]+)/) || [])[1], cost: (it.match(/Cost \(all-in\)\s*(\$[\d,.]+)/) || [])[1], fees: (it.match(/Estimated fees\s*(\$[\d,.]+)/) || [])[1], profit: (it.match(/Profit \/ Loss\s*(\+?-?\$[\d,.]+)/) || [])[1] };
      await X2.visit("/vault/sold"); await sleep(4500);
      const sc = await X2.evaluate(`(() => { const a = [...document.querySelectorAll('article')].find((a) => a.innerText.includes(${JSON.stringify(title)})); return a ? a.innerText.replace(/\\s+/g, ' ') : ''; })()`);
      o.soldCard = { text: sc.slice(0, 160), price: (sc.match(/(\$[\d,.]+)\s*\+?-?\$[\d,.]+ profit/) || [])[1], profit: (sc.match(/(\+?-?\$[\d,.]+) profit/) || [])[1] };
      await X2.visit("/sales"); await sleep(5000);
      const hc = await X2.evaluate(`(() => { const e = [...document.querySelectorAll('a')].find((a) => a.innerText.trim() === ${JSON.stringify(title)}); const c = e && (e.closest('div.rounded-2xl') || e.closest('article') || e.parentElement.parentElement); return c ? c.innerText.replace(/\\s+/g, ' ') : ''; })()`);
      o.sales = { text: hc.slice(0, 200), price: (hc.match(/Sold\s+(\$[\d,.]+)/) || [])[1], cost: (hc.match(/Cost\s+(\$[\d,.]+)/) || [])[1], profit: (hc.match(/(\+\$[\d,.]+|-\$[\d,.]+)/) || [])[1] };
      return o;
    };
    const agree = (o) => {
      const fees = num(o.item.fees || 0); const expected = 120 - 44 - fees;
      const okItem = num(o.item.price) === 120 && num(o.item.cost) === 44 && o.item.profit && Math.abs(num(o.item.profit) - expected) <= 1;
      const okSold = o.soldCard.profit && num(o.soldCard.profit) === num(o.item.profit) && num(o.soldCard.price) === 120;
      const okSales = num(o.sales.price) === 120 && num(o.sales.cost) === 44 && o.sales.profit && num(o.sales.profit) === num(o.item.profit);
      return { okItem, okSold, okSales, expected };
    };
    const a1 = await read(S); const g1 = agree(a1);
    await rec(g1.okItem && g1.okSold && g1.okSales, "After reload: price, cost and profit on the item page, the Sold card and Sales History", "sold price $120, cost $44 (40 + 4 tax), estimated fees shown, and the same profit (120 - 44 - fees) on all three pages", `item page ${JSON.stringify(a1.item)}; Sold card ${JSON.stringify(a1.soldCard)}; Sales History ${JSON.stringify(a1.sales)}; expected profit about ${g1.expected.toFixed(2)}`, "/vault/item/[id]?sold=1, /vault/sold, /sales");
    await S.close();
    S = await X.S_("owner", { width: 1440, height: 900 });
    const a2 = await read(S); const g2 = agree(a2);
    await rec(g2.okItem && g2.okSold && g2.okSales && a2.item.profit === a1.item.profit, "Clean second browser: price, cost and profit on the item page, the Sold card and Sales History", "same figures as in the first browser", `item page ${JSON.stringify(a2.item)}; Sold card ${JSON.stringify(a2.soldCard)}; Sales History ${JSON.stringify(a2.sales)}`, "/vault/item/[id]?sold=1, /vault/sold, /sales");

    if (process.env.ONLY === "sell") throw new Error("ONLY-SELL-DONE");
    // ============================================================ 2. Bulk with '1e3' in the money field
    const imgs = []; for (let i = 0; i < 2; i++) imgs.push(mkPng(tmp(`rb10b${i}.png`), 600 + i * 40, 400 + i * 30, [40 + i * 50, 120, 200 - i * 40]));
    const sel = (i) => `document.querySelectorAll('select')[${i}]`;
    await S.visit("/vault/bulk"); await S.waitFor("document.querySelectorAll('select').length >= 1", 60000, "bulk"); await sleep(1500);
    await chooseViaButton(S, btnExpr("Choose photos|Add more photos"), imgs); await sleep(2500);
    await pickSelect(S, sel(0), "Music"); await sleep(400);
    const cats = await S.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim()).filter((x) => x && !/Select/.test(x))");
    await pickSelect(S, sel(1), cats[0]); await sleep(400);
    await click(S, btnExpr("fill in by hand")); await sleep(2000);
    const bt = `QA RB10 bulk ${ST}`;
    const names = "[...document.querySelectorAll('input')].filter((i) => i.placeholder === 'Untitled Item')";
    const vals = "[...document.querySelectorAll('input[type=number],input[inputmode=decimal]')]";
    const addAll = "[...document.querySelectorAll('button')].find((b) => /^Add all \\d+ to Vault/.test(b.textContent.trim()))";
    await typeInto(S, `(${names})[0]`, bt); await typeInto(S, `(${names})[1]`, bt + " two");
    await typeInto(S, `(${vals})[0]`, "1e3"); await typeInto(S, `(${vals})[1]`, "0");
    const typed = await S.evaluate(`(${vals}).map((i) => i.value)`);
    const usageBefore = 0;
    await click(S, addAll);
    const moved = await S.waitFor("location.pathname === '/vault'", 20000, "after add all").then(() => true).catch(() => false);
    const t1 = await bodyT(); const m1 = (t1.match(/(Current value \(photo \d+\)[^.]*\.|use numbers only[^.]*\.?)/i) || [""])[0];
    const rowsAfterBad = await rowsByTitle(P, "QA RB10 bulk");
    await rec(!moved && refusal(m1) && rowsAfterBad.length === 0, "Bulk: '1e3' in the Current value field, Add all", "a visible refusal naming the photo and the problem; the page stays on the review grid; nothing is written (no item rows)", `field value typed=${JSON.stringify(typed)}; moved to Vault=${moved}; visible message='${m1}'; item rows for this title=${rowsAfterBad.length}`, "/vault/bulk");
    await typeInto(S, `(${vals})[0]`, "1000"); await sleep(400);
    await click(S, addAll);
    const moved2 = await S.waitFor("location.pathname === '/vault'", 90000, "after corrected add all").then(() => true).catch(() => false);
    const rows = await T.poll(async () => { const x = await rowsByTitle(P, "QA RB10 bulk"); return x.length >= 2 ? x : null; }, 60000, 2000) || await rowsByTitle(P, "QA RB10 bulk");
    created.push(...rows);
    const r1 = rows.find((x) => x.title === bt), r2 = rows.find((x) => x.title === bt + " two");
    await rec(moved2 && r1 && Number(r1.current_value) === 1000 && r2 && r2.current_value !== null && Number(r2.current_value) === 0, "Bulk: corrected to 1000, Add all", "saved: the first item with current_value 1000 and the second with an explicit 0; the app moves to the Vault", `moved=${moved2}; first current_value=${r1 && r1.current_value}; second current_value=${r2 && r2.current_value}`, "/vault/bulk");
  } catch (e) { if (e.message === "ONLY-SELL-DONE") { } else { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 700); } }
  finally {
    try { await removeItems(created); } catch {}
    fs.writeFileSync(path.join(EV, `rb10-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    try { await S.close(); } catch {}
    process.exit(0);
  }
})();
