const path = require("path");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
X.corr(["RB32-006"], "this check ran before the deployment containing the fix had finished going live (the same check passed on the next run).", "RB32-009");
X.corr(["RB33-001", "RB33-002", "RB33-003"], "the first run chose the wrong 'Search' button (the top bar's) on the Upcoming page, and it ran before the Watchlist fix had finished going live. Re-run result in RB33-004 to RB33-006.", "RB33-004 to RB33-006");
process.exit(0);
