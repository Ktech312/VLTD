const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, controls } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    fs.writeFileSync(T.tmp("p.csv"), ["Name,Purchase Price,Current Value,Notes,Category", "AUD ADD I Alpha,10,20,n1,Comics", "AUD ADD I Beta,0,5,n2,Comics", "AUD ADD I Alpha,10,20,dup,Comics", ",3,4,noname,Cards", "AUD ADD I Neg,-5,1,neg,Cards"].join("\n"));
    await S.visit("/vault/import"); await sleep(2000);
    const r = await T.chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), T.tmp("p.csv")); console.log(JSON.stringify(r)); await sleep(4000);
    console.log((await T.text(S)).slice(0, 2600));
    console.log(JSON.stringify((await controls(S)).filter((c) => c.visible && !/^(Home|Vault|Exhibitions|Lounge|Discover|Messages|Alerts|Search|Help|Account menu|Report a bug|Install|Dismiss|VLTD Home)$/.test(c.label) && c.kind !== "link").map((c) => c.kind + ":" + c.label + (c.disabled ? "(d)" : "") + (c.pressed ? "[" + c.pressed + "]" : ""))));
    await S.jshot("probe-import-loaded", { full: true });
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
