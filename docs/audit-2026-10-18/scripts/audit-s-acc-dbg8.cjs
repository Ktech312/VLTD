const A = require("./audit-s-acc-lib.cjs");
(async () => {
  const S = await A.session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/activity"); await A.sleep(2500);
    const panel = () => S.evaluate("(() => { const a = document.querySelector('aside'); return a ? a.innerText.replace(/\\s+/g, ' ').slice(0, 110) : null; })()");
    console.log("initial", await panel());
    for (const n of [3, 5, 9]) {
      const ok = await A.clickExpr(S, `[...document.querySelectorAll('main button')].find((b) => new RegExp('QA Album ${n} - ').test(b.innerText))`, {});
      await A.sleep(900);
      console.log("click row", n, ok, "->", await panel());
    }
    await S.jshot("acc-dbg8-activity");
    await A.clickExpr(S, "[...document.querySelectorAll('aside button')].find((b) => (b.getAttribute('aria-label') || '') === 'Close')", {}); await A.sleep(900);
    console.log("after close", await panel());
    const rows = await S.evaluate("[...document.querySelectorAll('main button')].filter((b)=>/Added to inventory/.test(b.innerText)).slice(0,4).map((b)=>b.innerText.replace(/\\s+/g,' ').slice(0,60)+' sel='+(b.getAttribute('aria-pressed')||b.getAttribute('aria-current')||b.className.includes('ring')))");
    console.log(rows);
  } finally { await S.close(); }
})();
