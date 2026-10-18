// Responsiveness of the Vault with 1,500 synthetic items on PRODUCTION: normal speed (no throttling) measured SEPARATELY from 4x CPU slowdown.
// Per visit: time to first card, every long task (over 50 ms), then two interactions: 8 scroll steps (worst frame gap) and one typed search (time to the next painted frame).
//   node resp.cjs --base=https://vltd.app [--normal=5] [--slow=3]       (needs qa_perf.json for a synthetic account; items are removed at the end)
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const fs = require("fs");
const { launch } = require("./cdp.cjs");
const env = require("../qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const arg = (n, d) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "--" + n + "=" + d).split("=")[1];
const BASE = arg("base", "https://vltd.app"); const NORMAL = Number(arg("normal", 5)), SLOW = Number(arg("slow", 3)); const N = Number(arg("n", 1500));
const qa = JSON.parse(fs.readFileSync(__dirname + "/qa_perf.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
(async () => {
  await admin.from("vault_items").delete().eq("profile_id", qa.profileId);
  const rows = Array.from({ length: N }, (_, i) => ({ id: `qa_rs_${stamp}_${i}`, profile_id: qa.profileId, title: `QA Item ${i} with a longer realistic title`, subtitle: `Set ${i % 40} #${i}`, universe: ["MISC", "SPORTS", "TCG", "POP_CULTURE", "GAMES"][i % 5], category: "COLLECTORS_CHOICE", category_label: "Collectors Choice", status: "COLLECTION", is_public: false, created_at: Date.now() - i * 60000, purchase_price: 5 + (i % 90), current_value: 8 + (i % 120) }));
  for (let i = 0; i < rows.length; i += 400) { const r = await admin.from("vault_items").insert(rows.slice(i, i + 400)); if (r.error) throw new Error(r.error.message); }
  const results = { normal: [], slow: [] };
  const runBrowser = async (cpu, visits, tag) => {
    const c = await launch();
    try {
      const { send, evaluate } = c;
      await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
      await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
      const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { data } = await sb.auth.signInWithPassword({ email: qa.email, password: qa.password });
      await send("Page.navigate", { url: BASE + "/robots.txt" }); await sleep(900);
      await evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(data.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(qa.profileId)}); localStorage.setItem('vltd_vault_view_mode', 'gallery'); localStorage.setItem('vltd-theme', 'deep-vault'); true`);
      await send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__lt=[]; try{ new PerformanceObserver((l)=>{for(const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]);}).observe({type:'longtask',buffered:true}); }catch(e){}" });
      await send("Emulation.setCPUThrottlingRate", { rate: cpu });
      for (let v = 1; v <= visits; v++) {
        const t0 = Date.now();
        await send("Page.navigate", { url: BASE + "/vault" });
        let readyMs = null, cards = 0;
        for (let i = 0; i < 400 && readyMs === null; i++) { await sleep(100); try { cards = await evaluate("document.querySelectorAll('a[href^=\"/vault/item/\"]').length"); if (cards > 0) readyMs = Date.now() - t0; } catch { /* navigating */ } }
        await sleep(3000);
        const lt = (await evaluate("window.__lt.slice()")).map((x) => x[1]);
        const scroll = await evaluate(`(async () => { const gaps = []; let last = performance.now(); let stop = false; const tick = () => { const n = performance.now(); gaps.push(n - last); last = n; if (!stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); const sc = document.scrollingElement || document.documentElement; for (let k = 0; k < 8; k++) { sc.scrollTop += 900; await new Promise((r) => setTimeout(r, 180)); } stop = true; await new Promise((r) => setTimeout(r, 100)); return { frames: gaps.length, worst: Math.round(Math.max(...gaps)), over100: gaps.filter((g) => g > 100).length }; })()`);
        await evaluate("(document.scrollingElement || document.documentElement).scrollTop = 0; true"); await sleep(400);
        const typed = await evaluate(`(async () => { const i = [...document.querySelectorAll('input')].find((x) => /search/i.test((x.placeholder || '') + (x.getAttribute('aria-label') || ''))); if (!i) return null; i.focus(); const t = performance.now(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'item 12'); i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return Math.round(performance.now() - t); })()`);
        const rec = { visit: v, cards, readyMs, longTasks: lt, longest: Math.max(0, ...lt), scroll, searchToNextFrameMs: typed };
        results[tag].push(rec);
        console.log(`[${tag} cpu x${cpu}] visit ${v}: first card ${readyMs} ms (${cards} cards drawn), long tasks [${lt.join(", ")}], worst scroll frame ${scroll.worst} ms (${scroll.over100} over 100 ms), search to next frame ${typed} ms`);
      }
    } finally { await c.close(); }
  };
  try {
    await runBrowser(1, NORMAL, "normal");
    await runBrowser(4, SLOW, "slow");
  } finally { await admin.from("vault_items").delete().eq("profile_id", qa.profileId); }
  const sum = (arr, f) => arr.map(f).filter((x) => x !== null && x !== undefined);
  console.log("\nSUMMARY normal speed: first card median", med(sum(results.normal, (r) => r.readyMs)), "ms; longest task per visit", sum(results.normal, (r) => r.longest).join(", "), "ms; worst scroll frame", sum(results.normal, (r) => r.scroll.worst).join(", "), "ms; search to frame", sum(results.normal, (r) => r.searchToNextFrameMs).join(", "), "ms");
  console.log("SUMMARY 4x slowdown : first card median", med(sum(results.slow, (r) => r.readyMs)), "ms; longest task per visit", sum(results.slow, (r) => r.longest).join(", "), "ms; worst scroll frame", sum(results.slow, (r) => r.scroll.worst).join(", "), "ms; search to frame", sum(results.slow, (r) => r.searchToNextFrameMs).join(", "), "ms");
  fs.writeFileSync(__dirname + "/resp-results.json", JSON.stringify(results, null, 1));
  process.exit(0);
})().catch((e) => { console.error("HARNESS ERROR", e.message || e); process.exit(2); });
