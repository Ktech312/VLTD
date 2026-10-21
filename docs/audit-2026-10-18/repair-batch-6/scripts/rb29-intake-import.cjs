// RC-16 rows that earlier batches already addressed in code but never re-checked: Bulk intake of non-photo files (ADD-394, ADD-395) and the empty import file (ADD-474).
// Production, isolated QA owner; nothing is saved.
//   AUDIT_MANIFEST=<manifest> node rb29-intake-import.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { session, sleep, chooseViaButton, mkPng, tmp, text } = T;
const LABEL = process.argv[2] || "run";
const r = T.R("RB29");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(T.AUD, await S.jshot(`rb29-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(T.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-16", repro: "" });
}
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    fs.writeFileSync(tmp("rb29-notes.txt"), "not an image\n");
    fs.writeFileSync(tmp("rb29-empty.csv"), "");
    mkPng(tmp("rb29-a.png"), 300, 300, [10, 100, 200]);
    const photos = () => S.evaluate("document.querySelectorAll('img[src^=\"blob:\"]').length");
    const openBulk = async () => { await S.visit("/vault/bulk"); await S.waitFor("document.querySelectorAll('select').length >= 1", 60000); await sleep(2500); };
    await openBulk();
    await chooseViaButton(S, T.btnExpr("Choose photos"), tmp("rb29-notes.txt")); await sleep(2000);
    let t = await text(S);
    await rec(S, (await photos()) === 0 && /not a photo/i.test(t), "/vault/bulk: choose only a .txt file", "refused with a message that it is not a photo; nothing added", `photos=${await photos()}; message=${JSON.stringify((t.match(/[^.]*not a photo[^.]*\./i) || [""])[0].slice(0, 160))}`, "/vault/bulk");
    await openBulk();
    await chooseViaButton(S, T.btnExpr("Choose photos"), [tmp("rb29-a.png"), tmp("rb29-notes.txt")]); await sleep(2500);
    t = await text(S);
    await rec(S, (await photos()) === 1 && /rb29-notes\.txt/.test(t) && /not a photo/i.test(t), "/vault/bulk: choose one photo and one .txt together", "the photo is added and the text file is reported as left out by name", `photos=${await photos()}; names the file=${/rb29-notes\.txt/.test(t)}`, "/vault/bulk");
    await S.visit("/vault/import"); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 60000); await sleep(1500);
    await chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), tmp("rb29-empty.csv")); await sleep(3500);
    t = await text(S);
    await rec(S, /That file is empty/i.test(t), "/vault/import: upload an empty (0-byte) file", "the page says the file was empty", `message=${JSON.stringify((t.match(/That file is empty[^.]*\./) || [""])[0])}`, "/vault/import");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb29-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 400));
    process.exit(0);
  }
})();
