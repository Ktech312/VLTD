// Full-page screenshots of the pages the visual work touches, desktop and phone, dark and light, for a synthetic account.
//   node shots.cjs <label> --base=https://vltd.app [--only=home-desktop,...]   -> docs/visual-2026-10-18/<label>/<name>.png
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const fs = require("fs");
const { browser, sleep } = require("./journey-lib.cjs");
const arg = (n, d) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "--" + n + "=" + d).split("=").slice(1).join("=");
const LABEL = process.argv[2] || "shots"; const BASE = arg("base", "https://vltd.app"); const ONLY = arg("only", "");
const OUT = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/visual-2026-10-18/" + LABEL; fs.mkdirSync(OUT, { recursive: true });
const SHOTS = [
  { name: "home-desktop", path: "/dashboard", w: 1440, h: 900, ready: "/COLLECTION OVERVIEW/.test(document.body.innerText) && document.querySelectorAll('a[href^=\"/vault/item/\"] img').length > 0" },
  { name: "home-phone", path: "/dashboard", w: 390, h: 844, mobile: true, ready: "/COLLECTION OVERVIEW/.test(document.body.innerText)" },
  { name: "home-desktop-light", path: "/dashboard", w: 1440, h: 900, theme: "steel-light", ready: "/COLLECTION OVERVIEW/.test(document.body.innerText)" },
  { name: "sold-desktop", path: "/vault/sold", w: 1440, h: 900, ready: "/Realized Profit/i.test(document.body.innerText)" },
  { name: "sold-phone", path: "/vault/sold", w: 390, h: 844, mobile: true, ready: "/Realized Profit/i.test(document.body.innerText)" },
  { name: "sold-desktop-light", path: "/vault/sold", w: 1440, h: 900, theme: "steel-light", ready: "/Realized Profit/i.test(document.body.innerText)" },
  { name: "insights-desktop", path: "/portfolio", w: 1440, h: 900, ready: "/TOTAL VAULT VALUE/i.test(document.body.innerText)" },
  { name: "items-desktop", path: "/vault", w: 1440, h: 900, ready: "/TOTAL VALUE/.test(document.body.innerText) && document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0" },
  { name: "forsale-desktop", path: "/vault/for-sale", w: 1440, h: 900, ready: "document.querySelector('nav[aria-label=\"Vault\"]') && document.body.innerText.length > 100" },
  { name: "goals-desktop", path: "/goals", w: 1440, h: 900, ready: "document.querySelector('nav[aria-label=\"Vault\"]') && /Goals/.test(document.body.innerText)" },
];
(async () => {
  for (const s of SHOTS) {
    if (ONLY && !ONLY.split(",").includes(s.name)) continue;
    const S = await browser(BASE, { width: s.w, height: s.h, mobile: !!s.mobile });
    try {
      if (s.theme) await S.evaluate(`localStorage.setItem('vltd-theme', ${JSON.stringify(s.theme)}); localStorage.setItem('vltd_theme_mode', 'light'); true`);
      await S.go(s.path); await S.waitFor(s.ready, 120000, s.name); await sleep(4500);
      await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /^No$/.test(x.textContent.trim())); if (b) b.click(); return true; })()").catch(() => {}); await sleep(600);
      await S.evaluate("(() => { const x = [...document.querySelectorAll('button')].find((b) => /^(×|✕|x)$/i.test(b.textContent.trim()) || /dismiss|close/i.test(b.getAttribute('aria-label')||'')); const t = [...document.querySelectorAll('div')].find((d) => /Add to Home Screen/.test(d.textContent) && d.querySelector('button') && d.getBoundingClientRect().height < 80); if (t) t.remove(); return true; })()").catch(() => {});
      const dims = await S.evaluate("(() => { let h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight); for (const e of document.querySelectorAll('*')) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) h = Math.max(h, e.scrollHeight + e.getBoundingClientRect().top); } return { w: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), h: Math.ceil(h), vw: innerWidth }; })()");
      const H = Math.min(Math.max(dims.h, s.h), 3600);
      await S.send('Emulation.setDeviceMetricsOverride', { width: s.w, height: H, deviceScaleFactor: 1, mobile: !!s.mobile }); await sleep(1500);
      const r = await S.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`${OUT}/${s.name}.png`, Buffer.from(r.data, 'base64'));

      console.log(s.name, "saved; page", dims.w + "x" + dims.h, dims.w > dims.vw + 1 ? "(HORIZONTAL OVERFLOW " + (dims.w - dims.vw) + "px)" : "");
    } catch (e) { console.log(s.name, "FAILED", e.message.slice(0, 100)); } finally { await S.close(); }
  }
})();
