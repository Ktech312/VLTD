// Incident 2 (intermittent blank Vault): ONE idle cold load, with diagnostics. No repeat campaign.
//   node blank-vault-idle.cjs [--idle=120] [--base=http://localhost:3000]
// Signs in a fresh isolated browser as the synthetic QA account, leaves it idle, then loads /vault cold and records every 500 ms
// what the screen is: blank / loading skeleton / signed-out / genuinely empty / failed load / loaded.
const fs = require("fs");
const path = require("path");
const { session, sleep } = require("./ui-lib.cjs");
const arg = (n, d) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "--" + n + "=" + d).split("=")[1];
const BASE = arg("base", "http://localhost:3000");
const IDLE = Number(arg("idle", 120));
const classify = `(() => {
  const t = document.body ? document.body.innerText.trim() : '';
  const links = document.querySelectorAll('main a[href^="/vault/item/"], a[href^="/vault/item/"]').length;
  const path = location.pathname;
  if (/^\\/login/.test(path)) return 'signed-out (login page)';
  if (links > 0) return 'loaded (' + links + ' item links)';
  if (/No items|nothing here|Your vault is empty|Add your first/i.test(t)) return 'genuinely empty';
  if (/could not load|couldn.t load|try again|failed/i.test(t)) return 'failed load (message shown)';
  if (document.querySelector('[aria-busy="true"], .animate-pulse, [class*=skeleton]')) return 'loading skeleton';
  if (t.length < 60) return 'BLANK (almost no text)';
  return 'other (' + t.length + ' chars, no items yet)';
})()`;
(async () => {
  const S = await session(BASE, { width: 1440, height: 900 });
  try {
    console.log("signed in; idle for " + IDLE + " s ...");
    await sleep(IDLE * 1000);
    const t0 = Date.now(); const timeline = []; let last = "";
    await S.go("/vault");
    let done = false;
    while (Date.now() - t0 < 60000 && !done) {
      await sleep(500);
      let c; try { c = await S.evaluate(classify); } catch (e) { c = "page busy"; }
      if (c !== last) { timeline.push({ ms: Date.now() - t0, state: c }); last = c; }
      if (/^loaded|genuinely empty|failed|signed-out/.test(c)) done = true;
    }
    const diag = await S.c.captureDiag("idle cold load", "blank-idle");
    console.log("timeline:", JSON.stringify(timeline));
    console.log("final:", last, "| supabase requests:", (diag.supabaseRequests || []).length, "| failures:", JSON.stringify(diag.failures), "| console errors:", JSON.stringify(diag.errors));
    console.log("page state:", JSON.stringify(diag.state));
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
