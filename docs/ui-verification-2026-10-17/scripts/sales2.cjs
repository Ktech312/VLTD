// LIVE: mark for sale -> record sold (through the existing UI) -> revenue / profit / owned figures / Sales analytics, from a clean second browser.
// Synthetic account only (journey-setup.cjs first, journey-cleanup.cjs after).   node sales2.cjs [--base=https://vltd.app] [--dump]
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const DUMP = process.argv.includes("--dump");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 600)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 800));
const row = async (pid, title) => (await admin.from("vault_items").select("*").eq("profile_id", pid).eq("title", title)).data?.[0];
const waitRow = async (pid, title, pred = () => true, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await row(pid, title); if (r && pred(r)) return r; await sleep(1500); } return row(pid, title); };
const fieldSel = (label) => `(() => { const lab = [...document.querySelectorAll('label, span, div, p')].find((e) => e.children.length <= 2 && e.textContent.trim().replace(/\\s+/g, ' ').replace(/[^A-Za-z ()$]/g, '').trim() === ${JSON.stringify(label)}); if (!lab) return null; let el = lab; for (let i = 0; i < 4 && el; i++) { const inp = el.querySelector('input'); if (inp) return inp; el = el.parentElement; } return null; })()`;
const setField = (S, label, v) => S.evaluate(`(() => { const i = ${fieldSel(label)}; if (!i) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const manualAdd = async (S, pid, title, cost, value) => {
  await S.go("/vault/add"); await S.waitFor("document.querySelector(\"input[placeholder*='Name this item']\")", 90000, "Add page"); await sleep(2500);
  await S.setVal("input[placeholder*='Name this item']", title);
  if (cost !== "") await setField(S, "Purchase Price", cost);
  if (value) await setField(S, "Current Value", value);
  await sleep(500);
  await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save'); b.click(); return true; })()");
  return waitRow(pid, title);
};
const dialogs = []; // answers for window.prompt / confirm, in order; anything else is accepted
const watchDialogs = (S) => S.c.on(async (m) => { if (m.method === "Page.javascriptDialogOpening") { const a = dialogs.shift(); try { await S.send("Page.handleJavaScriptDialog", { accept: a !== null, promptText: a == null ? "" : String(a) }); } catch { /* closed */ } dialogs.log = (dialogs.log || []).concat([m.params.type + ": " + String(m.params.message).slice(0, 50)]); } });
const money = (s) => Number(String(s).replace(/[^0-9.\-]/g, ""));

(async () => {
  const m = man(); const P = m.personalId;
  await admin.from("vault_items").delete().eq("profile_id", P).like("title", "QA %");
  const S = await browser(BASE, { width: 1440, height: 900 });
  watchDialogs(S);
  const plan = [
    { t: "QA Sale Full", cost: "100", extras: { Tax: "5", Shipping: "10", Fees: "5" }, sold: "200", plat: "In person", profit: 80, revenue: 200, cost_all: 120 },
    { t: "QA Sale UnknownCost", cost: "", sold: "75", plat: "In person", profit: null, revenue: 75 },
    { t: "QA Sale ZeroCost", cost: "0", sold: "40", plat: "In person", profit: 40, revenue: 40, cost_all: 0 },
    { t: "QA Sale Loss", cost: "80", sold: "50", plat: "In person", profit: -30, revenue: 50, cost_all: 80 },
    { t: "QA Sale Ebay", cost: "100", sold: "150", plat: "eBay", profit: "ebay", revenue: 150, cost_all: 100 },
  ];
  try {
    info("deployed commit", ((await (await fetch(BASE + "/")).text()).match(/name="vltd-commit" content="([^"]+)"/) || [])[1]);
    const control = await manualAdd(S, P, "QA Owned Control", "60", "90");
    check("[setup] an owned control item (cost 60, value 90) exists", control && Number(control.purchase_price) === 60 && Number(control.current_value) === 90);
    for (const p of plan) {
      const it = await manualAdd(S, P, p.t, p.cost, "");
      p.id = it.id;
      if (p.extras) {
        await S.go("/vault/item/" + it.id); await S.waitFor("document.querySelector('[aria-label=\"Edit purchase\"]')", 120000); await sleep(1500);
        await S.clickSel('[aria-label="Edit purchase"]'); await sleep(500);
        for (const [k, v] of Object.entries(p.extras)) await S.setVal(`input[aria-label="${k}"]`, v);
        await S.clickSel('[aria-label="Save purchase"]'); await sleep(3500);
      }
      // mark for sale on the item page
      await S.go("/vault/item/" + it.id); await S.waitFor("document.querySelector('button[aria-label=\"Mark for sale\"], [aria-label=\"Mark for sale\"]')", 120000, "Mark for sale toggle"); await sleep(1500);
      await S.clickSel('[aria-label="Mark for sale"]');
      const fs1 = await waitRow(P, p.t, (r) => r.status === "FOR_SALE");
      check(`[for sale] "${p.t}" is marked for sale through the item page`, fs1.status === "FOR_SALE", fs1.status);
    }
    // record each sale through the For Sale page's own "Mark sold" button (two prompts: price, then where it sold)
    for (const p of plan) {
      await S.go("/vault/for-sale"); await S.waitFor(`document.body.innerText.includes(${JSON.stringify(p.t)})`, 120000, "For Sale list"); await sleep(2500);
      dialogs.push(p.sold, p.plat);
      const clicked = await S.evaluate(`(() => { const titles = ${JSON.stringify(plan.map((x) => x.t))}; const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Mark sold'); for (const b of btns) { let el = b; for (let i = 0; i < 8 && el.parentElement; i++) { el = el.parentElement; const hit = titles.filter((t) => el.textContent.includes(t)); if (hit.length === 1) { if (hit[0] === ${JSON.stringify(p.t)}) { b.click(); return true; } break; } if (hit.length > 1) break; } } return false; })()`);
      const sold = await waitRow(P, p.t, (r) => r.status === "SOLD");
      check(`[sold] "${p.t}" recorded sold for ${p.sold} (${p.plat}) through the existing UI`, clicked && sold.status === "SOLD" && Number(sold.sold_price) === Number(p.sold) && /^(in person|ebay)$/i.test(String(sold.sold_platform || "")), { clicked, status: sold.status, price: sold.sold_price, plat: sold.sold_platform, dialogs: dialogs.log });
      check(`[sold] "${p.t}": the purchase cost is untouched by the sale (${p.cost === "" ? "blank" : p.cost})`, p.cost === "" ? sold.purchase_price === null : Number(sold.purchase_price) === Number(p.cost), sold.purchase_price);
    }
    await sleep(3000);
    // ---------------- a CLEAN second browser ----------------
    const B = await browser(BASE);
    try {
      const grab = async (path, ready) => { await B.go(path); await B.waitFor(ready, 120000, path); await sleep(5000); return (await B.text()).replace(/\n+/g, " | "); };
      const soldPage = await grab("/vault/sold", "/QA Sale Full/.test(document.body.innerText) && /Realized Profit/i.test(document.body.innerText)");
      if (DUMP) console.log("SOLD>>", soldPage.slice(0, 2600));
      for (const p of plan) {
        const seg = (soldPage.match(new RegExp(p.t.replace(/ /g, "\\s") + "[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*")) || [""])[0];
        info("sold row: " + p.t, seg);
      }
      const rev = soldPage.match(/Realized Revenue[^$]*\$([\d,]+(?:\.\d+)?)/i), prof = soldPage.match(/Realized Profit[^$+\-]*([+\-]?)\$([\d,]+(?:\.\d+)?)/i);
      info("sold page headline", { rev: rev && rev[1], prof: prof && prof[1] + prof[2] });
      const home = await grab("/dashboard", "/COLLECTION OVERVIEW/.test(document.body.innerText) && /SALES REVENUE/.test(document.body.innerText)");
      if (DUMP) console.log("HOME>>", (home.match(/COLLECTION OVERVIEW[\s\S]{0,900}/) || [""])[0]);
      const vault = await grab("/vault", "/TOTAL VALUE/.test(document.body.innerText)");
      if (DUMP) console.log("VAULT>>", (vault.match(/TOTAL VALUE[\s\S]{0,300}/) || [""])[0]);
      const insights = await grab("/portfolio", "document.body.innerText.length > 600");
      const sales = await grab("/sales", "document.body.innerText.length > 300");
      if (DUMP) { console.log("INSIGHTS>>", insights.slice(0, 900)); console.log("SALES>>", sales.slice(0, 1500)); }
      const dbSold = (await admin.from("vault_items").select("title,purchase_price,purchase_tax,purchase_shipping,purchase_fees,sold_price,sold_platform,status").eq("profile_id", P).eq("status", "SOLD")).data;
      info("database sold rows", dbSold.map((x) => [x.title.replace("QA Sale ", ""), x.purchase_price, x.sold_price, x.sold_platform]));
    } finally { await B.close(); }
  } catch (e) { console.log("STOPPED", e.message); try { await S.shot("sales2-stop.png"); await S.c.captureDiag(String(e.message), "sales2-diag"); } catch { /* ignore */ } fail++; }
  finally { await S.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
