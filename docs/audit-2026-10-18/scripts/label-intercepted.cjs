// Label every row whose outcome depended on a request the audit intercepted (AI, billing, email, sign-out, external lookups) so none reads as end-to-end verified.
const { AUD, fs } = require("./audit-lib.cjs");
fs.copyFileSync(AUD + "/rows.jsonl", AUD + "/rows.before-labelling.jsonl");
const rows = fs.readFileSync(AUD + "/rows.jsonl", "utf8").split("\n").filter(Boolean).map(JSON.parse);
const TOPIC = /identify with ai|scan with ai|\bai\b.*(scan|draft|identify|analy|result|refus|quota)|analy[sz]e|generate (listing )?copy|generated listing|checkout|billing|stripe|upgrade|send reset|reset link|password reset|password-reset|sign[- ]?out|sign out|log ?out|bug.?report|comic-lookup|psa|upc|card-lookup|vinyl|events\/search|kickstarter|patreon|upcoming|newsletter|resend|change email|google sign|continue with google|redeem/i;
const ALREADY = /intercept|simulated|refused by the audit|audit refus|blocked by the audit|stubbed|synthetic data/i;
let tagged = 0, signout = 0; const byArea = {};
for (const r of rows) {
  const hay = [r.page, r.control, r.expected, r.actual].join(" ");
  if (!TOPIC.test(hay)) continue;
  if (/^\[(INTERCEPTED|SIMULATED)/.test(r.actual)) continue;
  const isSignout = /sign[- ]?out|log ?out/i.test(r.control + " " + r.page) && !/CRW-02[56]/.test(r.id);
  if (isSignout) { r.actual = "[SIMULATED: the audit refused the sign-out request, so session termination was NOT verified by this row; the real sign-out was verified separately (CRW-025, CRW-026). This row only describes what the page does when the sign-out request fails.] " + r.actual; signout++; tagged++; byArea[r.area] = (byArea[r.area] || 0) + 1; continue; }
  if (ALREADY.test(r.actual)) { if (!/^\[INTERCEPTED/.test(r.actual)) { r.actual = "[INTERCEPTED/SIMULATED by the audit: not an end-to-end result] " + r.actual; tagged++; byArea[r.area] = (byArea[r.area] || 0) + 1; } continue; }
  // topic mentioned but no sign that the request was actually made: tag only rows that exercised the control (PASS/FAIL), not notes
  if (r.result === "PASS" || r.result === "FAIL") { r.actual = "[POSSIBLY INTERCEPTED: this control calls AI/billing/email/lookup/sign-out services that the audit refuses; treat as handling of a refusal, not an end-to-end result] " + r.actual; tagged++; byArea[r.area] = (byArea[r.area] || 0) + 1; }
}
fs.writeFileSync(AUD + "/rows.jsonl", rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log("rows labelled:", tagged, "| of which sign-out rows:", signout, JSON.stringify(byArea));
