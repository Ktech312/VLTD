const path = require("path"); const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { session, sleep, clickText, chooseViaButton, mkPng, tmp, text, pickSelect } = T;
(async () => {
  const B = await session("owner", { width: 1440, height: 900 });
  await B.visit("/vault/bulk"); await B.waitFor("document.querySelectorAll('select').length >= 1", 60000); await sleep(3000);
  mkPng(tmp("dbg-a.png"), 300, 300, [10, 100, 200]);
  await chooseViaButton(B, T.btnExpr("Choose photos"), tmp("dbg-a.png")); await sleep(1500);
  await pickSelect(B, "document.querySelectorAll('select')[0]", "Music"); await sleep(400);
  const cats = await B.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim()).filter((x) => x && !/Select/.test(x))"); await pickSelect(B, "document.querySelectorAll('select')[1]", cats[0]);
  console.log("skip click", JSON.stringify(await clickText(B, "Skip — I.ll fill in by hand"))); await sleep(2500);
  console.log("buttons", JSON.stringify(await B.evaluate("[...document.querySelectorAll('button')].map((b) => (b.innerText||'').trim().slice(0,30) + (b.disabled ? ' [disabled]' : '')).filter(Boolean)")));
  console.log("click scan", JSON.stringify(await clickText(B, "^Scan with AI$"))); await sleep(3500);
  const t = await text(B); console.log(t.slice(-700));
  await B.close(); process.exit(0);
})();
