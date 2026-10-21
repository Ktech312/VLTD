const path = require("path");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
X.corr(["RB34-001", "RB34-002", "RB34-003"], "this run started before the deployment containing the fix had finished going live (the same checks passed on the next run, RB34-009 to RB34-011).", "RB34-009 to RB34-011");
process.exit(0);
