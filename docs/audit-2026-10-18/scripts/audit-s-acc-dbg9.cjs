const A = require("./audit-s-acc-lib.cjs");
(async () => {
  const S = await A.session("owner", { width: 390, height: 844, mobile: true });
  try {
    await S.visit("/account"); await A.sleep(2500);
    console.log("path", await S.path(), (await A.bodyText(S)).slice(0, 200));
    await A.typeInto(S, 'main input[placeholder="Display name"]', "Phone Name Test");
    console.log("value", await S.evaluate("document.querySelector('main input[placeholder=\"Display name\"]').value"));
    const expr = A.byText("^Save changes$", "main button,main a");
    const r = await S.evaluate(A.RECT_JS(expr)); console.log("rect", r);
    await A.sleep(600);
    const r2 = await S.evaluate(A.RECT_JS(expr)); console.log("rect2", r2);
    const hit = await S.evaluate(`(() => { const e = document.elementFromPoint(${r2.x}, ${r2.y}); return e ? e.tagName + '|' + (e.innerText || e.getAttribute('aria-label') || '').slice(0, 40) + '|' + e.className.toString().slice(0, 60) : null; })()`);
    console.log("hit", hit, "viewport h", await S.evaluate("innerHeight"));
    await S.jshot("acc-dbg9-save-phone");
    await A.touchTap(S, r2.x, r2.y); await A.sleep(2500);
    console.log("text after tap", (await A.bodyText(S)).match(/Account updated|Failed[^.]*/)?.[0]);
  } finally { await S.close(); }
})();
