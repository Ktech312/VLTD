// Settled Home screenshots on production: waits until the photos in view and the exhibition covers have actually loaded and the Lounge block has
// resolved (posts, honest empty state, or actionable error) BEFORE capturing; records what it saw. Synthetic account (visual-fixture.cjs).
//   node home-settled.cjs --base=https://vltd.app
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const fs = require("fs");
const { browser, sleep } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const OUT = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/visual-2026-10-18/after-settled";
fs.mkdirSync(OUT, { recursive: true });
const CONFIGS = [
  { name: "home-desktop-dark", w: 1440, h: 900, theme: "deep-vault" },
  { name: "home-desktop-light", w: 1440, h: 900, theme: "steel-light" },
  { name: "home-phone-dark", w: 390, h: 844, theme: "deep-vault", mobile: true },
  { name: "home-phone-light", w: 390, h: 844, theme: "steel-light", mobile: true },
];
const PROBE = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; };
  const strip = document.querySelector('[aria-label^="Recently added items."]');
  const sr = strip && strip.getBoundingClientRect();
  const inView = (e) => { const r = e.getBoundingClientRect(); return sr && r.right > sr.left + 2 && r.left < sr.right - 2; };
  const recent = [...document.querySelectorAll('[data-recent-item] img')].filter(inView).map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 }));
  const exSec = [...document.querySelectorAll('section')].find((s) => /your exhibitions/i.test(s.querySelector('h2')?.textContent || ''));
  const covers = exSec ? [...exSec.querySelectorAll('img')].filter(vis).map((i) => ({ src: (i.currentSrc || i.src || '').replace(location.origin, ''), ok: i.complete && i.naturalWidth > 0 })) : [];
  const lounge = [...document.querySelectorAll('section')].find((s) => /from the lounge/i.test(s.querySelector('h2')?.textContent || ''));
  const lt = lounge ? lounge.innerText.replace(/\\s+/g, ' ') : '';
  const loungeState = !lounge ? 'missing' : /Loading posts/i.test(lt) ? 'loading' : /could not be loaded/i.test(lt) ? 'error' : /No posts yet/i.test(lt) ? 'empty' : 'posts';
  return { recent, covers, loungeState, loungeText: lt.slice(0, 160), overview: /COLLECTION OVERVIEW/.test(document.body.innerText), theme: document.documentElement.className + ' ' + (document.documentElement.getAttribute('data-vltd-theme') || '') };
})()`;
(async () => {
  const report = [];
  for (const c of CONFIGS) {
    const S = await browser(BASE, { width: c.w, height: c.h, mobile: !!c.mobile });
    const row = { name: c.name, base: BASE };
    try {
      await S.evaluate(`localStorage.setItem('vltd-theme', ${JSON.stringify(c.theme)}); true`);
      const t0 = Date.now(); await S.go("/dashboard");
      let p = null, settled = false;
      while (Date.now() - t0 < 120000) {
        await sleep(1500);
        try { p = await S.evaluate(PROBE); } catch { continue; }
        if (p.overview && p.recent.length > 0 && p.recent.every((x) => x.ok) && p.covers.length > 0 && p.covers.every((x) => x.ok) && p.loungeState !== "loading" && p.loungeState !== "missing") { settled = true; break; }
      }
      row.settledAfterMs = Date.now() - t0; row.settled = settled; row.probe = p;
      await sleep(1500);
      const final = await S.evaluate(PROBE); row.final = final;
      row.recentLoaded = final.recent.filter((x) => x.ok).length + "/" + final.recent.length;
      row.coversLoaded = final.covers.filter((x) => x.ok).length + "/" + final.covers.length;
      row.loungeState = final.loungeState;
      await S.evaluate("(() => { const t = [...document.querySelectorAll('div')].find((d) => /Add to Home Screen/.test(d.textContent) && d.querySelector('button') && d.getBoundingClientRect().height < 80); if (t) t.remove(); return true; })()").catch(() => {});
      const h = await S.evaluate("(() => { let h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight); for (const e of document.querySelectorAll('*')) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) h = Math.max(h, e.scrollHeight + e.getBoundingClientRect().top); } return Math.ceil(h); })()");
      await S.send("Emulation.setDeviceMetricsOverride", { width: c.w, height: Math.min(Math.max(h, c.h), 3600), deviceScaleFactor: 1, mobile: !!c.mobile }); await sleep(2500);
      const after = await S.evaluate(PROBE); row.afterResize = { recent: after.recent.filter((x) => x.ok).length + "/" + after.recent.length, covers: after.covers.filter((x) => x.ok).length + "/" + after.covers.length, lounge: after.loungeState };
      const r = await S.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(`${OUT}/${c.name}${settled ? "" : "-UNSETTLED"}.png`, Buffer.from(r.data, "base64"));
    } catch (e) { row.error = e.message.slice(0, 160); } finally { await S.close(); }
    console.log(JSON.stringify({ name: row.name, settled: row.settled, afterMs: row.settledAfterMs, recent: row.recentLoaded, covers: row.coversLoaded, lounge: row.loungeState, afterResize: row.afterResize, error: row.error }));
    report.push(row);
  }
  fs.writeFileSync(`${OUT}/settled-report.json`, JSON.stringify(report, null, 1));
})();
