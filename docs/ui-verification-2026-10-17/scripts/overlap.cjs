// Install-prompt placement check at phone width. node overlap.cjs <label> --base=http://localhost:3000
const { session, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
const LABEL = process.argv[2] || "run";
const OUT = process.env.OUT || ".";
const WIDTHS = [[390, 844], [320, 640]];
const PAGES = ["/", "/vault", "/discover", "/portfolio"];
const measure = `(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const pill = [...document.querySelectorAll('div')].filter((d) => /Add to Home Screen/.test(d.textContent) && getComputedStyle(d).position === 'fixed' && d.children.length >= 3 && d.textContent.length < 40)[0];
  const add = document.querySelector('[data-mobile-add-item]');
  const nav = document.querySelector('nav[aria-label="Main navigation"]');
  const sync = [...document.querySelectorAll('[role="status"], div')].find((d) => getComputedStyle(d).position === 'fixed' && /sync|saved|offline|retry/i.test(d.textContent) && d.textContent.length < 80 && d !== pill && d.getBoundingClientRect().height > 0);
  const o = (a, b) => a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
  const P = r(pill), A = r(add), N = r(nav), S = r(sync);
  return { vw: innerWidth, vh: innerHeight, pill: P, add: A, nav: N, sync: S, overlapAdd: !!o(P, A), overlapNav: !!o(P, N), overlapSync: !!o(P, S), hScroll: document.documentElement.scrollWidth > innerWidth + 1 };
})()`;
(async () => {
  const results = [];
  for (const [w, h] of WIDTHS) {
    const S = await session(BASE, { width: w, height: h, mobile: true });
    try {
      for (const p of PAGES) {
        await S.go(p);
        await S.waitFor(`document.querySelector('nav[aria-label="Main navigation"]')`, 120000, "nav " + p);
        await sleep(2500);
        await S.evaluate(`window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) })); true`);
        await sleep(700);
        const m = JSON.parse(JSON.stringify(await S.evaluate(measure)));
        results.push({ w, page: p, ...m });
        console.log(w, p, JSON.stringify({ pill: m.pill, add: m.add, nav: m.nav, overlapAdd: m.overlapAdd, overlapNav: m.overlapNav, overlapSync: m.overlapSync, hScroll: m.hScroll }));
        await S.shot(`${OUT}/${LABEL}-${w}${p.replace(/\//g, "_") || "_"}.png`);
        if (w === 390 && p === "/vault") {
          // dismissal: tap X, pill gone, cooldown stored
          await S.click('button[aria-label="Dismiss"]'); await sleep(500);
          const d = await S.evaluate(`({ gone: ![...document.querySelectorAll('div')].some((d) => /Add to Home Screen/.test(d.textContent) && d.textContent.length < 40), key: !!localStorage.getItem('vltd_pwa_dismissed_until') })`);
          console.log("dismiss", JSON.stringify(d));
          await S.evaluate(`localStorage.removeItem('vltd_pwa_dismissed_until'); true`);
        }
      }
    } finally { await S.close(); }
  }
  require("fs").writeFileSync(`${OUT}/${LABEL}-measure.json`, JSON.stringify(results, null, 1));
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
