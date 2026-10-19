const X = require("./audit-s-exh-lib.cjs");
const { session, sleep } = X;
(async () => {
  const S = await session("owner", { width: 390, height: 844, mobile: true });
  try {
    await S.visit("/vault"); await sleep(6000); await S.visit("/museum"); await sleep(4500);
    console.log(JSON.stringify(await S.evaluate(`[...document.querySelectorAll('*')].filter(e => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 10; }).map(e => ({ tag: e.tagName, id: e.id, cls: String(e.className).slice(0, 50), sh: e.scrollHeight, ch: e.clientHeight }))`)));
    const hit = `(() => { const hit = (el) => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, Math.max(1, Math.min(innerHeight - 1, r.y + r.height / 2))); return { top: Math.round(r.top), ok: !!t && (t === el || el.contains(t)) }; }; return { filter: hit(document.querySelector('[aria-label="Filter exhibitions"]')), card: hit(document.querySelector('main article')), lastCard: hit([...document.querySelectorAll('main article')].pop()) }; })()`;
    const sc = await S.evaluate(`(() => { const e = [...document.querySelectorAll('*')].find(e => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 10 && !e.closest('aside'); }); window.__sc = e; return e ? e.tagName + '.' + e.className.toString().slice(0, 40) : null; })()`);
    console.log("scroller", sc);
    for (const y of [0, 150, 250, 400]) { await S.evaluate(`if (window.__sc) window.__sc.scrollTop = ${y}; true`); await sleep(400); console.log(y, JSON.stringify(await S.evaluate(hit))); }
  } finally { await S.close(); }
})();
