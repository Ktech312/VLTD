const path = require("path");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
X.corr(["RB37-002"], "the expected order left out items with an explicit $0 value and a recorded cost, which the one gain rule DOES measure (a loss of what was paid): 'QA Album 10' (value $0, cost $15) is correctly first.", "RB37-011");
X.corr(["RB37-006", "RB37-008", "RB37-009"], "the checks opened the invite page as a signed-out visitor (invite pages need a signed-in account), typed into the top bar's search box instead of the Kickstarter search box, and clicked the wrong element to open the conversation.", "RB37-015, RB37-017, RB37-018");
process.exit(0);
