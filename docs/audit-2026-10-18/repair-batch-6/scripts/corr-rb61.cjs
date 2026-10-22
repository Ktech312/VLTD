// Corrections for the visual-banner production checks (batch 18). RB61-007 and RB61-030 (the first design's switch sat 32px in from the banner's right edge) are a REAL
// finding about the first design and are NOT superseded: the control was then redone as the small clickable line, which passes the same check.
const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(require(path.join(__dirname, "..", "..", "scripts", "audit-lib.cjs")).AUD + "/rows.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const has = (id) => rows.some((r) => r.id === id);
const all = (ids) => ids.every(has);
if (all(["RB61-019", "RB61-042", "RB61-064", "RB61-087"])) X.corr(["RB61-019", "RB61-042", "RB61-064", "RB61-087"], "the check compared the page address with '/', but the signed-in Home is /dashboard, so a banner that correctly stayed on Home read as failing. The check now compares with Home's own address.", "RB61-109, RB61-129");
if (all(["RB61-043", "RB61-088"])) X.corr(["RB61-043", "RB61-088"], "same address mistake as above (the slide really was unchanged); the check now compares with Home's own address.", "RB61-130");
if (all(["RB61-044", "RB61-089"])) X.corr(["RB61-044", "RB61-089"], "the check read the window's scroll position, but the app scrolls inside its content container (.vltd-content-wrap), so it always read 0. A separate probe of that container showed the page scrolling 508 px from a drag beside the banner and 454 px from a drag that started on it; the check now reads the container.", "RB61-131 (scroll 0 to 406 from a drag on the banner)");
console.log("done");
process.exit(0);
