// Sold charts on the real page for each case (synthetic sold rows replaced per case; visual-fixture.cjs restores the full set afterwards).
//   node sold-cases.cjs --base=https://vltd.app
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const fs = require("fs");
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const OUT = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/visual-2026-10-18/after";
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const day = 86400e3;
const mk = (P, st, k, s) => ({ id: `qa_vz_${st}_c${k}`, profile_id: P, title: s.n, universe: "POP_CULTURE", category: "comics", category_label: "Comics", status: "SOLD", is_public: false, created_at: s.at - 30 * day, sold_price: s.price, sold_at: s.at, sold_platform: "eBay", ...(s.cost === null ? {} : { purchase_price: s.cost }) });
const d = (y, m, dd) => new Date(y, m, dd).getTime();
const CASES = [
  { name: "positive", rows: [{ n: "Case A1", at: d(2026, 6, 5), price: 300, cost: 100 }, { n: "Case A2", at: d(2026, 7, 9), price: 500, cost: 150 }, { n: "Case A3", at: d(2026, 8, 14), price: 220, cost: 80 }], expect: { bars: 2, labels: ["Jul", "Aug", "Sep", "$300", "$500", "$220", "$160", "$283", "$110"], loss: false } },
  { name: "negative", rows: [{ n: "Case B1", at: d(2026, 7, 5), price: 120, cost: 60 }, { n: "Case B2", at: d(2026, 8, 9), price: 40, cost: 130 }, { n: "Case B3", at: d(2026, 9, 3), price: 30, cost: 75 }], expect: { bars: 2, labels: ["Aug", "Sep", "Oct", "$44", "-$96", "-$49"], loss: true } },
  { name: "zero", rows: [{ n: "Case C1", at: d(2026, 8, 5), price: 0, cost: 0 }, { n: "Case C2", at: d(2026, 9, 9), price: 0, cost: 0 }], expect: { bars: 2, labels: ["Sep", "Oct", "$0"], loss: false } },
  { name: "one-month", rows: [{ n: "Case D1", at: d(2026, 9, 5), price: 215, cost: 95 }], expect: { bars: 2, labels: ["Oct", "$215", "$91", "One month of sales so far"], loss: false } },
  { name: "no-recorded-cost", rows: [{ n: "Case E1", at: d(2026, 8, 5), price: 90, cost: null }, { n: "Case E2", at: d(2026, 9, 9), price: 60, cost: 20 }], expect: { bars: 2, labels: ["Sep", "Oct", "$90", "$60", "$32", "no cost"], loss: false } },
  { name: "no-sales", rows: [], expect: { bars: 0, labels: [], loss: false } },
];
(async () => {
  const m = man(); const P = m.personalId; const st = m.stamp;
  try {
    for (const c of CASES) {
      await admin.from("vault_items").delete().eq("profile_id", P).eq("status", "SOLD");
      if (c.rows.length) { const r = await admin.from("vault_items").insert(c.rows.map((s, k) => mk(P, st, k, s))); if (r.error) throw new Error(r.error.message); }
      const S = await browser(BASE, { width: 1440, height: 900 });
      try {
        await S.go("/vault/sold"); await S.waitFor(c.rows.length ? "/Realized Profit/i.test(document.body.innerText)" : "document.querySelector('[data-vault-workspace=\"sold\"]') && document.body.innerText.length > 150", 180000, c.name); await sleep(3500);
        const info = await S.evaluate("({ bars: document.querySelectorAll('[data-testid=monthly-bars]').length, text: [...document.querySelectorAll('[data-testid=monthly-bars]')].map((e) => e.parentElement.innerText).join(' | '), grey: [...document.querySelectorAll('[data-testid=monthly-bars] div')].filter((e) => { const c = getComputedStyle(e).backgroundColor; return e.offsetHeight > 60 && /rgb\\((17[0-9]|18[0-9]), (17[0-9]|18[0-9]), /.test(c); }).length, sw: document.documentElement.scrollWidth, vw: innerWidth })");
        check(`[8 ${c.name}] ${c.expect.bars} chart(s) drawn`, info.bars === c.expect.bars, info);
        for (const l of c.expect.labels) check(`[8 ${c.name}] label '${l}' is shown`, info.text.includes(l), info.text.slice(0, 300));
        check(`[8 ${c.name}] no solid grey block, no sideways scroll`, info.grey === 0 && info.sw <= info.vw, info);
        const dims = await S.evaluate("(() => { let h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight); for (const e of document.querySelectorAll('*')) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) h = Math.max(h, e.scrollHeight + e.getBoundingClientRect().top); } return Math.ceil(h); })()");
        await S.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: Math.min(Math.max(dims, 900), 1500), deviceScaleFactor: 1, mobile: false }); await sleep(1200);
        const r = await S.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${OUT}/sold-case-${c.name}.png`, Buffer.from(r.data, "base64"));
      } finally { await S.close(); }
    }
  } catch (e) { console.log("STOPPED", e.message); fail++; }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
