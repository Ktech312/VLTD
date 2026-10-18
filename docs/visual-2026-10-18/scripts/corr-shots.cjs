// Settled screenshots for the correction set. Waits until every image in view has loaded and the page text has stopped changing, then captures full height.
//   node corr-shots.cjs <label> --base=http://localhost:3000 [--only=sold-1669-dark,...]
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const fs = require("fs");
const { browser, sleep } = require("./journey-lib.cjs");
const arg = (n, d) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "--" + n + "=" + d).split("=").slice(1).join("=");
const LABEL = process.argv[2] || "after"; const BASE = arg("base", "http://localhost:3000"); const ONLY = arg("only", "").split(",").filter(Boolean);
const OUT = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/visual-2026-10-18/corrections/" + LABEL; fs.mkdirSync(OUT, { recursive: true });
const PAGES = { sold: "/vault/sold", insights: "/portfolio", forsale: "/vault/for-sale", home: "/dashboard", items: "/vault" };
const READY = { sold: "document.querySelectorAll('article').length > 0 || /No sold items yet/i.test(document.body.innerText)", insights: "/TOTAL VAULT VALUE|Total Vault Value|STALE PRICES/i.test(document.body.innerText)", forsale: "document.querySelector('[data-for-sale], [data-vault-workspace=\"for-sale\"]') && /for sale|No items marked|Loading/i.test(document.body.innerText) && !/Loading your items/.test(document.body.innerText)", home: "/COLLECTION OVERVIEW/.test(document.body.innerText)", items: "/TOTAL VALUE/.test(document.body.innerText)" };
const W = [["1669", 1669, 900], ["1440", 1440, 900], ["1280", 1280, 900], ["390", 390, 844], ["320", 320, 700]];
const MATRIX = [];
for (const page of ["sold", "insights", "forsale", "home"]) for (const [wn, w, h] of W) MATRIX.push({ name: `${page}-${wn}-dark`, page, w, h, mobile: w < 500, theme: "deep-vault" });
for (const page of ["sold", "insights", "forsale", "home"]) MATRIX.push({ name: `${page}-1440-light`, page, w: 1440, h: 900, theme: "steel-light" }, { name: `${page}-390-light`, page, w: 390, h: 844, mobile: true, theme: "steel-light" });
(async () => {
  async function shot(s) {
    const S = await browser(BASE, { width: s.w, height: s.h, mobile: !!s.mobile });
    try {
      await S.evaluate(`localStorage.setItem('vltd-theme', ${JSON.stringify(s.theme)}); true`);
      await S.go(PAGES[s.page]); await S.waitFor(READY[s.page], 180000, s.name);
      // size the window to the whole page FIRST (so lazy images below the fold start loading), then settle: every image drawn on screen loaded, text stable
      await sleep(1200);
      const dims = await S.evaluate("(() => { let h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight); for (const e of document.querySelectorAll('*')) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) h = Math.max(h, e.scrollHeight + e.getBoundingClientRect().top); } return { h: Math.ceil(h), sw: document.documentElement.scrollWidth, vw: innerWidth }; })()");
      await S.send("Emulation.setDeviceMetricsOverride", { width: s.w, height: Math.min(Math.max(dims.h, s.h), 3600), deviceScaleFactor: 1, mobile: !!s.mobile });
      let last = "", stable = 0; const t0 = Date.now();
      while (Date.now() - t0 < 60000 && stable < 3) { await sleep(900); const st = await S.evaluate("(() => { const vw = document.documentElement.clientWidth; const imgs = [...document.querySelectorAll('img')].filter((i) => { const r = i.getBoundingClientRect(); if (!(r.width > 8 && r.right > 0 && r.left < vw - 1 && i.getAttribute('src') && !i.closest('[aria-hidden=true]'))) return false; const el = document.elementFromPoint(Math.min(vw - 2, Math.max(1, r.left + r.width / 2)), Math.min(innerHeight - 2, Math.max(1, r.top + r.height / 2))); const host = i.closest('a,button') || i.parentElement; return !!el && (i.contains(el) || host.contains(el)); }); const bad = imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).length; return bad + '|' + document.body.innerText.length + '|' + imgs.length; })()"); if (st === last && st.startsWith("0|")) stable++; else stable = 0; last = st; }
      if (Number(last.split('|')[1]) < 400) throw new Error('page did not render (text ' + last + ')');
      await S.evaluate("(() => { const t = [...document.querySelectorAll('div')].find((d) => /Add to Home Screen/.test(d.textContent) && d.querySelector('button') && d.getBoundingClientRect().height < 80); if (t) t.remove(); return true; })()").catch(() => {});
      await sleep(600);
      const r = await S.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(r.data, "base64"));
      console.log(s.name.padEnd(22), "settled:", stable >= 3, "imgs:", last, "| overflow:", dims.sw > dims.vw + 1 ? dims.sw - dims.vw + "px" : "none");
    } finally { await S.close(); }
  }
  for (const s of MATRIX) {
    if (ONLY.length && !ONLY.includes(s.name)) continue;
    for (let attempt = 1; attempt <= 3; attempt++) { try { await shot(s); break; } catch (e) { console.log(s.name, "attempt", attempt, "failed:", String(e.message || e).slice(0, 80)); await sleep(8000); } }
  }
})();
