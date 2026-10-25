// RB69-005 and RB69-012 failed because the check looked for a row of buttons named "Conventions"; on desktop the event-type filter is a dropdown ("Filter by event type"; the button row is phone-only). Not a page fault.
const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const ids = rows.filter((r) => r.area === "RB69" && r.result === "FAIL" && /type filters still respond/.test(r.control || "")).map((r) => r.id);
if (ids.length) X.corr(ids, "the check looked for a row of buttons named Conventions, but on desktop the event-type filter is a dropdown named 'Filter by event type' (the button row is phone-only). The filter works: Card Shows narrowed 738 events to 491.", "RB69-019 and RB69-026");
console.log("superseding", ids.join(", ") || "nothing");
