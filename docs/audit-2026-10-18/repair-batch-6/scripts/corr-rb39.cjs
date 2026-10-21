const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const fails = rows.filter((r) => /^RB(39|40|41)-/.test(r.id) && r.result === "FAIL").map((r) => r.id);
console.log("superseding", fails.join(", "));
X.corr(fails, "these checks ran before the deployment containing the change had finished going live (the Insights links, the empty universe page), looked for a message with the wrong wording (the money rule says 'use numbers only'), clicked the wrong button, or were disturbed by a sort order a previous run had saved in the test browser. Each is re-run with a passing result in RB39-016 to RB39-030, RB40-005, RB40-006 and RB41-011 to RB41-016.", "RB39-016..030, RB40-005, RB40-006, RB41-011..016");
process.exit(0);
