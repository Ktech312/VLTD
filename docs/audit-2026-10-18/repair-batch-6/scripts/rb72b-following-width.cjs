// Following tab on a phone: are the rule cards wider than the screen? (RB72b) Measures each card's rectangle against the viewport (the page-level overflow check can read 0 while a card is clipped).
const path = require("path");
const T = require(path.join(__dirname, "..", "..", "scripts", "audit-s-add-lib.cjs"));
const { sleep, session } = T;
(async () => {
  for (const w of [390, 360, 320]) {
    const S = await session("owner", { width: w, height: 844, mobile: true });
    await S.visit("/watchlist"); await sleep(5000);
    await S.evaluate(`(() => { const b = [...document.querySelectorAll('button,a,[role=\"tab\"]')].find((x) => x.getBoundingClientRect().width > 0 && /^Following/.test(x.textContent.trim())); if (b) b.click(); return true; })()`);
    await sleep(2500);
    const m = await S.evaluate(`(() => ({ vw: innerWidth, docW: document.documentElement.scrollWidth, cards: [...document.querySelectorAll('[data-testid=\"rule-card\"]')].map((c) => { const r = c.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; }), parents: (() => { const c = document.querySelector('[data-testid=\"rule-card\"]'); const out = []; let e = c && c.parentElement; for (let i = 0; i < 4 && e; i++, e = e.parentElement) { const r = e.getBoundingClientRect(); out.push({ tag: e.tagName, cls: String(e.className).slice(0, 80), left: Math.round(r.left), right: Math.round(r.right), ov: getComputedStyle(e).overflowX }); } return out; })() }))()`);
    console.log(w, JSON.stringify(m));
    await S.close();
  }
  process.exit(0);
})();
