const path = require("path");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
X.corr(["RB28-009"], "the test counted every image inside the thumbnails, including 32px icons, and the page still held a photo from the previous check, so its comparison of the first two widths was wrong (the printed widths show the first two thumbnails did swap).", "RB28-021");
X.corr(["RB28-012"], "the first run did not show the message; the card's button was not waited for before the click (a debug run with a longer wait showed the message). Cause not isolated further; a race in the test, not reproduced as an app defect.", "RB28-024");
process.exit(0);
