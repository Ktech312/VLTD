const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const ids = rows.filter((r) => /^RB43-/.test(r.id) && r.result === "FAIL").map((r) => r.id);
const nt = rows.filter((r) => /^RB47-001$/.test(r.id)).map((r) => r.id);
console.log("superseding", ids.join(", "), "|", nt.join(", "));
X.corr(ids, "these checks ran before the deployment containing the change had finished going live, or (RB43-017, 022 and the like) found one developer phrase ('Needs lounge_posts') that the first change missed and the next commit removed. Each is re-run with a passing result in RB43-026 to RB43-030.", "RB43-026..030");
X.corr(nt, "the first run looked for the menu heading 'Switch Profile' in mixed case; the page shows it in capitals, so the list was not found and the case was recorded NOT TESTED. Re-run with a passing result in RB47-005.", "RB47-005");
process.exit(0);
