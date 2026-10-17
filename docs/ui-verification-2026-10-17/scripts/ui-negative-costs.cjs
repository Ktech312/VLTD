// Negative purchase costs: refused with a clear message on the entry/edit screens; blank and explicit 0 preserved. Synthetic QA account only.
//   node ui-negative-costs.cjs [--base=http://localhost:3000]
const { session, qa, admin, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const MSG = "can't be negative";
const setVal = (S, sel, v) => S.evaluate("(() => { const i = document.querySelector(" + JSON.stringify(sel) + "); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, " + JSON.stringify(v) + "); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
const rows = async (t) => (await admin.from("vault_items").select("id,purchase_price,purchase_tax,purchase_shipping").eq("profile_id", qa.profileId).eq("title", t)).data || [];
const waitRow = async (t, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await rows(t); if (r.length) return r; await sleep(1500); } return []; };

(async () => {
  await admin.from("vault_items").delete().eq("profile_id", qa.profileId).like("title", "QA Neg %");
  const S = await session(BASE, { width: 1440, height: 900 });
  try {
    // ---- Add Item (capture) ----
    await S.go("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 120000); await sleep(1500);
    await setVal(S, "#capture-item-name", "QA Neg Capture");
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Pricing and market')); if (b) b.click(); return true; })()"); await sleep(500);
    await setVal(S, "#capture-purchase-price", "-5");
    await S.evaluate("(() => { [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Save to Vault')).click(); return true; })()"); await sleep(1500);
    let st = await S.evaluate("({ alert: document.querySelector('[role=alert]')?.textContent || '', path: location.pathname, invalid: document.getElementById('capture-purchase-price')?.getAttribute('aria-invalid') })");
    check("[Add Item] a cost of -5 is refused with the plain message and stays on the form", st.alert.includes(MSG) && st.path === "/capture" && st.invalid === "true", st);
    await sleep(4000);
    check("[Add Item] nothing was saved", (await rows("QA Neg Capture")).length === 0);
    await setVal(S, "#capture-purchase-price", "0");
    const cleared = await S.evaluate("!document.querySelector('[role=alert]')?.textContent.includes(\"can't be negative\")");
    check("[Add Item] fixing the value clears the message", cleared);
    await S.evaluate("(() => { [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Save to Vault')).click(); return true; })()");
    let r = await waitRow("QA Neg Capture");
    check("[Add Item] the same item then saves with an explicit 0 (not blank, not negative)", r.length === 1 && r[0].purchase_price === 0, r);

    // ---- manual Add page ----
    await S.go("/vault/add"); await S.waitFor("document.querySelector(\"input[placeholder*='Name this item']\")", 60000); await sleep(2500);
    const priceInput = "[...document.querySelectorAll('input')].filter((i) => i.placeholder === '25')[0]";
    const setManual = (sel, v) => S.evaluate("(() => { const i = " + sel + "; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, " + JSON.stringify(v) + "); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
    await setManual("document.querySelector(\"input[placeholder*='Name this item']\")", "QA Neg Manual");
    await setManual(priceInput, "-5"); await sleep(400);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save'); b.click(); return true; })()"); await sleep(2500);
    const body = await S.evaluate("document.body.innerText");
    check("[Add (manual)] a cost of -5 is refused with the message", body.includes(MSG), body.slice(0, 200));
    await sleep(3000);
    check("[Add (manual)] nothing was saved", (await rows("QA Neg Manual")).length === 0);
    await setManual(priceInput, ""); await sleep(300);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save'); b.click(); return true; })()");
    const rb = await waitRow("QA Neg Manual");
    check("[Add (manual)] the same item with the cost left blank saves as unknown (null), not 0", rb.length === 1 && rb[0].purchase_price === null, rb);

    // ---- item page, inline editing ----
    const target = "qa_ui_" + qa.stamp + "_8";
    await S.go("/vault/item/" + target); await S.waitFor("document.querySelector('[aria-label=\"Edit purchase\"]')", 120000, "purchase section"); await sleep(1500);
    const dbVal = async (col) => ((await admin.from("vault_items").select(col).eq("id", target).maybeSingle()).data || {})[col];
    // all-fields edit mode: pencil -> type -> check
    const editAll = async (values) => {
      await S.evaluate("document.querySelector('[aria-label=\"Edit purchase\"]').click(); true"); await sleep(500);
      for (const [label, v] of Object.entries(values)) {
        await S.evaluate("(() => { const i = document.querySelector(" + JSON.stringify('input[aria-label="' + label + '"]') + "); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, " + JSON.stringify(v) + "); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
      }
      await S.evaluate("document.querySelector('[aria-label=\"Save purchase\"]').click(); true"); await sleep(1800);
    };
    const alertText = () => S.evaluate("[...document.querySelectorAll('[role=alert]')].map((x) => x.textContent).join(' | ')");
    await editAll({ "Purchase price": "25" }); await sleep(2500);
    check("[item page] a positive cost still saves (25)", Number(await dbVal("purchase_price")) === 25, await dbVal("purchase_price"));
    await S.evaluate("(() => { const i = document.querySelector('input[aria-label=\"Purchase price\"]'); return !!i; })()");
    await editAll({ "Purchase price": "-3" });
    let a1 = await alertText(); const open = await S.evaluate("!!document.querySelector('input[aria-label=\"Purchase price\"]')");
    await sleep(3000);
    check("[item page] -3 is refused with the message and the editor stays open to fix it", a1.includes(MSG) && open, { a1, open });
    check("[item page] the saved cost is unchanged (still 25)", Number(await dbVal("purchase_price")) === 25, await dbVal("purchase_price"));
    await S.evaluate("(() => { const i = document.querySelector('input[aria-label=\"Purchase price\"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '0'); i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[aria-label=\"Save purchase\"]').click(); return true; })()"); await sleep(3500);
    check("[item page] correcting it to 0 saves an explicit 0", (await dbVal("purchase_price")) === 0, await dbVal("purchase_price"));
    await editAll({ "Shipping": "-2", "Tax": "-1" });
    a1 = await alertText(); await sleep(2500);
    check("[item page] negative shipping and tax are refused too, nothing saved", a1.includes(MSG) && (await dbVal("purchase_shipping")) !== -2 && (await dbVal("purchase_tax")) !== -1, { a1, ship: await dbVal("purchase_shipping") });
    await S.evaluate("(() => { const i = document.querySelector('input[aria-label=\"Shipping\"]'); if (i) i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true; })()"); await sleep(500);
    await editAll({ "Purchase price": "" }); await sleep(3000);
    const blank = await dbVal("purchase_price");
    check("[item page] clearing the cost makes it blank (unknown), which is different from 0", blank === null || blank === undefined, blank);
  } finally { await S.close(); await admin.from("vault_items").delete().eq("profile_id", qa.profileId).like("title", "QA Neg %"); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
