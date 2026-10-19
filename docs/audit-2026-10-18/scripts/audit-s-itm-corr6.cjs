const X = require("./audit-s-itm-lib.cjs");
X.corr(["ITM-370", "ITM-375"], "the failed-save message check used a loose regular expression that also matched unrelated page text ('try again'), so ITM-370 passed without evidence; ITM-375 is a script error reading <h1> while the title editor was open.", "the rerun of audit-s-itm-net.cjs");
