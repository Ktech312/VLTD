const X = require("./audit-s-itm-lib.cjs");
X.corr(["ITM-413"], "the first run clicked a label that did not match (the button text includes a second line); the sheet opened fine in the rerun (ITM-416).", "ITM-416");
X.corr(["ITM-604"], "the 39 px title links are just under the 40 px test line; recorded as an improvement note (ITM-713), not a failure.", "ITM-713");
X.rr.nt({ page: "/share/[itemId] | signed out", control: "Save Card file name", expected: "Improvement note: the download is named .jpg but the card image served by /api/og is a PNG (content-type image/png)", actual: "download name vltd-<title>.jpg; og image content-type image/png (ITM-723, ITM-727)", impact: "cosmetic", repro: "Click Save Card; compare with the og:image content type" });
