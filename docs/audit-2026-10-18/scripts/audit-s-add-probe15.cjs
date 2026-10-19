const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, click, admin, man } = T;
(async () => {
  const P = man().personalId;
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const title = "QA Album 3 - Original Motion Picture Soundtrack";
    fs.writeFileSync(T.tmp("if3.csv"), `Name,Purchase Price\n${title},5\n`);
    await S.visit("/vault/import"); await sleep(3000);
    const step = async (tag) => { const t = (await S.text()).replace(/\n+/g, " | "); console.log(tag, "::", (t.match(/(Parsed|Nothing|No importable|Imported|Review the import|Skipped)[^|]*/g) || []).join(" // "), "| ready:", (t.match(/Items Ready \| (\d+)/) || [])[1]); };
    await T.chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), T.tmp("if3.csv")); await sleep(12000); await step("after upload 12s"); console.log((await S.text()).split("\n").join(" | ").slice(0, 900));
    const toggles = await S.evaluate("[...document.querySelectorAll('label')].filter((l) => /Skip exact|Import all/.test(l.textContent)).map((l) => l.textContent.trim() + ' checked=' + (l.querySelector('input') && l.querySelector('input').checked))");
    console.log("toggles:", JSON.stringify(toggles));
    await click(S, "[...document.querySelectorAll('label')].find((l) => /Skip exact titles already in vault/.test(l.textContent))"); await sleep(800); await step("after toggle");
    console.log("toggles:", JSON.stringify(await S.evaluate("[...document.querySelectorAll('label')].filter((l) => /Skip exact|Import all/.test(l.textContent)).map((l) => l.textContent.trim().slice(0, 30) + ' checked=' + (l.querySelector('input') && l.querySelector('input').checked))")));
    await click(S, "[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))"); await sleep(1800); await step("after confirm 1");
    await click(S, "[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))"); await sleep(3500); await step("after confirm 2");
    await S.jshot("probe-importfresh");
    const c = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P).eq("title", title)).count; console.log("copies in account now:", c);
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
