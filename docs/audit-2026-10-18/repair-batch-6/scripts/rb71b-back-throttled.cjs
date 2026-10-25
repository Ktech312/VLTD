// Home -> Insights -> Back on a SLOW device and network (RB71b): CPU 6x slower and a slow connection, clicking Insights at several moments during and after Home's load.
// Same history instrumentation as RB71. If slow loading could lose the Insights history entry, it would show here.
//   AUDIT_MANIFEST=<manifest> node rb71b-back-throttled.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, runs: [], summary: {} };
const PATCH = `(() => { if (window.__hlog) return true; window.__hlog = []; for (const k of ['pushState', 'replaceState']) { const o = history[k]; history[k] = function (st, t, u) { window.__hlog.push({ k, u: String(u), from: location.pathname }); return o.apply(this, arguments); }; } return true; })()`;
const clickNav = (label) => `(() => { const nav = document.querySelector('nav[aria-label="Primary"]'); const el = [...(nav || document).querySelectorAll('a,button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(label)}); if (!el) return false; el.click(); return true; })()`;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await S.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 });
    for (const delay of [0, 500, 1500, 4000, 9000]) {
      for (let rep = 0; rep < 3; rep++) {
        await S.go("/dashboard"); await sleep(delay);
        let clicked = false;
        for (let i = 0; i < 40 && !clicked; i++) { try { await S.evaluate(PATCH); clicked = await S.evaluate(clickNav("Insights")); } catch { /* still loading */ } if (!clicked) await sleep(500); }
        const t0 = Date.now(); let seen = "";
        while (Date.now() - t0 < 25000) { try { seen = await S.evaluate("location.pathname"); } catch { seen = ""; } if (seen === "/portfolio") break; await sleep(400); }
        await sleep(5000);
        const stayed = await S.evaluate("location.pathname").catch(() => "");
        const hlog = await S.evaluate("window.__hlog || null").catch(() => null);
        await S.evaluate("history.back(); true").catch(() => {}); await sleep(6000);
        const afterBack = await S.evaluate("location.pathname").catch(() => "");
        out.runs.push({ delay, rep, clicked, reached: seen, stayedAfter5s: stayed, hlog, afterBack });
      }
    }
    out.summary = { runs: out.runs.length, reachedInsights: out.runs.filter((r) => r.reached === "/portfolio").length, stayedOnInsights: out.runs.filter((r) => r.stayedAfter5s === "/portfolio").length, backToHome: out.runs.filter((r) => r.afterBack === "/dashboard").length, replaceCalls: out.runs.reduce((n, r) => n + (r.hlog || []).filter((h) => h.k === "replaceState").length, 0) };
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 600); console.error(e); }
  finally { try { await S.send("Emulation.setCPUThrottlingRate", { rate: 1 }); await S.close(); } catch {} fs.writeFileSync(path.join(EV, `rb71b-${LABEL}.json`), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out.summary, null, 1)); process.exit(0); }
})();
