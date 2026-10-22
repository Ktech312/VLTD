// Corrections for the synthetic final-evening checks (batch 18). RB63-012 and RB63-024 are NOT superseded: they caught a real app bug (the Events page chose its default
// event before checking whether it was over in its own time zone, so an LA event stayed shown as the featured event after local midnight); it was fixed and the same check passes in RB63-036 and RB63-048.
const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(require(path.join(__dirname, "..", "..", "scripts", "audit-lib.cjs")).AUD + "/rows.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const has = (id) => rows.some((r) => r.id === id);
const ids = ["RB63-003", "RB63-004", "RB63-005", "RB63-006", "RB63-007", "RB63-009", "RB63-010", "RB63-015", "RB63-016", "RB63-017", "RB63-018", "RB63-019", "RB63-021", "RB63-022", "RB63-027", "RB63-028", "RB63-029", "RB63-030", "RB63-031", "RB63-033", "RB63-034"];
if (ids.every(has)) X.corr(ids, "the banner is only shown to a signed-in person, and with the browser's clock moved to November the stored sign-in looked expired, so the app signed the test account out (first runs landed on /login or the public page and saw no banner). The check harness now pushes the stored sign-in's expiry out (the harness looked for the wrong storage key at first, 'sb-*' instead of 'vltd-auth'). The same checks pass in RB63-037 to RB63-047.", "RB63-037..047");
console.log("done"); process.exit(0);
