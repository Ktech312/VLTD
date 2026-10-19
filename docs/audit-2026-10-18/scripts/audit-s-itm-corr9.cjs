const X = require("./audit-s-itm-lib.cjs");
X.corr(["ITM-489"], "the CovrPrice link deliberately has no search in its address (it copies the title instead); the check wrongly required every link to contain the title. Four links checked: all open in a new tab with noopener.", "ITM-489 repeated in the phone run");
