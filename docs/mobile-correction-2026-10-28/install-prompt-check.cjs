// Install-prompt ("Add to Home Screen") obstruction check on the live app (vltd.app), as an isolated synthetic collector, in Chrome phone emulation (not a physical phone).
// Android/Chrome: the prompt is shown by firing a synthetic beforeinstallprompt event. iOS: the prompt shows after the user agent is switched to an iPhone one, and its steps are opened.
// v2 (2026-10-30) measures what a person actually sees, not just rectangles:
//   - how much of the prompt is really visible (a grid of elementFromPoint samples over it, so a prompt hidden behind a menu or faded out counts as 0)
//   - whether any content at the end of the page sits under the visible prompt (leaf elements of the scrolled page against the prompt's box)
//   - whether the prompt covers the bottom bar, the bug button, or any control's centre
//   - the More sheet explicitly: its tiles are all tappable (elementFromPoint at each centre), it sits above the bar and inside the screen, and the prompt is not visible beside or over it
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node install-prompt-check.cjs [outDir]
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const sleep = T.sleep;
const OUT = process.argv[2] || path.join(__dirname, "install-prompt");
const WIDTHS = (process.env.WIDTHS || "390,360,320").split(",").map(Number);
const PAGES = [["home", "/dashboard"], ["vault", "/vault"], ["exhibitions", "/museum"], ["discover", "/discover"], ["insights", "/portfolio"]];
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const probe = `(() => {
  const rect = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  const ban = [...document.querySelectorAll('[data-pwa-banner="true"], [data-site-chrome="true"]')].find((e) => /Add to Home Screen/i.test(e.textContent || ''));
  const bar = document.querySelector('nav[aria-label="Main navigation"]');
  const barBox = bar && bar.firstElementChild;
  const bug = [...document.querySelectorAll('button')].find((b) => /report a bug/i.test(b.getAttribute('aria-label') || ''));
  const inter = (a, b) => !!a && !!b && a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
  const B = rect(ban);
  let visibleFraction = 0;
  if (ban) { let n = 0, hit = 0; const r = ban.getBoundingClientRect(); for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) { const x = r.left + (i + 0.5) * r.width / 12, y = r.top + (j + 0.5) * r.height / 4; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue; n++; const t = document.elementFromPoint(x, y); if (t && ban.contains(t) && getComputedStyle(ban).opacity !== '0') hit++; } visibleFraction = n ? Math.round(100 * hit / n) / 100 : 0; }
  const visible = visibleFraction > 0.2;
  const covered = [];
  if (ban && visible) for (const e of document.querySelectorAll('button, a[href], select, input:not([type=hidden]), [role=button], [role=menuitem]')) {
    if (ban.contains(e)) continue;
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue;
    const t = document.elementFromPoint(cx, cy);
    if (t && ban.contains(t)) covered.push(((e.innerText || e.getAttribute('aria-label') || e.tagName) + '').trim().replace(/\\s+/g, ' ').slice(0, 30));
  }
  // content under the visible prompt: leaf elements of the scrolled page that intersect the prompt box
  const under = [];
  if (ban && visible) for (const e of document.querySelectorAll('.vltd-content-wrap *')) {
    if (e.children.length > 0 && !/^(IMG|SVG|BUTTON|A|INPUT|SELECT)$/i.test(e.tagName)) continue;
    const t = (e.textContent || '').trim();
    if (!t && !/^(IMG|SVG|INPUT|SELECT)$/i.test(e.tagName)) continue;
    const cs = getComputedStyle(e); if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (inter(rect(e), B)) under.push((t || e.tagName).replace(/\\s+/g, ' ').slice(0, 30));
  }
  // the More sheet, when open: every tile tappable, sheet above the bar and on screen
  const tiles = [...document.querySelectorAll('[role=dialog] a, [role=dialog] button, [data-more-sheet] a, [data-more-sheet] button')];
  const moreTiles = tiles.map((e) => { const r = e.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const t = document.elementFromPoint(cx, cy); return { label: ((e.innerText || e.getAttribute('aria-label') || '') + '').trim().replace(/\\s+/g, ' ').slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), tappable: !!t && (t === e || e.contains(t)), onScreen: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; }).filter((x) => x.w > 20);
  const menu = [...document.querySelectorAll('[role=menuitem]')].map((e) => { const r = e.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const t = document.elementFromPoint(cx, cy); return { label: (e.innerText || '').trim().split('\\n')[0], tappable: !!t && (t === e || e.contains(t)) }; });
  return { banner: B, visibleFraction, overBar: visible && inter(B, rect(barBox)), overBug: visible && inter(B, rect(bug)), covered, underContent: under.slice(0, 6), moreTiles, menu, barTop: barBox ? Math.round(barBox.getBoundingClientRect().top) : null, vh: innerHeight };
})()`;
const scrollEnd = `(() => { const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 300).sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement; sc.scrollTop = sc.scrollHeight; return sc.scrollTop; })()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R = await start({ scene: "install-prompt", phone: true, camera: false });
  const { S } = R; const report = [];
  const shot = async (name) => { const png = await S.send("Page.captureScreenshot", { format: "png" }); const f = path.join(OUT, name + ".jpg"); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 82 }).toFile(f); return name + ".jpg"; };
  const clearFlags = `(() => { try { localStorage.removeItem('vltd_pwa_dismissed_until'); localStorage.removeItem('vltd_pwa_installed'); } catch (e) {} return true; })()`;
  try {
    for (const mode of ["android", "ios"]) {
      if (mode === "ios") await S.send("Emulation.setUserAgentOverride", { userAgent: IOS_UA, platform: "iPhone" });
      for (const w of WIDTHS) {
        await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.round(w * 2.165), deviceScaleFactor: 2, mobile: true });
        const show = async (url) => {
          await R.goto(url); await S.evaluate(clearFlags); await S.evaluate("location.reload()"); await sleep(3000);
          if (mode === "android") await S.evaluate("window.dispatchEvent(new Event('beforeinstallprompt'))");
          await sleep(900);
        };
        for (const [name, url] of PAGES) {
          await show(url);
          await S.evaluate(scrollEnd); await sleep(700);
          const end = await S.evaluate(probe);
          const img = await shot(`${mode}-${name}-end-${w}`);
          report.push({ mode, w, page: name, end, img });
          console.log(`${mode} ${w} ${name.padEnd(11)} promptVisible=${end.visibleFraction} underContent=[${end.underContent.join("; ")}] overBar=${end.overBar} overBug=${end.overBug} coveredControls=[${end.covered.join("; ")}]`);
        }
        for (const [name, sel] of [["more", 'button[aria-label="More categories"]'], ["add", 'button[aria-label="Add item to vault"]']]) {
          await show("/dashboard");
          await S.evaluate(`document.querySelector('${sel}').click()`); await sleep(1000);
          const m = await S.evaluate(probe); const img = await shot(`${mode}-menu-${name}-${w}`);
          report.push({ mode, w, page: "menu-" + name, menu: m, img });
          const items = name === "more" ? m.moreTiles : m.menu;
          console.log(`${mode} ${w} menu-${name} promptVisible=${m.visibleFraction} items=${items.length} allTappable=${items.every((x) => x.tappable)}${name === "more" ? ` allOnScreen=${items.every((x) => x.onScreen)}` : ""} coveredControls=[${m.covered.join("; ")}]`);
          await S.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(400);
        }
        if (mode === "ios") {
          await show("/dashboard");
          await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /Add to Home Screen/i.test(x.textContent || '')); if (b) b.click(); return !!b; })()`); await sleep(600);
          await S.evaluate(scrollEnd); await sleep(600);
          const m = await S.evaluate(probe); const img = await shot(`ios-steps-open-end-${w}`);
          report.push({ mode, w, page: "ios-steps-end", end: m, img });
          console.log(`ios ${w} steps open, page end: promptVisible=${m.visibleFraction} underContent=[${m.underContent.join("; ")}] overBar=${m.overBar} overBug=${m.overBug}`);
        }
      }
    }
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
  await R.close();
  process.exit(0);
})();
