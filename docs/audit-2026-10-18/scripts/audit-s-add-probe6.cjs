const T = require("./audit-s-add-lib.cjs");
const { session, sleep } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/capture");
    await T.uploadFiles(S, "input[type=file]", T.tmp("notes.txt"), 0); await sleep(3000);
    console.log("thumbs", await S.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"]').length"), "imgs", JSON.stringify(await S.evaluate("[...document.querySelectorAll('img')].filter(i => /^blob:/.test(i.src)).map(i => ({ nw: i.naturalWidth, complete: i.complete }))")));
    await S.jshot("probe-txt-chosen");
    await T.typeInto(S, "document.getElementById('capture-item-name')", "AUD ADD ProbeTxt");
    await T.click(S, T.btnExpr("^Save to Vault$")); await sleep(9000);
    console.log("path", await S.path(), "alert:", await T.alertText(S));
    console.log((await T.text(S)).slice(0, 300));
    await S.jshot("probe-txt-saved");
    console.log("rows", (await T.rowsByTitle(T.man().personalId, "AUD ADD ProbeTxt")).length);
    console.log("errs", JSON.stringify(S.consoleErrors.slice(0, 5)));
  } finally { await S.close(); await T.removeByPrefix("AUD ADD ProbeTxt"); }
})().catch((e) => { console.error(e); process.exit(2); });
