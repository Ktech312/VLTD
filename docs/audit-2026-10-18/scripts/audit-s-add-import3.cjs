// ADD audit, suite 6e: import values that are hard (the first run's check never found the rows), and an empty file's message.
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, admin, rec, click, text, rowsByTitle, removeItems, mine, chooseViaButton, tmp, poll } = T;
const PREFIX = "AUD ADD H ";
const tile = (t, label) => { const m = new RegExp(label + "\\s*\\n\\s*(\\d+)").exec(t); return m ? Number(m[1]) : null; };
const confirmTwice = async (S) => { for (let k = 0; k < 2; k++) { await click(S, "[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))"); await sleep(1800); } await sleep(3000); };
(async () => {
  const P = man().personalId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const f = tmp("h.csv");
    fs.writeFileSync(f, ["Name,Purchase Price,Current Value,Notes", `${PREFIX}Currency,"$1,234.50","$2,000",n`, `${PREFIX}Letters,abc,xyz,n`, `${PREFIX}Huge,1e12,99999999999999999999,n`, `${PREFIX}Paren,(7.50),2,n`, `${PREFIX}Euro,"1,5","2,5",n`, `${PREFIX}Zero,0,0,n`].join("\n"));
    await S.visit("/vault/import"); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 60000); await sleep(1500);
    await chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), f); await S.waitFor("/Parsed \\d+ items|I couldn.t find|No importable/.test(document.body.innerText)", 25000).catch(() => {}); await sleep(1200);
    const t = await S.text();
    console.log("preview:", (t.match(/Parsed[^\n]*/) || [""])[0], "| ready", tile(t, "Items Ready"), "ignored", tile(t, "Ignored Rows"), "needs a look", tile(t, "Needs a look"));
    await confirmTwice(S);
    const rows = await poll(async () => { const r = await rowsByTitle(P, PREFIX); return r.length >= 5 ? r : null; }, 90000, 4000) || await rowsByTitle(P, PREFIX);
    const g = (n) => rows.find((r) => r.title === PREFIX + n);
    const out = Object.fromEntries(["Currency", "Letters", "Huge", "Paren", "Euro", "Zero"].map((n) => [n, g(n) ? [g(n).purchase_price, g(n).current_value] : "not imported"]));
    console.log(JSON.stringify(out));
    await rec(S, g("Currency") && Number(g("Currency").purchase_price) === 1234.5 && Number(g("Currency").current_value) === 2000, { page: "/vault/import | owner, Personal", control: "Quoted currency text in a CSV ('$1,234.50', '$2,000')", expected: "1234.5 and 2000", actual: JSON.stringify(out.Currency), impact: "misleading result", repro: "Import a CSV with quoted currency cells" });
    await rec(S, !g("Letters") || (g("Letters").purchase_price === null && g("Letters").current_value === null), { page: "/vault/import | owner, Personal", control: "Letters in the money columns ('abc', 'xyz')", expected: "Not turned into numbers (blank/unknown or flagged)", actual: JSON.stringify(out.Letters) + "; summary said needs-a-look=" + tile(t, "Needs a look"), impact: "misleading result", repro: "Import a CSV with abc in the price" });
    await rec(S, !g("Paren"), { page: "/vault/import | owner, Personal", control: "'(7.50)' as a cost", expected: "Held back as a negative cost", actual: g("Paren") ? "IMPORTED " + JSON.stringify(out.Paren) : "held back", impact: "misleading result", repro: "Import a row with (7.50)" });
    await rec(S, !g("Euro") || (Number(g("Euro").purchase_price) === 1.5 && Number(g("Euro").current_value) === 2.5), { page: "/vault/import | owner, Personal", control: "European decimal comma in a quoted cell ('1,5', '2,5')", expected: "Read as 1.5 and 2.5, or flagged - never 15 and 25", actual: JSON.stringify(out.Euro), impact: "misleading result", repro: "Import a row with \"1,5\" as the price" });
    await rec(S, g("Zero") && g("Zero").purchase_price === 0 && g("Zero").current_value === 0, { page: "/vault/import | owner, Personal", control: "Explicit 0 in both money columns", expected: "0 and 0 kept", actual: JSON.stringify(out.Zero), impact: "misleading result", repro: "Import a row with 0 / 0" });
    await rec(S, !g("Huge") || (Number(g("Huge").purchase_price) === 1e12 && Number(g("Huge").current_value) === 1e20), { page: "/vault/import | owner, Personal", control: "Huge numbers (1e12 and 99999999999999999999)", expected: "Kept as typed or flagged - not silently changed", actual: JSON.stringify(out.Huge), impact: "misleading result", repro: "Import a row with 1e12" });
    // empty file message
    fs.writeFileSync(tmp("h-empty.csv"), "");
    await S.visit("/vault/import"); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 60000); await sleep(1200);
    const before = ((await S.text()).match(/Nothing parsed yet\.?/) || [""])[0];
    await chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), tmp("h-empty.csv")); await sleep(4000);
    const after = (await S.text()).split("\n").filter((l) => /parsed|empty|importable|couldn|rows/i.test(l)).slice(0, 3).join(" | ");
    await rec(S, !/^Nothing parsed yet\.?$/.test(after.trim()) , { page: "/vault/import | owner, Personal", control: "Upload Spreadsheet (empty 0-byte file) - corrects ADD-259", expected: "The page says the file was empty (different from the state before any upload)", actual: `before any upload the page says '${before}'; after choosing the empty file it says '${after}'`, impact: "usability", repro: "Upload an empty .csv" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-import3-error"); } catch {} }
  finally { await S.close(); await T.removeByPrefix(PREFIX); for (const p of mine()) console.log("leftover AUD ADD H rows", (await rowsByTitle(p, PREFIX)).length); }
})();
