const fs = require("fs");
const A = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/audit-2026-10-18/";
// 1. rows: supersede the earlier legacy-API note row, correct CRW-027's impact
let rows = fs.readFileSync(A + "rows.jsonl", "utf8").split("\n").filter(Boolean).map(JSON.parse);
for (const r of rows) {
  if (r.id === "CRW-023") { r.result = "NOT TESTED"; r.actual = "[superseded by CRW-027: the route was probed with a synthetic payload after its storage, callers and side effects were confirmed] " + r.actual; }
  if (r.id === "CRW-027") r.impact = "usability";
}
fs.writeFileSync(A + "rows.jsonl", rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

// 2. root causes: sign-out is only an interrupted-connection finding; add the legacy API group
let b = fs.readFileSync("build-rootcauses.cjs", "utf8");
const old = `{ p: 1, impact: "privacy/data loss", title: "Sign out when the sign-out request fails looks signed out but the session stays", summary: "The UI goes to /login with no error, but reopening /dashboard is still signed in. (The audit refuses the sign-out request, so this is the interrupted-connection case.)", rows: ["ACC-850", "ACC-286", "ACC-344"] },`;
if (!b.includes(old)) throw new Error("sign-out group not found");
b = b.split(old).join(`{ p: 3, impact: "misleading result", title: "SIMULATED interrupted connection: when the sign-out request fails, the page shows the login screen and gives no error while the session continues", summary: "These rows were made with the sign-out request REFUSED by the audit, so they do not show that sign-out fails in normal use. A REAL sign-out of a synthetic QA session was verified separately and PASSED (CRW-025, CRW-026: session cleared, refresh token revoked, old session refused in a clean browser). Only the failed-request case is a finding: no error is shown and the session remains.", rows: ["ACC-850", "ACC-286", "ACC-344", "CRW-025", "CRW-026"] },`);
const anchor = `  // ---------------- P5: cosmetic / improvement`;
b = b.split(anchor).join(`  { p: 4, impact: "usability", title: "Legacy /api/vault/[id] accepts anonymous writes (reachable, not durable, not used)", summary: "Probed with a synthetic payload only, after reading the code: POST/DELETE answer 200 to an anonymous caller; the route keeps items only in server process memory (no database or file), has no read endpoint, and nothing in the app calls it. Hygiene finding (unauthenticated memory use), not data exposure or loss.", rows: ["CRW-027"] },
` + anchor);
fs.writeFileSync("build-rootcauses.cjs", b);

// 3. report generator: historical Discover failures kept separate; results.json export
let g = fs.readFileSync("audit-report.cjs", "utf8");
const t = `for (const r of behaviour) { r.triage = "";`;
if (!g.includes(t)) throw new Error("triage anchor");
g = g.split(t).join(`for (const r of behaviour) { r.triage = ""; if (r.area === "KNO" && r.result === "FAIL") { r.triage = "HISTORICAL: original Discover failure, fixed in 94b4522 before the audit began; first-failure evidence kept; not a current defect (see the re-verification PASS rows)"; continue; }`);
g = g.split(`const unr = 0;`).join("");
g = g.split(`confirmedDefectRows: behaviour.filter((r) => r.result === "FAIL" && rcOf.has(r.id)).length, unreconciledFailRows: behaviour.filter((r) => r.result === "FAIL" && !rcOf.has(r.id)).length,`).join(`confirmedDefectRows: behaviour.filter((r) => r.result === "FAIL" && rcOf.has(r.id)).length, historicalFailRows: behaviour.filter((r) => r.area === "KNO" && r.result === "FAIL").length, unreconciledFailRows: behaviour.filter((r) => r.result === "FAIL" && !rcOf.has(r.id) && r.area !== "KNO").length,`);
g = g.split(`fs.writeFileSync(AUD + "/results.csv", csv(cols, all));`).join(`fs.writeFileSync(AUD + "/results.csv", csv(cols, all));\nfs.writeFileSync(AUD + "/results.json", JSON.stringify(all));`);
fs.writeFileSync("audit-report.cjs", g);
console.log("patched");
