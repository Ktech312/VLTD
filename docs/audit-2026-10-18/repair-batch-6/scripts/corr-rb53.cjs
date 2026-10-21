const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const ids = rows.filter((r) => /^RB53-/.test(r.id) && r.result === "FAIL").map((r) => r.id);
console.log("superseding", ids.join(", "));
if (ids.length) X.corr(ids, "the photo WAS discarded (the picture elements went from 2 to 0 on Cancel, and from 2 to 1 on Escape with a second photo) but the check also looked for a status line, and the Add page only shows status lines for problems. The change then added a visible toast ('That picture was discarded...'), and the checks are re-run with a passing result in RB53-014 and RB53-016.", "RB53-014, RB53-016");
process.exit(0);
