const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { session, sleep } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    fs.writeFileSync(T.tmp("p13.csv"), ["Name,Purchase Price,Current Value,Notes,Category", "AUD ADD I Alpha,10,20,x,Comics", ",3,4,no name,Cards", "AUD ADD I Neg,-5,1,neg,Cards", "AUD ADD I Word,abc,xyz,n,Cards"].join("\n"));
    await S.visit("/vault/import"); await sleep(1500);
    await T.chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), T.tmp("p13.csv")); await sleep(4000);
    const t = await S.text();
    const i = t.indexOf("IGNORED ROWS"); console.log(i >= 0 ? t.slice(i, i + 900) : "no 'IGNORED ROWS' panel text; first 1600:\n" + t.slice(0, 1600));
    await S.jshot("probe-import-ignored", { full: true });
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
