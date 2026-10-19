// cost definition across insurance documents: item with tax/shipping/fees
const L = require("./audit-s-gin-lib.cjs"); const { R, admin, sleep, man, X } = L;
(async () => {
  const m = man(); const st = m.stamp; const id = `qa_vz_${st}_2`;
  const before = (await admin.from("vault_items").select("purchase_price,purchase_tax,purchase_shipping,purchase_fees").eq("id", id)).data[0];
  await admin.from("vault_items").update({ purchase_tax: 5, purchase_shipping: 3, purchase_fees: 2 }).eq("id", id);
  const S = await L.session("owner");
  try {
    const out = {};
    await S.visit("/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 60000); await sleep(1500);
    out.inventory = await S.evaluate(`(() => { const tr = [...document.querySelectorAll('table tbody tr')].find((t) => /QA Album 2 -/.test(t.textContent)); const tds = [...tr.querySelectorAll('td')].map((d) => d.innerText.trim()); return { cost: tds[7], value: tds[8] }; })()`);
    out.invTotals = (await L.mainText(S)).match(/Total Value \S+ • Total Cost \S+/)?.[0];
    await S.visit(`/insurance/item?id=${id}`); await S.waitFor("document.querySelector('main section h1')", 60000); await sleep(1500);
    out.sheet = L.squash(await S.evaluate("document.querySelector('main section').innerText")).match(/Purchase Cost: \S+ Current Value: \S+\*?/)?.[0];
    await S.visit("/reports/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 60000); await sleep(1500);
    out.report = await S.evaluate(`(() => { const hdr = [...document.querySelectorAll('table thead th')].map((t) => t.textContent.trim()); const tr = [...document.querySelectorAll('table tbody tr')].find((t) => /QA Album 2 -/.test(t.textContent)); const tds = [...tr.querySelectorAll('td')].map((d) => d.innerText.trim()); return { cost: tds[hdr.indexOf('Cost')], value: tds[hdr.indexOf('Value')] }; })()`);
    const pdfLike = await S.evaluate("1");
    const costs = [out.inventory.cost, out.report.cost, (out.sheet || "").match(/Purchase Cost: (\S+)/)?.[1]];
    R.check(new Set(costs).size === 1, { page: "/insurance, /insurance/item, /reports/insurance | item with price $20 + tax $5 + shipping $3 + fees $2", control: "'Cost' of one item across the insurance documents", expected: "The same cost everywhere (all-in $30, or $20 price everywhere, with the label saying which)", actual: `Inventory Cost ${costs[0]}, item sheet Purchase Cost ${costs[2]}, insurance report Cost ${costs[1]} (inventory/sheet/packet use the purchase price only; the report uses price + tax + shipping + fees). Header: ${out.invTotals}. Stand-in value of this unpriced item: inventory ${out.inventory.value}, report ${out.report.value}.`, evidence: "", impact: "misleading result", repro: "Give an item tax/shipping/fees and compare Cost on /insurance and /reports/insurance." });
  } finally { await S.close(); await admin.from("vault_items").update({ purchase_tax: before.purchase_tax, purchase_shipping: before.purchase_shipping, purchase_fees: before.purchase_fees }).eq("id", id); }
})();
