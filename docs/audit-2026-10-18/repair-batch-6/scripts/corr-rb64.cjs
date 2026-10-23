// Corrections for the navigation checks (batch 19). Every failure in the first three runs was a mistake in the check, not in the app; the app passed the same checks in the final run (RB64-096 onward) and RB64-159 to 164.
const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(require(path.join(__dirname, "..", "..", "scripts", "audit-lib.cjs")).AUD + "/rows.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const has = (id) => rows.some((r) => r.id === id);
const keep = (ids) => ids.filter(has);
const g1 = keep(["RB64-001", "RB64-002", "RB64-003", "RB64-004"]);
if (g1.length) X.corr(g1, "the check read the highlighted item from both the top bar and the bottom bar (the bottom bar exists in the page but is hidden at desktop width), so Discover was counted twice. Each visible highlighted label is now counted once.", "RB64-096 onward");
const g2 = keep(["RB64-025", "RB64-026"]);
if (g2.length) X.corr(g2, "the test pressed Enter without the character a real keyboard sends with it, so the browser did not press the focused Browse button (Space, which does not need it, worked). The test now sends Enter as a keyboard does.", "RB64-096 onward");
const g3 = keep(["RB64-059", "RB64-060", "RB64-091", "RB64-092", "RB64-125", "RB64-126", "RB64-157", "RB64-158"]);
if (g3.length) X.corr(g3, "on a highlighted-event page the page scrolls the chosen event into view, which carries the header (and the Browse button) off the top of the screen, so the test pressed an empty spot. The follow-up check scrolls back up first, as a person would.", "RB64-162 to 164 (and the desktop pair before it)");
const g4 = keep(["RB64-093", "RB64-094", "RB64-095"]);
if (g4.length) X.corr(g4, "the Marketplace page holds too few listings for the test account to be taller than the screen, so there was nothing to scroll (and the still-open menu then covered the touch-area check). The scrolling checks now run on Discover, which is long.", "RB64-096 onward");
console.log("done"); process.exit(0);
