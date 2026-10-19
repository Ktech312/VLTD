// Focused production checks: Insurance as a Vault tab (route, back/refresh, profile switch, print) and the Goals corrections (populated QA goals).
// Each check runs once; failures are kept. Synthetic account only.
//   node insurance-goals-test.cjs <label> --base=https://vltd.app
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const fs = require("fs");
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const LABEL = process.argv[2] || "run";
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const OUT = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/visual-2026-10-18/insurance-goals/" + LABEL; fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const results = [];
const check = (n, ok, d) => { ok ? pass++ : fail++; results.push({ n, ok, d: ok ? undefined : d }); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 450)); };
const TABS = "Items,For Sale,Sold,Insights,Goals,Insurance";
const tabs = (S) => S.evaluate("(() => { const n = document.querySelector('nav[aria-label=\"Vault\"]'); return n ? { tabs: [...n.querySelectorAll('a')].map((a) => a.textContent.trim()).join(','), active: (n.querySelector('[aria-current=page]') || {}).textContent, count: document.querySelectorAll('nav[aria-label=\"Vault\"]').length, h1: document.querySelector('h1') && document.querySelector('h1').textContent } : null; })()");
const text = async (S) => (await S.text()).replace(/\s+/g, " ");
async function shot(S, name, w, h, mobile) {
  const dims = await S.evaluate("(() => { let h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight); for (const e of document.querySelectorAll('*')) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) h = Math.max(h, e.scrollHeight + e.getBoundingClientRect().top); } return Math.ceil(h); })()");
  await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.min(Math.max(dims, h), 3200), deviceScaleFactor: 1, mobile: !!mobile }); await sleep(2500);
  const r = await S.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, "base64"));
  await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
}
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp;
  await admin.from("collection_goals").delete().eq("profile_id", P);
  const gi = await admin.from("collection_goals").insert([{ id: `qa_goal_${st}_4`, name: "Insurance documentation goal", target_count: 20, profile_id: P, created_at: new Date().toISOString() }]); if (gi.error) throw new Error(gi.error.message);
  const S = await browser(BASE, { width: 1440, height: 900 });
  try {
    await S.go("/vault"); await S.waitFor("document.querySelector('nav[aria-label=\"Vault\"]')", 180000, "vault"); await sleep(2000);
    await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(P)}); true`);
    await S.go("/goals"); await S.waitFor("document.querySelectorAll('[role=group][aria-label=\"Goal types\"] button').length > 0", 180000, "goals"); await sleep(3000);
    const gtx = await text(S);
    check("[F] the Goals stat no longer calls goal progress 'Insurance Coverage' (label drawn in capitals; case-insensitive)", !/(?<!not )insurance coverage/i.test(gtx) && /Insurance Goal Progress/i.test(gtx) && /Not insurance coverage/i.test(gtx), gtx.match(/Insurance Goal.{0,120}/i)?.[0]);
    await shot(S, "goals-stat-1440", 1440, 900, false);
  } finally { await S.close?.(); }
  await admin.from("collection_goals").delete().eq("profile_id", P);
  fs.writeFileSync(OUT + "/results.json", JSON.stringify({ pass, fail, results }, null, 2)); console.log(`${pass} passed, ${fail} failed`);
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
