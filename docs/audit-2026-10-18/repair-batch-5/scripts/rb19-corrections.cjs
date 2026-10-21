// Appends the explanation row for the first stage-2 run to rows.jsonl (audit-lib format; no service key needed).
const fs = require("fs"); const path = require("path");
const AUD = path.join(__dirname, "..", "..");
const f = path.join(AUD, "counters-RB19.txt"); let n = 0; try { n = Number(fs.readFileSync(f, "utf8")) || 0; } catch {} n++; fs.writeFileSync(f, String(n));
const o = { id: `RB19-${String(n).padStart(3, "0")}`, area: "RB19", page: "(correction)", control: "CORRECTION: RB19-030 (invite-link page as a signed-out visitor) superseded", expected: "Earlier rows are explained, not edited", actual: "TEST MISTAKE, not an app result: an invitation page is for registered users and sends a signed-out visitor to the login page (screenshot rb19-first-3.jpg). Re-run with the signed-in QA account B: RB19-062 passes (title and card render). Stage 2 does not change what that page reads.", result: "NOT TESTED", evidence: "", impact: "none", repro: "n/a", at: new Date().toISOString() };
fs.appendFileSync(path.join(AUD, "rows.jsonl"), JSON.stringify(o) + "\n"); console.log(o.id);
