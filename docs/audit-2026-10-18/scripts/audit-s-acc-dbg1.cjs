const A = require("./audit-s-acc-lib.cjs");
(async () => {
  const S = await A.session("visitor", { width: 1440, height: 900 });
  try {
    await S.visit("/login");
    const expr = A.byText("Forgot password\\?", "a");
    const r1 = await S.evaluate(A.RECT_JS(expr)); console.log("rect", r1);
    const hit = await S.evaluate(`(() => { const e = document.elementFromPoint(${r1.x}, ${r1.y}); return e ? e.tagName + '|' + (e.innerText||'').slice(0,40) + '|' + (e.closest('a')?.getAttribute('href')) : null; })()`); console.log("hit", hit);
    await A.mouseClick(S, r1.x, r1.y);
    for (let i = 0; i < 6; i++) { await A.sleep(1000); console.log(i, await S.path()); }
  } finally { await S.close(); }
})();
