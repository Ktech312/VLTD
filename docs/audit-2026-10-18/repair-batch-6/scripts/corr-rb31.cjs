const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const ids = rows.filter((r) => /^RB31-0(0[1-9]|1\d|2\d)$/.test(r.id) && r.result === "FAIL").map((r) => r.id);
console.log("superseding", ids.join(", "));
X.corr(ids, "the check looked for the goal rows by the words 'Next Action' and for headings by 'Items In Goal' / 'Completed Goals', but the page shows them in capitals (CSS), so the rows and headings were not found (the page itself showed the goals correctly: 'ITEMS IN GOAL (8)', 'COMPLETED GOALS'). One of these runs also pressed Delete on whichever goal was selected, which removed two of the QA fixture's own goals (fixture data only; nothing real).", "RB31-030 to RB31-037");
process.exit(0);
