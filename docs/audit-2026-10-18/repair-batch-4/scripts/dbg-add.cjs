const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { session, sleep, click, typeInto, fieldInput, btnExpr, text } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000, "f"); await sleep(3000);
    await typeInto(S, "document.getElementById('scan-title')", "QA RB9 dbg");
    for (const v of ["1e3", "abc", "1,5"]) {
      const a = await typeInto(S, fieldInput("Purchase Price"), v), b = await typeInto(S, fieldInput("Current Value"), v);
      const info = await S.evaluate(`(() => { const a = (${fieldInput("Purchase Price")}), b = (${fieldInput("Current Value")}); return { pType: a && a.type, pVal: a && a.value, cVal: b && b.value }; })()`);
      await click(S, btnExpr("^Save$|^Saving")); await sleep(1500);
      const t = await text(S);
      const i = t.search(/numbers only|not a number|negative|enter an amount|decimal/i);
      console.log(v, "typed", a, b, JSON.stringify(info), "| msg:", i >= 0 ? t.slice(Math.max(0, i - 60), i + 140) : "NONE");
      console.log("alerts:", JSON.stringify(await S.evaluate(`[...document.querySelectorAll('[role=alert],[role=status]')].map((a) => a.textContent.trim().slice(0, 100))`)));
    }
  } finally { await S.close(); process.exit(0); }
})();
