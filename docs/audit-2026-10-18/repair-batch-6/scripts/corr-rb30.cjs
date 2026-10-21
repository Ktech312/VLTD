const path = require("path");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
X.corr(["RB30-001", "RB30-002", "RB30-003", "RB30-005", "RB30-006", "RB30-007", "RB30-008", "RB30-009"], "the check looked after 18 seconds, but these pages wait up to 20 seconds for the data service before saying they could not load (so the page was still on its wait note, never on an empty claim: 'empty claim shown=false' in every one of those rows). The re-run waits long enough.", "RB30-021 to RB30-029");
process.exit(0);
