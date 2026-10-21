const path = require("path"); const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { session, sleep, chooseViaButton, text, tmp } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  await S.visit("/vault/import"); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 60000); await sleep(1500);
  fs.writeFileSync(tmp("dbg-empty.csv"), "");
  const r = await chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), tmp("dbg-empty.csv")); console.log(JSON.stringify(r));
  await sleep(5000);
  const t = await text(S); const i = t.indexOf("Upload Spreadsheet"); console.log(t.slice(Math.max(0, i - 200), i + 900));
  console.log("consoleErrors", JSON.stringify(S.consoleErrors.slice(0, 5)));
  await S.close(); process.exit(0);
})();
