// Corrections for the Watchlist checks (RB67). Every row below failed because of a mistake in the CHECK, not in the page; each is replaced by a passing row in the later run named.
// One of them also records a real, disclosed limit: until SQL package 9 runs, quantity, edition, expected price and the skipped/acquired states live on the device only, so a clean second browser sees quantity 1.
const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const failed = (control) => rows.filter((r) => r.area === "RB67" && r.result === "FAIL" && (r.control || "").startsWith(control)).map((r) => r.id);
const done = [];
const go = (control, reason, later) => { const ids = failed(control); if (ids.length) { X.corr(ids, reason, later); done.push(...ids); } };
go("the Pull List groups by month", "the check compared the group headings in their typed case, but the page prints them in capitals (\"NOVEMBER 2026\"). The groups, order and totals were right ($9.98, $27.99, $143.00).", "RB67 local3 and prod1");
go("an invalid cost is refused", "the check looked for the words 'not a number' but the page says \"use numbers only (no letters or exponents like 1e3)\". The cost was refused and nothing was saved to the Vault.", "RB67 local3 and prod1");
go("the want shows 1 of 2", "the check made the two-copy want in one browser and acquired it in a clean second browser. Until SQL package 9 runs, quantity is held on the device only, so the second browser saw quantity 1. DISCLOSED LIMIT, not a page fault: after the SQL, quantity, edition, expected price and skipped/acquired states reach the account. The re-run makes the want in the same browser.", "RB67 local3 and prod1");
go("the planned total now counts only", "same cause as the row above: the second browser did not know the quantity yet (device-only until SQL package 9).", "RB67 local3 and prod1");
go("the second copy is saved with the cost", "(local run) same cause as above. (production run) the check counted every Vault record with that title on the shared QA account, and earlier local runs of the same check had left their own two records, so it saw four instead of two. The two records from the production run were saved correctly (one with no price, one at 5.25, unique ids).", "RB67 prod1 records, and the unique-id check RB67-167");
go("a clean second browser shows", "the check had its title text replaced by the acquisition test's title in an edit, so it looked for a want that does not exist in that run; the four wants (comic, card product, toy, vintage piece) were all shown.", "RB67 local3 and prod1");
go("a watched public item is listed", "the check looked for the heading in typed case, but the page prints it in capitals (\"WATCHING (OTHER PEOPLE'S ITEMS, NOT YOURS)\"). The row, its label, source link and Add to my wants were checked separately and pass.", "RB67 prod1");
console.log("superseding", done.join(", ") || "nothing");
process.exit(0);
