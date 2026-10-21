const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const fails = rows.filter((r) => /^RB42-/.test(r.id) && r.result === "FAIL").map((r) => r.id);
console.log("superseding", fails.join(", "));
X.corr(fails, "these checks ran before the deployment had finished going live (RB42-001, 002, 004, 006 to 009), looked for the panel title in lower case when the page shows it in capitals (RB42-002, 007), or counted inline SVG when the site's themed icons are image files (RB42-014, 020, 024). Each is re-run with a passing result in RB42-026 to RB42-030.", "RB42-026..030");
process.exit(0);
