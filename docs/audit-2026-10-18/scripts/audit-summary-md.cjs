const { AUD, REPO, fs } = require("./audit-lib.cjs");
const sum = JSON.parse(fs.readFileSync(AUD + "/summary.json", "utf8"));
const rcs = JSON.parse(fs.readFileSync(AUD + "/root-causes.json", "utf8"));
const rows = new Map(fs.readFileSync(AUD + "/rows.jsonl", "utf8").split("\n").filter(Boolean).map(JSON.parse).map((r) => [r.id, r]));
const P = { 1: "P1 - privacy / data loss", 2: "P2 - blocked workflow / exposure", 3: "P3 - misleading result", 4: "P4 - usability", 5: "P5 - cosmetic" };
let md = `# VLTD application audit - 2026-10-18/19 (inventory and behaviour results; nothing was fixed)\n\n`;
md += `Browsable report: \`report.html\` (filter by result, area, depth, impact; evidence links open the screenshots). CSVs: \`results.csv\` (every row), \`inventory-pages.csv\`, \`inventory-controls.csv\`, \`api-inventory.csv\`, \`routes-static.csv\`.\n\n`;
md += `## Totals\n\n| Measure | Count |\n|---|---|\n| Routes in the repository (pages / API) | ${sum.staticRoutes} / ${sum.apiRoutes} |\n| Page visits recorded (state x width) | ${sum.pages} |\n| Controls inventoried | ${sum.controls} |\n| Result rows | ${sum.rows} |\n`;
for (const [k, v] of Object.entries(sum.byResult)) md += `| ${k} | ${v} |\n`;
md += `\nBehaviour-asserted rows (a test checked the outcome): ${sum.behaviourRows} = ${Object.entries(sum.behaviourByResult).map(([k, v]) => v + " " + k).join(", ")}. The rest are **smoke** rows (a control responded to a click; the outcome was NOT judged) and link rows (the link resolves).\n\n`;
md += `**How to read FAIL:** ${sum.confirmedDefectRows} behaviour FAIL rows belong to the ${sum.rootCauses} root causes below (confirmed by the auditors after setting their own test mistakes aside). ${sum.unreconciledFailRows} further behaviour FAIL rows are first-run failures the auditors describe as mostly their own test mistakes; they are kept as first-failure evidence, marked "UNRECONCILED" in the Triage column, and need triage rather than repair. ${sum.byResult.SUPERSEDED || 0} rows are SUPERSEDED (first-run result replaced by a corrected row; both stay visible).\n\n`;
md += `## Prioritized defect list (root causes, genuine failures only)\n\n`;
for (const p of [1, 2, 3, 4, 5]) {
  const g = rcs.filter((r) => r.priority === p); if (!g.length) continue;
  md += `### ${P[p]}\n\n`;
  for (const r of g) { const sample = r.rowIds.slice(0, 6).join(", ") + (r.rowIds.length > 6 ? ` (+${r.rowIds.length - 6} more)` : ""); md += `- **${r.id} ${r.title}**  \n  ${r.summary}  \n  Rows (${r.rowIds.length}): ${sample}\n`; }
  md += "\n";
}
fs.writeFileSync(AUD + "/SUMMARY.md", md);
console.log("SUMMARY.md written", md.length);
