// LIVE: valuation edge cases through the UI + clean second browser; Home / item / Vault / Insights agreement. Synthetic account only.
//   node val2.cjs [--base=https://vltd.app] [--dump]
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const DUMP = process.argv.includes("--dump");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 600)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 700));
const row = async (pid, title) => (await admin.from("vault_items").select("*").eq("profile_id", pid).eq("title", title)).data?.[0];
const waitRow = async (pid, title, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await row(pid, title); if (r) return r; await sleep(1500); } return null; };
const fieldSel = (label) => `(() => { const lab = [...document.querySelectorAll('label, span, div, p')].find((e) => e.children.length <= 2 && e.textContent.trim().replace(/\\s+/g, ' ').replace(/[^A-Za-z ()$]/g, '').trim() === ${JSON.stringify(label)}); if (!lab) return null; let el = lab; for (let i = 0; i < 4 && el; i++) { const inp = el.querySelector('input'); if (inp) return inp; el = el.parentElement; } return null; })()`;
const setField = (S, label, v) => S.evaluate(`(() => { const i = ${fieldSel(label)}; if (!i) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const manualAdd = async (S, pid, title, cost, value) => {
  await S.go("/vault/add"); await S.waitFor("document.querySelector(\"input[placeholder*='Name this item']\")", 90000, "Add page"); await sleep(2500);
  await S.setVal("input[placeholder*='Name this item']", title);
  if (cost !== "") await setField(S, "Purchase Price", cost);
  if (value !== "") await setField(S, "Current Value", value);
  await sleep(500);
  await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save'); b.click(); return true; })()");
  return waitRow(pid, title);
};
// edit the value on the item page through the Pricing card (click the VALUE RANGE tile, type, click away)
const editValue = async (S, id, v) => {
  await S.go("/vault/item/" + id); await S.waitFor("document.querySelector('[aria-label=\"Edit pricing\"]')", 120000, "pricing card"); await sleep(2000);
  await S.clickSel('[aria-label="Edit pricing"]'); await sleep(700);
  const ok = await S.setVal('input[aria-label="Value"]', v); await sleep(300);
  await S.clickSel('[aria-label="Save pricing"]'); await sleep(3500);
  return ok;
};
const editPurchase = async (S, id, cost) => {
  await S.go("/vault/item/" + id); await S.waitFor("document.querySelector('[aria-label=\"Edit purchase\"]')", 120000, "item page"); await sleep(1500);
  await S.clickSel('[aria-label="Edit purchase"]'); await sleep(500);
  await S.setVal('input[aria-label="Purchase price"]', cost); await S.clickSel('[aria-label="Save purchase"]'); await sleep(3500);
};
const grab = async (B, path, ready) => { await B.go(path); await B.waitFor(ready, 120000, path); await sleep(4500); return (await B.text()).replace(/\n+/g, " | "); };

(async () => {
  const m = man(); const P = m.personalId;
  const S = await browser(BASE, { width: 1440, height: 900 });
  try {
    info("deployed commit", ((await (await fetch(BASE + "/")).text()).match(/name="vltd-commit" content="([^"]+)"/) || [])[1]);
    const E1 = await manualAdd(S, P, "QA Edge Blank", "", "");
    check("[ui] blank cost + blank value: both unknown (null), not 0", E1 && E1.purchase_price === null && E1.current_value === null, E1 && [E1.purchase_price, E1.current_value]);
    const E2 = await manualAdd(S, P, "QA Edge ZeroCostValue50", "0", "50");
    check("[ui] explicit zero cost with a positive valuation: cost 0 (kept), value 50", E2 && Number(E2.purchase_price) === 0 && E2.purchase_price !== null && Number(E2.current_value) === 50, E2 && [E2.purchase_price, E2.current_value]);
    const E3 = await manualAdd(S, P, "QA Edge Cost50ValueZero", "50", "0");
    check("[ui] positive cost with an explicit zero valuation: cost 50, value 0 (kept as 0, not blank)", E3 && Number(E3.purchase_price) === 50 && E3.current_value !== null && Number(E3.current_value) === 0, E3 && [E3.purchase_price, E3.current_value]);
    const E4 = await manualAdd(S, P, "QA Edge EditClear", "40", "60");
    check("[ui] cost 40 with valuation 60 saved", E4 && Number(E4.purchase_price) === 40 && Number(E4.current_value) === 60);
    // edit the valuation 60 -> 70
    await editValue(S, E4.id, "70");
    let r = await row(P, "QA Edge EditClear");
    check("[ui] editing the valuation to 70 saves it", Number(r.current_value) === 70, { current_value: r.current_value, value_median: r.value_median, estimated_value: r.estimated_value });
    // clear the valuation
    await editValue(S, E4.id, "");
    r = await row(P, "QA Edge EditClear");
    info("after clearing the valuation", { current_value: r.current_value, value_median: r.value_median, estimated_value: r.estimated_value, last_comp_value: r.last_comp_value });
    check("[ui] clearing the valuation leaves the item UNVALUED (no value kept from before)", r.current_value === null && r.value_median === null && r.estimated_value === null, { current_value: r.current_value, value_median: r.value_median, estimated_value: r.estimated_value });
    // change the cost without touching the valuation
    const E5 = await manualAdd(S, P, "QA Edge CostChange", "30", "45");
    await editPurchase(S, E5.id, "35");
    r = await row(P, "QA Edge CostChange");
    check("[ui] changing the cost 30 -> 35 leaves the valuation (45) untouched", Number(r.purchase_price) === 35 && Number(r.current_value) === 45, [r.purchase_price, r.current_value]);

    // ---- a CLEAN second browser: the same figures everywhere ----
    const B = await browser(BASE);
    try {
      const home = await grab(B, "/dashboard", "/COLLECTION OVERVIEW/.test(document.body.innerText) && /QA Edge/.test(document.body.innerText)");
      const vault = await grab(B, "/vault", "/TOTAL VALUE/.test(document.body.innerText) && /QA Edge/.test(document.body.innerText)");
      const insights = await grab(B, "/portfolio", "document.body.innerText.length > 600");
      if (DUMP) { console.log("HOME>>", (home.match(/COLLECTION OVERVIEW[\s\S]{0,520}/) || [""])[0]); console.log("VAULT>>", (vault.match(/TOTAL VALUE[\s\S]{0,260}/) || [""])[0]); console.log("INSIGHTS>>", insights.slice(0, 1800)); }
      // expected from the database
      const items = (await admin.from("vault_items").select("title,purchase_price,current_value,value_median,estimated_value").eq("profile_id", P).like("title", "QA Edge %")).data;
      info("database rows", items.map((x) => [x.title.replace("QA Edge ", ""), x.purchase_price, x.current_value, x.value_median]));
    } finally { await B.close(); }
  } catch (e) { console.log("STOPPED", e.message); try { await S.c.captureDiag(String(e.message), "val2-diag"); } catch { /* ignore */ } fail++; }
  finally { await S.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
