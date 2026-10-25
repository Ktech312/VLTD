// Corrections for the earlier post-SQL Wishlist runs (RB68 on QA accounts wsh2 and wsh3, RB67-240 on wsh2). The clean final run (QA account wsh4, rows RB68-078 onward, 39 of 39) replaces them.
// Rows 002-036 (wsh2) and RB67-240 were mistakes in the CHECK. Rows 073/075/077 were a check artefact. Row 043 was a REAL APP DEFECT (fixed in d97cf1c) and is NOT superseded.
const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const num = (r) => Number(r.id.split("-")[1]);
const failed = (area, control, lo, hi) => rows.filter((r) => r.area === area && r.result === "FAIL" && (r.control || "").startsWith(control) && num(r) >= lo && num(r) <= hi).map((r) => r.id);
const done = [];
const go = (area, control, lo, hi, reason, later) => { const ids = failed(area, control, lo, hi); if (ids.length) { X.corr(ids, reason, later); done.push(...ids); } };

go("RB67", "the planned total now counts only the copy still to get", 240, 240, "the check expected the whole total to read $4.99, but the account also held the other priced wants made earlier in the run. The page showed $42.96 = $37.97 (the other two priced wants, as shown after the skip) + $4.99 (the one remaining comic copy), which is correct.", "RB68 final run and the arithmetic recorded here");
go("RB68", "Following rules are saved to the account", 1, 38, "the check expected exactly two rules, but account wsh2 already held the rules from the earlier RB67 run on it. Both rules the check created were saved correctly.", "RB68 final run on a fresh account (wsh4)");
go("RB68", "the releases the comic rule added reached the account", 1, 38, "the check required every want linked to any rule to carry a catalog identity, but wsh2 also held a want added by the earlier manual rule (a manual rule's wants have no catalog identity, by design).", "RB68 final run on a fresh account (wsh4)");
go("RB68", "pressing Save twice at once", 1, 38, "the check assumed the sheet offers one copy by default; it offers all copies still to get (2), so one Save made records _1 and _2 and the want became Acquired. No id was repeated.", "RB68 final run (the check sets Received now to 1 first)");
go("RB68", "the account shows 1 of 2 received", 1, 38, "follows from the row above: with the default of 2 copies the want was correctly Acquired (2 of 2).", "RB68 final run");
go("RB68", "a retry of the same copy from a browser", 1, 38, "follows from the two rows above: the account already held both copies, so the retry correctly found both records already present.", "RB68 final run");
// (RB68-043 was first written up here as a superseded test mistake. That was WRONG: it was a real app defect. The row was relabelled by fix-label-rb68-043.cjs and this script no longer touches it.)
go("RB68", "pressing Save twice at once", 39, 77, "the check used the same fixed want id in two QA accounts, so the second account's Vault record could not take the id the first account's record already held. Real want ids are random (wish_...) so this cannot happen for them; the one real case (ids built from a release) is the fault recorded on the row above and is fixed.", "RB68 final run (older QA accounts dropped first)");
go("RB68", "a retry of the same copy from a browser", 39, 77, "same cause as the row above (a fixed want id reused in two QA accounts).", "RB68 final run");
go("RB68", "the second copy numbers on", 39, 77, "same cause as the row above (a fixed want id reused in two QA accounts).", "RB68 final run");
console.log("superseding", done.join(", ") || "nothing");
process.exit(0);
