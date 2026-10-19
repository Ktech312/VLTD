// fresh browser (no local vault yet): does /vault/import know the account's existing items (recent list, duplicate detection)?
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { session, sleep } = T;
const tile = (t, label) => { const m = new RegExp(label + "\\s*\\n\\s*(\\d+)").exec(t); return m ? Number(m[1]) : null; };
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    fs.writeFileSync(T.tmp("p14.csv"), ["Name,Purchase Price", "QA Album 1 - Original Motion Picture Soundtrack,5"].join("\n"));
    const snap = async (tag) => { const t = await S.text(); console.log(tag, "| recent:", (t.match(/RECENT VAULT ITEMS[^]{0,120}/) || ["-"])[0].replace(/\n/g, " ").slice(0, 110)); };
    await S.visit("/vault/import"); await snap("t=0 (page settled)");
    await T.chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), T.tmp("p14.csv")); await sleep(3000);
    let t = await S.text(); console.log("t~4s: Vault Matches =", tile(t, "Vault Matches"), "Likely =", tile(t, "Likely Matches")); await snap("t~4s");
    await sleep(15000); await snap("t~20s");
    // re-parse after waiting
    await T.chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), T.tmp("p14b.csv") && (fs.writeFileSync(T.tmp("p14b.csv"), fs.readFileSync(T.tmp("p14.csv"))), T.tmp("p14b.csv"))); await sleep(3000);
    t = await S.text(); console.log("t~25s re-upload: Vault Matches =", tile(t, "Vault Matches"), "Likely =", tile(t, "Likely Matches"));
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(2000);
    await S.visit("/vault/import"); await snap("after visiting /vault first");
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
