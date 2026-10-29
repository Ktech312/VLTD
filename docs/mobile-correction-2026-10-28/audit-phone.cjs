// Phone layout audit of the live app (vltd.app) as an isolated synthetic collector, in Chrome device emulation (not a physical phone):
// Home, Vault, Exhibitions, Discover, Insights at 390, 360 and 320 px wide, plus the More sheet and the Add chooser. Records screenshots and measurements:
// horizontal overflow, content clipped at the right edge, controls taller than 48 px or shorter than 28 px, and whether the last content scrolls clear of the bottom bar.
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node audit-phone.cjs [outDir] [label]
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const sleep = T.sleep;
const OUT = process.argv[2] || path.join(__dirname, "shots");
const LABEL = process.argv[3] || "";
const WIDTHS = (process.env.WIDTHS || "390,360,320").split(",").map(Number);
const PAGES = [["home", "/dashboard"], ["vault", "/vault"], ["exhibitions", "/museum"], ["discover", "/discover"], ["insights", "/portfolio"]];
const PAGE_FILTER = process.env.PAGES ? process.env.PAGES.split(",") : null;

const measure = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const bar = document.querySelector('nav[aria-label="Main navigation"]');
  const barTop = bar ? bar.firstElementChild.getBoundingClientRect().top : vh;
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const inBar = (e) => bar && bar.contains(e);
  const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 300).sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement;
  const cut = []; const tall = []; const short = [];
  for (const e of document.querySelectorAll('button, a, select, input:not([type=hidden]), [role=button]')) {
    if (!vis(e) || inBar(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) cut.push((e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
    const label = (e.innerText || '').trim();
    if (label && label.length < 40 && e.tagName !== 'A' && r.width < vw - 40) { if (r.height > 48) tall.push(label.slice(0, 24) + ' ' + Math.round(r.height)); if (r.height < 28) short.push(label.slice(0, 24) + ' ' + Math.round(r.height)); }
  }
  return { vw, docOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw, barTop: Math.round(barTop), barHeight: bar ? Math.round(bar.firstElementChild.getBoundingClientRect().height) : 0, scroller: sc ? (sc.tagName + '.' + String(sc.className).slice(0, 30)) : null, cut: cut.slice(0, 8), tall: tall.slice(0, 8), short: short.slice(0, 8) };
})()`;
const scrollEnd = `(() => { const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 300).sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement; sc.scrollTop = sc.scrollHeight; return sc.scrollTop; })()`;
const scrollTop = `(() => { const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 300).sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement; sc.scrollTop = 0; return 0; })()`;
// is the last visible content clear of the bar when scrolled to the end? (lowest visible non-bar element bottom <= bar top + 1)
const lastClear = `(() => { const bar = document.querySelector('nav[aria-label="Main navigation"]'); const top = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; let low = 0; for (const e of document.querySelectorAll('main *, [class*=page] *')) { if (bar && bar.contains(e)) continue; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width < 4 || r.height < 4 || cs.position === 'fixed' || cs.visibility === 'hidden') continue; if (r.top < innerHeight && r.bottom > low && r.bottom <= innerHeight + 2) low = r.bottom; } return { lowestContentBottom: Math.round(low), barTop: Math.round(top), clear: low <= top + 1 }; })()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R = await start({ scene: "audit-phone", phone: true, camera: false });
  const { S } = R; const report = [];
  const shot = async (w, name) => { const png = await S.send("Page.captureScreenshot", { format: "png" }); const f = path.join(OUT, `${LABEL}${name}-${w}.jpg`); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 82 }).toFile(f); return path.basename(f); };
  try {
    for (const w of WIDTHS) {
      const h = Math.round(w * 2.165);
      await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      for (const [name, url] of PAGES) {
        if (PAGE_FILTER && !PAGE_FILTER.includes(name)) continue;
        await R.goto(url); await sleep(2500);
        await S.evaluate(scrollTop); await sleep(400);
        const top = await shot(w, name + "-top");
        const m = await S.evaluate(measure);
        await S.evaluate(scrollEnd); await sleep(600);
        const end = await shot(w, name + "-end");
        const clear = await S.evaluate(lastClear);
        const path_ = await S.path();
        report.push({ w, page: name, path: path_, top, end, ...m, endClear: clear });
        console.log(`${w} ${name.padEnd(11)} path=${path_} overflow=${m.docOverflow} bar=${m.barHeight}px cut=${m.cut.length} tall=${m.tall.length} short=${m.short.length} endClear=${clear.clear}`);
      }
      if (w === WIDTHS[0] || w === 320) {
        await R.goto("/dashboard"); await sleep(2500);
        await S.evaluate(`document.querySelector('button[aria-label="More categories"]').click()`); await sleep(900);
        const more = await shot(w, "menu-more");
        await S.evaluate(`document.querySelector('button[aria-label="More categories"]').click()`); await sleep(500);
        await S.evaluate(`document.querySelector('button[aria-label="Add item to vault"]').click()`); await sleep(900);
        const add = await shot(w, "menu-add");
        const items = await S.evaluate(`[...document.querySelectorAll('[role=menuitem]')].map((a) => a.textContent.trim().replace(/\\s+/g, ' ') + ' -> ' + a.getAttribute('href'))`);
        report.push({ w, page: "menus", more, add, addItems: items });
        console.log(w, "menus", more, add, JSON.stringify(items));
        await S.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(400);
      }
    }
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  fs.writeFileSync(path.join(OUT, `${LABEL}report.json`), JSON.stringify(report, null, 1));
  await R.close();
  process.exit(0);
})();
