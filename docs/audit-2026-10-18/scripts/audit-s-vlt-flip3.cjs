const X = require("./audit-s-vlt-vlib.cjs");
const { sleep, drag, touchSwipe } = X;
const n = async (S) => { const m = /(\d+) \/ (\d+)/.exec(await S.evaluate("document.body.innerText.replace(/\\s+/g, ' ')")); return m ? m[0] : null; };
(async () => {
  const S = await X.session("owner");
  try {
    await S.visit("/vault"); await S.evaluate("localStorage.setItem('vltd_vault_view_mode', 'flip'); sessionStorage.clear(); true"); await S.visit("/vault"); await sleep(800);
    const box = await S.evaluate("(() => { const imgs = [...document.querySelectorAll('main img')].filter((i) => i.getBoundingClientRect().width > 150); const el = imgs[0]; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const cs = []; for (const i of imgs) { const q = i.getBoundingClientRect(); cs.push([Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]); } return { x: r.left + r.width / 2, y: r.top + r.height / 2, cs, vw: innerWidth }; })()");
    console.log(JSON.stringify(box));
    for (const [label, dx, steps] of [["right +200", 200, 8], ["right +300", 300, 8], ["right +200 slow", 200, 30], ["left -200", -200, 8], ["right +200 again", 200, 8]]) {
      const b = await S.evaluate("(() => { const imgs = [...document.querySelectorAll('main img')].filter((i) => i.getBoundingClientRect().width > 150); const r = imgs[0].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
      const before = await n(S); await drag(S, b.x, b.y, b.x + dx, b.y, steps); await sleep(1300); console.log(label, before, "->", await n(S));
    }
  } finally { await S.close(); }
  const M = await X.session("owner", { width: 390, height: 844, mobile: true });
  try {
    await M.visit("/vault"); await M.evaluate("localStorage.setItem('vltd_vault_view_mode', 'flip'); true"); await M.visit("/vault"); await sleep(1500);
    console.log("phone imgs", await M.evaluate("JSON.stringify([...document.querySelectorAll('img')].map((i) => [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height), (i.getAttribute('src') || '').slice(-20)]).slice(0, 8))"));
    console.log("phone counter", await n(M)); await M.jshot("vlt-flip-390-probe");
  } finally { await M.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
