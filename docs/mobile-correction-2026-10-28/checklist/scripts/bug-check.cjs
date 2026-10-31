// Bug button check on the live app (vltd.app), phone emulation (not a physical phone): hidden away from the end of a page, visible at the end with nothing under it,
// still reachable from the Account menu (Support), and it opens the Report a bug dialog.
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node bug-check.cjs <outDir>
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const sleep = T.sleep;
const OUT = process.argv[2];
const PAGES = [["home", "/dashboard"], ["vault", "/vault"], ["exhibitions", "/museum"], ["discover", "/discover"], ["insights", "/portfolio"], ["add-item", "/capture"]];
const scrollTo = (frac) => `(() => { const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 300).sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement; sc.scrollTop = ${frac === 1 ? "1e6" : `Math.round((sc.scrollHeight - sc.clientHeight) * ${frac})`}; return sc.scrollHeight - sc.clientHeight; })()`;
const probe = `(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /report a bug/i.test(x.getAttribute('aria-label') || ''));
  if (!b) return { exists: false };
  const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const t = document.elementFromPoint(cx, cy);
  const sees = !!t && (t === b || b.contains(t));
  const bar = document.querySelector('nav[aria-label="Main navigation"]'); const barTop = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight;
  let under = [];
  for (const e of document.querySelectorAll('.vltd-content-wrap *')) {
    if (e.children.length > 0 && !/^(IMG|SVG|BUTTON|A|INPUT|SELECT)$/i.test(e.tagName)) continue;
    const tx = (e.textContent || '').trim(); if (!tx && !/^(IMG|SVG|INPUT|SELECT)$/i.test(e.tagName)) continue;
    const c = getComputedStyle(e); if (c.position === 'fixed' || c.visibility === 'hidden' || c.display === 'none') continue;
    const q = e.getBoundingClientRect(); if (q.left < r.right - 1 && q.right > r.left + 1 && q.top < r.bottom - 1 && q.bottom > r.top + 1) under.push((tx || e.tagName).replace(/\\s+/g, ' ').slice(0, 28));
  }
  return { exists: true, opacity: cs.opacity, pointerEvents: cs.pointerEvents, shown: parseFloat(cs.opacity) > 0.2 && cs.pointerEvents !== 'none', tappable: sees, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], barTop: Math.round(barTop), underContent: under.slice(0, 4) };
})()`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R = await start({ scene: "bug-check", phone: true, camera: true });
  const { S } = R; const report = [];
  const shot = async (n) => { const png = await S.send("Page.captureScreenshot", { format: "png" }); const f = path.join(OUT, n + ".jpg"); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 80 }).toFile(f); return n + ".jpg"; };
  try {
    for (const w of [390, 320]) {
      await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.round(w * 2.165), deviceScaleFactor: 2, mobile: true });
      for (const [name, url] of PAGES) {
        await R.goto(url); await sleep(2000);
        const scrollable = await S.evaluate(scrollTo(0.4)); await sleep(900);
        const mid = await S.evaluate(probe);
        await S.evaluate(scrollTo(1)); await sleep(1100);
        const end = await S.evaluate(probe); const img = await shot(`bug-${name}-end-${w}`);
        report.push({ w, page: name, scrollable: scrollable > 20, mid, end, img });
        console.log(`${w} ${name.padEnd(12)} scrollable=${scrollable > 20} mid: shown=${mid.shown} tappable=${mid.tappable} | end: shown=${end.shown} tappable=${end.tappable} underContent=[${(end.underContent || []).join("; ")}] box=${JSON.stringify(end.box)} barTop=${end.barTop}`);
      }
      // reachable from the Account menu
      await R.goto("/dashboard"); await sleep(2000);
      await S.evaluate(`document.querySelector('button[aria-label="Account menu"]').click()`); await sleep(800);
      const sup = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button, a')].find((x) => /^Support$/.test(x.innerText.trim())); if (!b) return null; const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const ok = !!t && (t === b || b.contains(t)); b.click(); return { ok, h: Math.round(r.height) }; })()`);
      await sleep(900);
      const dlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog][aria-label="Report a bug"]'); if (!d) return null; const ta = d.querySelector('textarea'); return { open: true, textarea: !!ta, send: !!([...d.querySelectorAll('button')].find((x) => /send report/i.test(x.innerText))) }; })()`);
      const img = await shot(`bug-account-support-${w}`);
      report.push({ w, page: "account-menu-support", support: sup, dialog: dlg, img });
      console.log(`${w} account menu > Support: ${JSON.stringify(sup)} dialog: ${JSON.stringify(dlg)}`);
    }
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  fs.writeFileSync(path.join(OUT, "bug-report.json"), JSON.stringify(report, null, 1));
  await R.close(); process.exit(0);
})();
