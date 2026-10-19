// ADD audit, suite 6c: /vault/import in a CLEAN browser: does 'Skip exact titles already in vault' protect against a second copy (60 s watch, with the page's own message)?
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, admin, rec, click, text, removeItems, chooseViaButton, tmp, poll } = T;
(async () => {
  const P = man().personalId;
  const S = await session("owner", { width: 1440, height: 900 });
  const created = [];
  try {
    const title = "QA Album 2 - Original Motion Picture Soundtrack";
    const countOf = async () => (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P).eq("title", title)).count;
    const dupBefore = await countOf();
    fs.writeFileSync(tmp("if2.csv"), `Name,Purchase Price,Notes\n${title},5,n\n`);
    await S.visit("/vault/import"); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 60000); await sleep(3000);
    await chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), tmp("if2.csv")); await S.waitFor("/Parsed 1 item/.test(document.body.innerText)", 25000).catch(() => {}); await sleep(1000);
    await click(S, "[...document.querySelectorAll('label')].find((l) => /Skip exact titles already in vault/.test(l.textContent))"); await sleep(400);
    for (let k = 0; k < 2; k++) { await click(S, "[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))"); await sleep(1800); }
    await sleep(3000);
    const said = ((await S.text()).match(/(Imported|Skipped|Nothing)[^\n]*/) || [""])[0];
    await poll(async () => (await countOf()) > dupBefore, 60000, 4000);
    const after = await admin.from("vault_items").select("id,profile_id,title,images_json,created_at", { count: "exact" }).eq("profile_id", P).eq("title", title);
    for (const r of after.data || []) if (!/^qa_vz_/.test(r.id)) created.push(r);
    await rec(S, after.count === dupBefore, { page: "/vault/import | owner, Personal, clean second browser", control: "Skip exact titles already in vault (option chosen; item already in the account)", expected: "The existing title is skipped: no second copy is created", actual: `page message: '${said.slice(0, 140)}'; copies of the title in the account before=${dupBefore}, 60 s later=${after.count}`, impact: "data loss", repro: "Fresh browser, open /vault/import directly, choose 'Skip exact titles already in vault', import a row whose title already exists, wait" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-importfresh2-error"); } catch {} }
  finally { await S.close(); await removeItems(created); }
})();
