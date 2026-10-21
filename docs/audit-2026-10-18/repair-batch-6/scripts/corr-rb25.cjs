const path = require("path");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
X.corr(["RB25-001", "RB25-003", "RB25-004"], "the test opened the subject board as a signed-out visitor (the page sends visitors to the login screen) and the QA collector's profile was not public, so the database function returned no row.", "RB25-006, RB25-008, RB25-009");
process.exit(0);
