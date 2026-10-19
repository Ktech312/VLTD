// READ-ONLY: how valuation fields look in real data (counts only)
const { admin } = require("./journey-lib.cjs");
(async () => {
  const rows = [];
  for (let f = 0; ; f += 1000) { const r = await admin.from("vault_items").select("id,profile_id,status,current_value,estimated_value,value_median,last_comp_value,purchase_price,purchase_tax,purchase_shipping,purchase_fees").range(f, f + 999); if (r.error) { console.log(r.error.message); break; } rows.push(...r.data); if (r.data.length < 1000) break; }
  const profs = Object.fromEntries((await admin.from("profiles").select("id,account_code").in("id", [...new Set(rows.map((r) => r.profile_id))])).data.map((p) => [p.id, p.account_code]));
  const by = {};
  for (const r of rows) {
    const k = /260312|260310/.test(profs[r.profile_id] || "") ? profs[r.profile_id] : "other";
    const o = by[k] = by[k] || { n: 0, cvNull: 0, cvZero: 0, cvPos: 0, anyNullAll: 0, medianPos: 0, estPos: 0, costNull: 0, costZero: 0, costPos: 0 };
    o.n++;
    const cv = r.current_value; if (cv === null || cv === undefined) o.cvNull++; else if (Number(cv) === 0) o.cvZero++; else o.cvPos++;
    if (Number(r.value_median) > 0) o.medianPos++; if (Number(r.estimated_value) > 0) o.estPos++;
    const pp = r.purchase_price; if (pp === null || pp === undefined) o.costNull++; else if (Number(pp) === 0) o.costZero++; else o.costPos++;
    if ([r.current_value, r.estimated_value, r.value_median, r.last_comp_value].every((v) => v === null || v === undefined)) o.anyNullAll++;
  }
  console.log(JSON.stringify(by, null, 1));
})();
