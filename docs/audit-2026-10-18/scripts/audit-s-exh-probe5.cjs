const X = require("./audit-s-exh-lib.cjs");
const { session, sleep, mclick, byLabel, byLabelRe, gdb } = X;
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
(async () => {
  const S = await session("owner");
  try {
    await S.visit("/museum/" + ex.A); await sleep(7000);
    console.log("click organize", await mclick(S, byLabel("Organize"), { wait: 1000 }));
    console.log("dialog", await S.evaluate(`!!document.querySelector('[role=dialog]')`));
    console.log("btns", await S.evaluate(`[...document.querySelectorAll('[role=dialog] button')].map(b => b.textContent.trim() + (b.disabled ? '(disabled)' : ''))`));
    const r = await X.rectOf(S, byLabelRe("Create first exhibit"));
    console.log("rect", JSON.stringify(r), await S.evaluate(`(() => { const el = ${byLabelRe("Create first exhibit")}; return el ? el.tagName + ':' + el.textContent.trim().slice(0,40) : null; })()`));
    console.log("click create", await mclick(S, byLabelRe("Create first exhibit"), { wait: 4000 }));
    console.log("sections", JSON.stringify(((await gdb(ex.A)).layout.sections || []).length));
    console.log(await S.evaluate(`[...document.querySelectorAll('main button')].map(b => b.textContent.trim()).filter(t => /Done|Organize|Exhibit/.test(t))`));
    console.log((await S.text()).replace(/\s+/g, " ").slice(-300));
  } finally { await S.close(); }
})();
