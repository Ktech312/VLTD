// Controlled cloud failures on four pages, in isolated browsers (synthetic account). Each scenario is run ONCE and every reading is kept:
// nothing is retried to turn a failure into a pass. Output is also written to the evidence folder.
//   node pass3-paths.cjs <label> --base=https://vltd.app [--only=vault,sold]
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const fs = require("fs");
const { browser, sleep } = require("./journey-lib.cjs");
const LABEL = process.argv[2] || "run";
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const ONLY = ((process.argv.find((a) => a.startsWith("--only=")) || "--only=").slice(7)).split(",").filter(Boolean);
const OUT = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/investigations/evidence-2026-10-18-pass3"; fs.mkdirSync(OUT, { recursive: true });
const STALE = "Showing saved data\u2014couldn\u2019t refresh.";
const PAGES = {
  vault: { path: "/vault", items: "document.querySelectorAll('a[href^=\"/vault/item/\"]').length", warm: true },
  sold: { path: "/vault/sold", items: "document.querySelectorAll('article').length" },
  forsale: { path: "/vault/for-sale", items: "document.querySelectorAll('[data-for-sale] article').length" },
  home: { path: "/dashboard", items: "document.querySelectorAll('[data-recent-item]').length" },
};
const results = []; let pass = 0, fail = 0;
const rec = (page, name, ok, detail) => { ok ? pass++ : fail++; results.push({ page, name, ok, detail }); console.log(ok ? "PASS" : "FAIL", `[${page}] ${name}`, ok ? "" : JSON.stringify(detail ?? "").slice(0, 400)); };
async function intercept(S) {
  const st = { fail: false, gets: [], t0: 0 };
  await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/vault_items*", requestStage: "Request" }] });
  S.c.on(async (e) => { if (e.method !== "Fetch.requestPaused") return; const r = e.params.request;
    try { if (st.fail && r.method === "GET") { st.gets.push(Math.round((Date.now() - st.t0) / 100) / 10); await S.send("Fetch.failRequest", { requestId: e.params.requestId, errorReason: "Failed" }); } else await S.send("Fetch.continueRequest", { requestId: e.params.requestId }); } catch { /* gone */ } });
  return st;
}
const read = (S, cfg) => S.evaluate(`(() => { const t = document.body.innerText.replace(/\\s+/g, ' '); return { items: ${cfg.items}, stale: t.includes(${JSON.stringify(STALE)}), loading: /Loading (sold items|your items|Home|your Vault)|Still loading/i.test(t), zeroFigures: /SOLD 0 REVENUE \\$0/i.test(t) || /\\$0 asking total/i.test(t), errorMsg: /could not load|couldn.t load|COULD NOT LOAD/i.test(t), emptyClaim: /No sold items yet|No items marked for sale|Your vault is empty|vault is ready/i.test(t), retry: [...document.querySelectorAll('button,a')].some((b) => /^(Retry|Try again)$/i.test(b.textContent.trim())), head: t.slice(0, 160) }; })()`);
const clickRetry = (S) => S.evaluate("(() => { const b = [...document.querySelectorAll('button,a')].find((x) => /^(Retry|Try again)$/i.test(x.textContent.trim())); if (!b) return false; b.click(); return true; })()");

(async () => {
  for (const [key, cfg] of Object.entries(PAGES)) {
    if (ONLY.length && !ONLY.includes(key)) continue;
    // ---- with a saved copy: cloud fails on a reload
    let S = await browser(BASE, { width: 1440, height: 900 });
    try {
      await S.go("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 240000, "warm"); await sleep(3500);
      const st = await intercept(S); st.fail = true; st.t0 = Date.now();
      await S.go(cfg.path);
      const shots = {}; for (const sec of [10, 25, 45]) { await sleep(Math.max(0, sec * 1000 - (Date.now() - st.t0))); shots[sec] = await read(S, cfg); }
      const last = shots[45];
      rec(key, "WITH SAVED COPY, cloud failing: saved data stays available", last.items > 0, shots);
      rec(key, "…and says \u201CShowing saved data\u2014couldn\u2019t refresh.\u201D", last.stale, { s10: shots[10].head, s45: last.head });
      rec(key, "…with a Retry action", last.stale && last.retry, last);
      rec(key, "…never presents the failure as an empty collection or as $0 figures", !last.emptyClaim && !last.zeroFigures, last);
      const n45 = st.gets.filter((t) => t <= 45).length;
      rec(key, "…request count while failing stays bounded (<= 30 failed requests in 45 s)", n45 <= 30, { failedRequests: n45, at: st.gets.slice(0, 40) });
      // unblock, Retry
      st.fail = false; const clicked = await clickRetry(S); await sleep(12000); const after = await read(S, cfg);
      rec(key, "…Retry works once the cloud is back (message gone, data still there)", clicked && !after.stale && after.items > 0, { clicked, after });
    } catch (e) { rec(key, "with-copy scenario ran", false, e.message); } finally { try { await S.close(); } catch { /* */ } }
    // ---- no saved copy (clean second browser): cloud fails
    S = await browser(BASE, { width: 1440, height: 900 });
    try {
      const st = await intercept(S); st.fail = true; st.t0 = Date.now();
      await S.go(cfg.path);
      const shots = {}; for (const sec of [10, 25, 45]) { await sleep(Math.max(0, sec * 1000 - (Date.now() - st.t0))); shots[sec] = await read(S, cfg); }
      const last = shots[45];
      rec(key, "NO SAVED COPY (clean browser), cloud failing: a clear load error with Retry, not endless 'Loading…'", last.errorMsg && last.retry && !last.loading, shots);
      rec(key, "…no $0 figures and no empty-collection claim", !last.zeroFigures && !last.emptyClaim, last);
      st.fail = false; const clicked = await clickRetry(S); await sleep(15000); const after = await read(S, cfg);
      rec(key, "…Retry brings the data once the cloud answers", clicked && after.items > 0, { clicked, after });
    } catch (e) { rec(key, "no-copy scenario ran", false, e.message); } finally { try { await S.close(); } catch { /* */ } }
  }
  fs.writeFileSync(`${OUT}/paths-${LABEL}.json`, JSON.stringify({ label: LABEL, base: BASE, at: new Date().toISOString(), pass, fail, results }, null, 1));
  console.log(`\n${pass} passed, ${fail} failed -> ${OUT}/paths-${LABEL}.json`); process.exit(fail ? 1 : 0);
})();
