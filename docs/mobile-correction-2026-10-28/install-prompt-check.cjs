// Install-prompt ("Add to Home Screen") obstruction check on the live app (vltd.app), as an isolated synthetic collector, in Chrome phone emulation (not a physical phone).
// Android/Chrome: the prompt is shown by firing a synthetic beforeinstallprompt event. iOS: the prompt shows after the user agent is switched to an iPhone one, and its steps are opened.
// For Home, Vault, Exhibitions, Discover, Insights, the More sheet and the Add chooser it records where the prompt sits and whether it covers the bottom bar, the bug button,
// a menu row, or any control at the end of the page (elementFromPoint on every on-screen control).
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node install-prompt-check.cjs [outDir]
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const sleep = T.sleep;
const OUT = process.argv[2] || path.join(__dirname, "install-prompt");
const WIDTHS = (process.env.WIDTHS || "390,320").split(",").map(Number);
const PAGES = [["home", "/dashboard"], ["vault", "/vault"], ["exhibitions", "/museum"], ["discover", "/discover"], ["insights", "/portfolio"]];
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const probe = `(() => {
  const rect = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  const ban = [...document.querySelectorAll('[data-site-chrome="true"]')].find((e) => /Add to Home Screen/i.test(e.textContent || ''));
  const bar = document.querySelector('nav[aria-label="Main navigation"]');
  const bug = [...document.querySelectorAll('button')].find((b) => /bug|report a problem|feedback/i.test(b.getAttribute('aria-label') || ''));
  const hit = (e, x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
  const inter = (a, b) => a && b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const B = rect(ban);
  const covered = [];
  if (ban) for (const e of document.querySelectorAll('button, a[href], select, input:not([type=hidden]), [role=button], [role=menuitem]')) {
    if (ban.contains(e)) continue;
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue;
    const t = document.elementFromPoint(cx, cy);
    if (t && ban.contains(t)) covered.push(((e.innerText || e.getAttribute('aria-label') || e.tagName) + '').trim().replace(/\\s+/g, ' ').slice(0, 30));
  }
  const menu = [...document.querySelectorAll('[role=menuitem]')].map((e) => ({ label: (e.innerText || '').trim().split('\\n')[0], rect: rect(e) }));
  return { banner: B, bar: rect(bar && bar.firstElementChild), bug: rect(bug), overBar: inter(B, rect(bar && bar.firstElementChild)), overBug: inter(B, rect(bug)), covered, menuOverlaps: menu.filter((m) => inter(B, m.rect)).map((m) => m.label), vh: innerHeight };
})()`;
const scrollEnd = `(() => { const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 300).sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement; sc.scrollTop = sc.scrollHeight; return sc.scrollTop; })()`;
const scrollTop = scrollEnd.replace("sc.scrollHeight", "0");
// lowest visible, non-fixed content bottom vs the top of the prompt when scrolled to the end
const endGap = `(() => { const ban = [...document.querySelectorAll('[data-site-chrome="true"]')].find((e) => /Add to Home Screen/i.test(e.textContent || '')); if (!ban) return null; const top = ban.getBoundingClientRect().top; let low = 0; for (const e of document.querySelectorAll('main *')) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width < 4 || r.height < 4 || cs.position === 'fixed' || cs.visibility === 'hidden') continue; if (r.bottom <= innerHeight + 2 && r.bottom > low) low = r.bottom; } return { lowestContentBottom: Math.round(low), bannerTop: Math.round(top), clear: low <= top + 1 }; })()`;

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
          if (mode === "android") { await S.evaluate("window.dispatchEvent(new Event('beforeinstallprompt'))"); }
          await sleep(900);
        };
        for (const [name, url] of PAGES) {
          await show(url);
          await S.evaluate(scrollTop); await sleep(300);
          const top = await S.evaluate(probe);
          await S.evaluate(scrollEnd); await sleep(600);
          const end = await S.evaluate(probe); const gap = await S.evaluate(endGap);
          const img = await shot(`${mode}-${name}-end-${w}`);
          report.push({ mode, w, page: name, top, end, gap, img });
          console.log(`${mode} ${w} ${name.padEnd(11)} banner=${JSON.stringify(end.banner)} overBar=${end.overBar} overBug=${end.overBug} coveredAtEnd=[${end.covered.join("; ")}] endClear=${gap && gap.clear}`);
        }
        // More sheet and Add chooser with the prompt showing
        for (const [name, sel] of [["more", 'button[aria-label="More categories"]'], ["add", 'button[aria-label="Add item to vault"]']]) {
          await show("/dashboard");
          await S.evaluate(`document.querySelector('${sel}').click()`); await sleep(900);
          const m = await S.evaluate(probe); const img = await shot(`${mode}-menu-${name}-${w}`);
          report.push({ mode, w, page: "menu-" + name, menu: m, img });
          console.log(`${mode} ${w} menu-${name} banner=${JSON.stringify(m.banner)} menuRowsUnderBanner=[${m.menuOverlaps.join("; ")}] covered=[${m.covered.join("; ")}]`);
          await S.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(400);
        }
        if (mode === "ios") {
          await show("/dashboard");
          await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /Add to Home Screen/i.test(x.textContent || '')); if (b) b.click(); return !!b; })()`); await sleep(600);
          const m = await S.evaluate(probe); const img = await shot(`ios-steps-open-${w}`);
          report.push({ mode, w, page: "ios-steps", menu: m, img });
          console.log(`ios ${w} steps open banner=${JSON.stringify(m.banner)} overBar=${m.overBar} overBug=${m.overBug}`);
        }
      }
    }
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
  await R.close();
  process.exit(0);
})();
