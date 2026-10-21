// Corrections for the post-SQL production checks (batch 17). Real application failures that were fixed by a code change (RB58-001..003) are NOT superseded: they stay
// recorded as failures, with the passing run after them.
const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const has = (id) => rows.some((r) => r.id === id);
const failsOf = (re) => rows.filter((r) => re.test(r.id) && r.result === "FAIL").map((r) => r.id);
const done = [];
if (has("RB56-004")) { X.corr(["RB56-004"], "this row recorded no check at all ('n/a'): it only restated that no 'kept on this device' message was needed, and that is shown by the account row in RB56-003. It should not count as a pass.", "RB56-003"); done.push("RB56-004"); }
const r57 = failsOf(/^RB57-/);
if (r57.length) { X.corr(r57, "the check that asks which profile the allowance request was for also counted the browser's CORS preflight request (it has no body), so one request looked like it named no profile. Preflights are now ignored; RB57-015 passes.", "RB57-015"); done.push(...r57); }
if (has("RB54-008")) { X.corr(["RB54-008"], "this check depended on the older-list row that RB54-007 should have created, so it failed only as a consequence of RB54-007 (the app failure that was fixed); it passes in RB54-017 and RB54-026.", "RB54-017, RB54-026"); done.push("RB54-008"); }
if (has("RB35-018")) { X.corr(["RB35-018"], "this PASS expected 'Total asking' to be at least the sum of all four listings, including a listing that has NO asking price (shown as 'value'), so it accepted a total that mixed what sellers ask with what an item is estimated to be worth. The total now adds asking prices only and says how many listings have none; the corrected check is RB35-027 ($740 and '1 without an asking price, not counted').", "RB35-027"); done.push("RB35-018"); }
console.log("superseding", done.join(", "));
process.exit(0);
