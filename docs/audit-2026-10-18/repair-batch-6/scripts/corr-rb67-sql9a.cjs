// Correction for the one failing row of the post-SQL Wishlist run (RB67 sql9a). The failure was a mistake in the CHECK, not in the page.
// The check expected the planned total to read $4.99 (the one comic copy still to get), but the QA account also holds the card product and toy wants made earlier in the same run,
// so the page correctly showed $42.96 = $37.97 (the two other priced wants, as shown after the skip) + $4.99 (the remaining comic copy). The later RB68 run reads the total per want instead.
const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const ids = rows.filter((r) => r.area === "RB67" && r.result === "FAIL" && (r.control || "").startsWith("the planned total now counts only the copy still to get") && /42\.96/.test(r.actual || "")).map((r) => r.id);
if (ids.length) X.corr(ids, "the check expected the whole total to read $4.99, but the account also held the other priced wants made earlier in the run. The page showed $42.96 = $37.97 (the other two priced wants, as shown after the skip) + $4.99 (the one remaining comic copy), which is correct. Only the remaining copy is counted for the comic (1 of 2 received).", "RB68 sql9a (per-want amounts) and the arithmetic recorded here");
console.log("superseding", ids.join(", ") || "nothing");
process.exit(0);
