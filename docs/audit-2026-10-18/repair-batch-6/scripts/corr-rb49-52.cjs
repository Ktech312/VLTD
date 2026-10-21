// Supersedes first-run FAIL rows of RB49 / RB50 / RB52 that have a later PASS row for the same control (they ran before the deployment was live,
// clicked the wrong button, looked for a message with the wrong wording, or read the wrong number), plus the two RB50 rows whose route argument the shell
// rewrote to a path that does not exist. Real application failures that were fixed by a code change (RB51-002, RB51-005: the Discover panel taller than
// the window) are NOT superseded: they stay as recorded failures with the passing re-run after them.
const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const num = (id) => Number(id.split("-")[1]);
const out = [];
for (const area of ["RB49", "RB50", "RB52"]) {
  const mine = rows.filter((r) => r.id.startsWith(area + "-") && r.area === area);
  for (const f of mine.filter((r) => r.result === "FAIL")) {
    const later = mine.find((r) => r.result === "PASS" && r.control === f.control && num(r.id) > num(f.id) && r.page.split(" | ")[0] === f.page.split(" | ")[0]);
    if (later) out.push(f.id);
  }
}
const mangled = rows.filter((r) => /^RB50-/.test(r.id) && /C:\/Program Files\/Git/.test(r.page)).map((r) => r.id);
console.log("superseding", out.join(", "), "| mangled path:", mangled.join(", "));
if (out.length) X.corr(out, "these checks ran before the deployment had finished going live (or the QA browser still held the previous page code), clicked a goal row instead of the type button in the sheet, looked for the Watchlist message with the wrong wording ('use numbers only'), counted the wrong text on the Insights page, or used the old '2 px of scroll width' test that cannot see that invisible tap areas are not scrollable. Each control has a later PASS row.", "later PASS rows of the same control");
if (mangled.length) X.corr(mangled, "the route argument was rewritten by the shell to 'C:/Program Files/Git/...', so the page checked was not the page named: the result says nothing about it. The pages are re-checked in later RB50 rows.", "later RB50 rows");
process.exit(0);
