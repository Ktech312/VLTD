const X = require("./audit-s-vlt-vlib.cjs");
const { sleep, touchSwipe } = X;
(async () => {
  const M = await X.session("owner", { width: 390, height: 844, mobile: true });
  try {
    await M.visit("/vault"); await M.evaluate("localStorage.setItem('vltd_vault_view_mode', 'flip'); sessionStorage.clear(); true"); await M.visit("/vault"); await sleep(2500);
    const find = () => M.evaluate("(() => { const els = [...document.querySelectorAll('button,input')].filter((e) => /^\\d+ ?\\/ ?\\d+$/.test((e.innerText || '').trim())); const e = els[0]; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { tag: e.tagName, x: r.left + r.width / 2, y: r.top, t: e.innerText.trim() }; })()");
    let c = await find(); console.log("counter", JSON.stringify(c));
    await sleep(500); c = await find(); console.log("counter after scroll", JSON.stringify(c));
    const startY = c.y + 200;
    await touchSwipe(M, c.x + 110, startY, c.x - 110, startY); await sleep(1500);
    console.log("path", await M.path(), "text", (await M.text()).replace(/\s+/g, " ").slice(0, 200));
    console.log("after", JSON.stringify(await find()));
    await M.jshot("vlt-flip-390-after");
  } finally { await M.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
