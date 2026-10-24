// Corrections for the first post-SQL sharing/isolation/retry run (RB68 on QA account wsh2). Every failing row was a mistake in the CHECK, not in the page; each is replaced by a
// passing row in the clean re-run on a fresh QA account (wsh3).
const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const failed = (control, upTo) => rows.filter((r) => r.area === "RB68" && r.result === "FAIL" && (r.control || "").startsWith(control) && Number(r.id.split("-")[1]) <= upTo).map((r) => r.id);
const done = [];
const go = (control, reason, later) => { const ids = failed(control, 38); if (ids.length) { X.corr(ids, reason, later); done.push(...ids); } };
go("Following rules are saved to the account", "the check expected exactly two rules in the account, but account wsh2 already held the rules from the earlier RB67 run on it (a stopped card rule and a comic rule). Both rules the check created were saved correctly (manual rule, and a comic rule with its series key).", "RB68 clean re-run on a fresh account");
go("the releases the comic rule added reached the account", "the check required every want linked to any rule to carry a catalog identity, but wsh2 also held a want added by the earlier manual rule (a manual rule's wants have no catalog identity, by design). The comic rule's wants carry their identity and the standard-cover edition.", "RB68 clean re-run on a fresh account");
go("pressing Save twice at once", "the check assumed the sheet offers one copy by default; it offers all copies still to get (2), so one Save made records _1 and _2 and the want became Acquired. No id was repeated (a double press would have repeated ids, and none were).", "RB68 clean re-run (the check sets Received now to 1 first)");
go("the account shows 1 of 2 received", "follows from the row above: with the default of 2 copies the want was correctly Acquired (2 of 2).", "RB68 clean re-run");
go("a retry of the same copy from a browser", "follows from the two rows above: the account already held both copies, so the stale browser's retry correctly found both records already present (no third record was made).", "RB68 clean re-run");
console.log("superseding", done.join(", ") || "nothing");
process.exit(0);
