// mark my own invalid first-run rows (test timing mistakes) as superseded. usage: node audit-s-dis-fixrows.cjs ID=note ...
const fs = require("fs");
const f = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/audit-2026-10-18/rows.jsonl";
const notes = Object.fromEntries(process.argv.slice(2).map((a) => { const i = a.indexOf("="); return [a.slice(0, i), a.slice(i + 1)]; }));
const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); if (r.area === "DIS" && notes[r.id]) { r.result = "NOT TESTED"; r.actual = "[invalid first run, superseded] " + notes[r.id] + ". Original observation: " + String(r.actual).slice(0, 100); r.impact = "none"; return JSON.stringify(r); } return l; });
fs.writeFileSync(f, lines.join("\n") + "\n");
console.log("ok");
