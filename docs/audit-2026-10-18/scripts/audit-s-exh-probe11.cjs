const X = require("./audit-s-exh-lib.cjs");
const { session, sleep, byLabelRe } = X;
(async () => {
  const S = await session("owner", { width: 390, height: 844, mobile: true });
  try {
    await S.visit("/vault"); await sleep(6000); await S.visit("/museum"); await sleep(4500);
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await S.evaluate(`window.__ev = []; ['touchstart','touchend','pointerdown','pointerup','click'].forEach(t => document.addEventListener(t, e => window.__ev.push(t + ':' + (e.target.getAttribute && (e.target.getAttribute('aria-label') || e.target.tagName))), true)); true`);
    const expr = byLabelRe("Show details for Movie Posters");
    const r = await X.rectOf(S, expr); await sleep(800); const r2 = await X.rectOf(S, expr, false);
    console.log("rect", JSON.stringify(r), JSON.stringify(r2), "scrollY", await S.evaluate("scrollY"));
    await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r2.x, y: r2.y, id: 1 }] });
    await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(900);
    console.log("events", JSON.stringify(await S.evaluate("window.__ev")));
    console.log("title", await S.evaluate(`(document.querySelector('aside h2')||{}).textContent`));
    console.log("hit", await S.evaluate(`(() => { const e = document.elementFromPoint(${r2.x}, ${r2.y}); return e ? e.tagName + ':' + (e.getAttribute('aria-label') || e.className.toString().slice(0, 40)) : null; })()`));
  } finally { await S.close(); }
})();
