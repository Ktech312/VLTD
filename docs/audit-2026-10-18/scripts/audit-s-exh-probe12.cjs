const X = require("./audit-s-exh-lib.cjs");
const { session, sleep } = X;
(async () => {
  const S = await session("owner", { width: 390, height: 844, mobile: true });
  try {
    await S.visit("/vault"); await sleep(6000); await S.visit("/museum"); await sleep(4500);
    console.log(JSON.stringify(await S.evaluate(`(() => { const se = document.scrollingElement; const out = { sh: se.scrollHeight, ih: innerHeight, y0: scrollY }; window.scrollTo(0, 400); out.y1 = scrollY; const f = document.querySelector('[aria-label="Filter exhibitions"]').getBoundingClientRect(); out.filterTop = Math.round(f.top); const a = document.querySelector('aside').getBoundingClientRect(); out.aside = [Math.round(a.top), Math.round(a.bottom)]; const hdr = document.querySelector('header'); out.hdr = hdr ? Math.round(hdr.getBoundingClientRect().height) + ':' + getComputedStyle(hdr).position : null; const cards = [...document.querySelectorAll('main article')].slice(0, 6).map(c => Math.round(c.getBoundingClientRect().top)); out.cards = cards; return out; })()`)));
    for (const y of [0, 150, 300, 500]) {
      await S.evaluate(`window.scrollTo(0, ${y}); true`); await sleep(400);
      console.log(y, JSON.stringify(await S.evaluate(`(() => { const hit = (el) => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, Math.max(1, Math.min(innerHeight - 1, r.y + r.height / 2))); return { top: Math.round(r.top), h: Math.round(r.height), ok: !!t && (t === el || el.contains(t)) }; }; return { filter: hit(document.querySelector('[aria-label="Filter exhibitions"]')), sort: hit(document.querySelector('[aria-label="Sort exhibitions"]')), firstCard: hit(document.querySelector('main article')) }; })()`)));
    }
    await S.jshot("exh-probe12");
  } finally { await S.close(); }
})();
