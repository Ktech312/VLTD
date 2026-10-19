// ITM Sold analytics against the database (category chart, monthly profit chart) and the For Sale readiness chips.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, text, dbItem, mkItem, sleep, admin, dismissBanner, P } = X;
const num = (s) => Number(String(s || "").replace(/[^0-9.\-]/g, ""));
(async () => {
  const S = await X.S_("owner", { width: 1440, height: 900 });
  const { ck, nt, out } = X.makeCk(() => S, {});
  try {
    await S.visit("/vault/sold"); await sleep(3000); await dismissBanner(S);
    const sold = (await admin.from("vault_items").select("id,universe,sold_price,sold_at,purchase_price,purchase_tax,purchase_shipping,purchase_fees,title").eq("profile_id", P).eq("status", "SOLD")).data || [];
    const byU = {}; for (const r of sold) byU[r.universe] = (byU[r.universe] || 0) + Number(r.sold_price || 0);
    const label = { POP_CULTURE: "Pop Culture", SPORTS: "Sports", MUSIC: "Music" };
    const catTxt = (await text(S)).match(/SALES BY CATEGORY(.*?)OVERALL ROI/i);
    const catOK = Object.entries(byU).every(([u, v]) => new RegExp((label[u] || u) + "\\s*\\$" + Math.round(v).toLocaleString().replace(/,/g, ",?")).test(catTxt ? catTxt[1] : ""));
    await ck(catOK, { page: "/vault/sold | owner, Personal, desktop 1440", control: "Sales by Category chart", expected: `Revenue per category equals the database: ${JSON.stringify(byU)}`, actual: catTxt ? catTxt[1].slice(0, 160) : "chart not found", repro: "Compare the chart with the sold prices" });
    // monthly profit from cards
    const cards = await S.evaluate(`[...document.querySelectorAll('article')].map(a => { const t = a.innerText.replace(/\\s+/g,' '); return { t }; })`);
    const aria = await S.evaluate(`[...document.querySelectorAll('[aria-label^="Profit or loss by month"]')].map(e => e.getAttribute('aria-label'))[0] || ''`);
    const months = {}; let parsed = 0;
    for (const c of cards) { const pm = c.t.match(/([+\-]?\$[\d,]+) profit/); const dm = c.t.match(/([A-Z][a-z]{2}) (\d{1,2}), (\d{2})(?: |$)/); if (!pm || !dm) continue; const mi = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(dm[1]) + 1; const key = `20${dm[3]}-${String(mi).padStart(2, "0")}`; months[key] = (months[key] || 0) + num(pm[1]); parsed++; }
    const ok = Object.entries(months).every(([k, v]) => { const mm = aria.match(new RegExp(k + " (-?\\$[\\d,]+|no recorded cost)")); return mm && Math.abs(num(mm[1]) - v) <= parsed; });
    await ck(parsed > 0 && ok, { page: "/vault/sold | owner, Personal, desktop 1440", control: "Monthly Profit/Loss chart", expected: `Per-month profit equals the sum of that month's card profits: ${JSON.stringify(months)} (rounding tolerance)`, actual: aria.slice(0, 230), repro: "Add up the card profits per month" });
    // For Sale readiness chips
    const id = await mkItem("chips", { title: "QA ITM chips item", status: "FOR_SALE", purchase_price: 5 });
    await S.visit("/vault/for-sale"); await sleep(3000); await dismissBanner(S);
    const card = `[...document.querySelectorAll('article')].find(a => a.innerText.includes("QA ITM chips item"))`;
    const chips = await S.evaluate(`[...${card}.querySelectorAll('button, a')].map(b => (b.innerText||'').trim()).filter(Boolean)`);
    nt({ page: "/vault/for-sale | owner, Personal, desktop 1440, item with no price/grade/notes", control: "Readiness chips on a card", expected: "Observation", actual: chips.join(" | "), impact: "none", repro: "Read the chips" });
    const priceChip = chips.includes("Asking price");
    if (priceChip) {
      await mclick(S, `[...${card}.querySelectorAll('button')].find(b => /^Asking price$/.test(b.innerText.trim()))`); await sleep(500);
      const focused = await S.evaluate(`document.activeElement && document.activeElement.getAttribute('aria-label')`);
      await ck(focused === "Asking price", { page: "/vault/for-sale | owner, Personal, desktop 1440", control: "'Asking price' readiness chip", expected: "Puts the cursor in this card's Asking price box", actual: `focused element aria-label: ${focused}`, repro: "Click the Asking price chip" });
    }
    const gradeLink = chips.find((c) => /Condition \/ grade/.test(c));
    if (gradeLink) {
      await mclick(S, `[...${card}.querySelectorAll('a')].find(b => /Condition \\/ grade/.test(b.innerText))`); await sleep(2500);
      await ck((await S.path()).includes(id), { page: "/vault/for-sale | owner, Personal, desktop 1440", control: "'Condition / grade' readiness chip", expected: "Opens that item to add it", actual: `landed on ${await S.path()}`, repro: "Click the chip" });
    }
    // score maths of this item: title 20 + photo 20 (has default photo) = 40%
    await S.visit("/vault/for-sale"); await sleep(2500);
    const cardTxt = await S.evaluate(`${card}.innerText.replace(/\\s+/g,' ')`);
    await ck(/40%/.test(cardTxt), { page: "/vault/for-sale | owner, Personal, desktop 1440, title + photo only", control: "Readiness bar percentage", expected: "40% (title 20 + photo 20; no price, grade or notes)", actual: (cardTxt.match(/\d+%/) || ["none"])[0], repro: "Read the card's readiness percentage" });
  } catch (e) { console.error(e); await ck(false, { page: "suite", control: "charts runner", expected: "completes", actual: "script error: " + String(e.message).slice(0, 200), impact: "none" }); }
  finally { console.log(JSON.stringify(X.sumRows(out))); await S.close(); process.exit(0); }
})();
