// ADD audit, suite 6b: /vault/import in a CLEAN browser (account has 31 items, this browser has none yet): recent list and duplicate protection.
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, admin, rec, click, clickText, text, rowsByTitle, allCount, removeItems, mine, chooseViaButton, tmp, poll } = T;
const tile = (t, label) => { const m = new RegExp(label + "\\s*\\n\\s*(\\d+)").exec(t); return m ? Number(m[1]) : null; };
(async () => {
  const P = man().personalId;
  const S = await session("owner", { width: 1440, height: 900 });
  const created = [];
  try {
    const total = await allCount(P);
    const title = "QA Album 1 - Original Motion Picture Soundtrack";
    const dupBefore = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P).eq("title", title)).count;
    fs.writeFileSync(tmp("if.csv"), `Name,Purchase Price\n${title},5\n`);
    await S.visit("/vault/import"); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 60000); await sleep(8000);
    const t0 = await S.text();
    const recent = (t0.match(/RECENT VAULT ITEMS[^]{0,80}/) || [""])[0].replace(/\n/g, " ");
    await rec(S, !/Vault is empty/.test(t0), { page: "/vault/import | owner, Personal, " + total + " items, clean second browser", control: "'Recent vault items' list", expected: "Lists the account's most recent items (or says they are still loading)", actual: `after 8 s the page says: '${recent.slice(0, 70)}' while the account has ${total} items (the list fills only after /vault has been opened once in this browser)`, impact: "misleading result", repro: "Sign in on a browser with no local data, open /vault/import directly" });
    await chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), tmp("if.csv")); await S.waitFor("/Parsed 1 item/.test(document.body.innerText)", 25000).catch(() => {}); await sleep(1000);
    const t1 = await S.text();
    await rec(S, tile(t1, "Vault Matches") === 1, { page: "/vault/import | owner, Personal, clean second browser", control: "Vault Matches tile for a row that already exists in the account", expected: "1 (the title is already in the account)", actual: `Vault Matches=${tile(t1, "Vault Matches")}; Likely Matches=${tile(t1, "Likely Matches")}`, impact: "misleading result", repro: "Fresh browser, /vault/import, upload a file with an existing item's name" });
    await click(S, "[...document.querySelectorAll('label')].find((l) => /Skip exact titles already in vault/.test(l.textContent))"); await sleep(400);
    for (let k = 0; k < 2; k++) { await click(S, "[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))"); await sleep(1800); }
    await sleep(15000);
    const dupAfter = (await admin.from("vault_items").select("id,profile_id,title,images_json,created_at", { count: "exact" }).eq("profile_id", P).eq("title", title));
    for (const r of dupAfter.data || []) if (!/^qa_vz_/.test(r.id) && Date.now() - Number(r.created_at || 0) < 3600000) created.push(r);
    await rec(S, dupAfter.count === dupBefore, { page: "/vault/import | owner, Personal, clean second browser", control: "Skip exact titles already in vault (option chosen)", expected: "The existing title is skipped: no second copy is created", actual: `copies of '${title.slice(0, 20)}...' before=${dupBefore}, after=${dupAfter.count}`, impact: "data loss", repro: "Fresh browser, /vault/import, choose 'Skip exact titles already in vault', import a row whose title already exists" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-importfresh-error"); } catch {} }
  finally { await S.close(); await removeItems(created); const left = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count; console.log("fixture items now", left, "(26 owned + 5 sold = 31 expected)"); }
})();
