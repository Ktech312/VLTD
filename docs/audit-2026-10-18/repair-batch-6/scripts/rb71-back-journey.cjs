// Home -> Insights -> Back (RB71): reproduce the one unexplained browser Back failure from RB66 run 1 and say what caused it.
// Production, isolated QA owner. For each timing the click on Insights is made T seconds after Home finished loading; before the click the page's history calls
// (pushState/replaceState) and the browser's Navigation API entries are recorded, so a redirect or replaced entry would be visible, not guessed.
//   AUDIT_MANIFEST=<manifest> node rb71-back-journey.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, runs: [], summary: {} };

const PATCH = `(() => { if (window.__hlog) return true; window.__hlog = []; for (const k of ['pushState', 'replaceState']) { const o = history[k]; history[k] = function (st, t, u) { window.__hlog.push({ k, u: String(u), at: Math.round(performance.now()), from: location.pathname, stack: (new Error().stack || '').split('\\n').slice(2, 5).map((x) => x.trim().slice(0, 90)) }); return o.apply(this, arguments); }; } return true; })()`;
const ENTRIES = `(() => (window.navigation ? navigation.entries().map((e) => new URL(e.url).pathname) : null))()`;
const LOC = `location.pathname`;
const clickNav = (label) => `(() => { const nav = document.querySelector('nav[aria-label="Primary"]'); const el = [...(nav || document).querySelectorAll('a,button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(label)}); if (!el) return false; el.click(); return true; })()`;

(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    // A. one click on Insights at different times after Home loaded, then Back
    for (const delay of [300, 1000, 2500, 3000, 6000]) {
      for (let rep = 0; rep < 4; rep++) {
        await S.visit("/dashboard");
        await sleep(delay);
        await S.evaluate(PATCH);
        const entriesBefore = await S.evaluate(ENTRIES);
        const clicked = await S.evaluate(clickNav("Insights"));
        const seen = [];
        for (const wait of [300, 900, 1800, 3000]) { await sleep(wait); seen.push(await S.evaluate(LOC)); }
        const entriesAfter = await S.evaluate(ENTRIES);
        const hlog = await S.evaluate("window.__hlog");
        await S.evaluate("history.back(); true"); await sleep(2500);
        const afterBack = await S.evaluate(LOC);
        out.runs.push({ kind: "A", delay, rep, clicked, atInsights: seen, entriesBefore: (entriesBefore || []).slice(-3), entriesAfter: (entriesAfter || []).slice(-3), hlog, afterBack });
      }
    }
    // B. the original journey: Home -> Insights -> More -> Events -> Back -> Back
    for (const delay of [2500, 3000]) {
      for (let rep = 0; rep < 3; rep++) {
        await S.visit("/dashboard"); await sleep(delay);
        await S.evaluate(PATCH);
        await S.evaluate(clickNav("Insights")); await sleep(1200);
        const atInsights = await S.evaluate(LOC);
        await S.evaluate(clickNav("More")); await sleep(600);
        await S.evaluate(`(() => { const el = [...document.querySelectorAll('[role="menu"] a, [role="menuitem"]')].find((x) => /Events/.test(x.textContent)); if (!el) return false; el.click(); return true; })()`);
        await sleep(2500);
        const atEvents = await S.evaluate(LOC);
        const entries = await S.evaluate(ENTRIES);
        const hlog = await S.evaluate("window.__hlog");
        await S.evaluate("history.back(); true"); await sleep(2500); const back1 = await S.evaluate(LOC);
        await S.evaluate("history.back(); true"); await sleep(2500); const back2 = await S.evaluate(LOC);
        out.runs.push({ kind: "B", delay, rep, atInsights, atEvents, entries: (entries || []).slice(-4), hlog, back1, back2 });
      }
    }
    // C. a click made while Home is still loading (the earliest a person could): right after navigation starts
    for (let rep = 0; rep < 4; rep++) {
      await S.visit("/dashboard");
      await S.evaluate(PATCH);
      const clicked = await S.evaluate(clickNav("Insights"));
      await sleep(4000);
      const atInsights = await S.evaluate(LOC);
      const entries = await S.evaluate(ENTRIES);
      const hlog = await S.evaluate("window.__hlog");
      await S.evaluate("history.back(); true"); await sleep(2500);
      out.runs.push({ kind: "C", rep, clicked, atInsights, entries: (entries || []).slice(-3), hlog, afterBack: await S.evaluate(LOC) });
    }
    const A = out.runs.filter((r) => r.kind === "A"); const B = out.runs.filter((r) => r.kind === "B"); const C = out.runs.filter((r) => r.kind === "C");
    out.summary = {
      A: { runs: A.length, stayedOnInsights: A.filter((r) => r.atInsights.every((u) => u === "/portfolio")).length, backToHome: A.filter((r) => r.afterBack === "/dashboard").length, replaceCalls: A.reduce((n, r) => n + (r.hlog || []).filter((h) => h.k === "replaceState").length, 0) },
      B: { runs: B.length, back1Insights: B.filter((r) => r.back1 === "/portfolio").length, back2Home: B.filter((r) => r.back2 === "/dashboard").length },
      C: { runs: C.length, stayedOnInsights: C.filter((r) => r.atInsights === "/portfolio").length, backToHome: C.filter((r) => r.afterBack === "/dashboard").length },
    };
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 700); console.error(e); }
  finally { try { await S.close(); } catch {} fs.writeFileSync(path.join(EV, `rb71-${LABEL}.json`), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out.summary, null, 1)); process.exit(0); }
})();
