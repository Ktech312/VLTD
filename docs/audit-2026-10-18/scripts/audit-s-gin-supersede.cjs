// mark GIN rows that are invalid because of my own test mistakes, or duplicates from an accidental parallel run, as NOT TESTED (text kept, prefixed)
const fs = require("fs"); const F = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/audit-2026-10-18/rows.jsonl";
const note = {
  "GIN-007": "TEST MISTAKE (false PASS: the condition was satisfied by the fixture's public exhibition); superseded by GIN-026.",
  "GIN-010": "TEST MISTAKE (clicked the third row after the list order changed; the side panel did show the clicked row); superseded by GIN-027.",
  "GIN-037": "SUPERSEDED: imprecise wording; precise result in GIN-237.",
  "GIN-081": "REWORDED: with 3 goals the side panel was visible at y=643 after a tap; the 'appears to do nothing' wording below overstates it.",
  "GIN-148": "REWORDED: the page's own print CSS hides controls, but the site top bar still prints; see GIN-228 to GIN-231.",
  "GIN-173": "TEST ARTIFACT (evidence came from an interleaved parallel run); superseded by GIN-216.",
  "GIN-175": "TEST MISTAKE (waited 9 s; the page's own load-error state appears after up to 20 s); superseded by GIN-179.",
  "GIN-176": "TEST MISTAKE (waited 9 s); superseded by GIN-182.",
  "GIN-177": "TEST MISTAKE (waited 9 s); superseded by GIN-186.",
  "GIN-247": "TEST MISTAKE (key event without character data does not activate a button); superseded by GIN-253.",
  "GIN-248": "TEST MISTAKE (the sheet never opened); superseded by GIN-254.",
  "GIN-249": "TEST MISTAKE (the sheet never opened); superseded by GIN-255.",
  "GIN-250": "TEST MISTAKE (Enter not delivered as a character); superseded by GIN-256.",
  "GIN-251": "TEST MISTAKE (Enter not delivered as a character); superseded by GIN-257.",
};
const dups = { "GIN-165": "GIN-163", "GIN-167": "GIN-164", "GIN-169": "GIN-166", "GIN-171": "GIN-168", "GIN-172": "GIN-170", "GIN-178": "GIN-188", "GIN-180": "GIN-193", "GIN-181": "GIN-196", "GIN-183": "GIN-197", "GIN-184": "GIN-198", "GIN-185": "GIN-199", "GIN-187": "GIN-200", "GIN-189": "GIN-201", "GIN-190": "GIN-202", "GIN-191": "GIN-203", "GIN-192": "GIN-204", "GIN-194": "GIN-205", "GIN-195": "GIN-206" };
for (let attempt = 0; attempt < 5; attempt++) {
  const before = fs.statSync(F).size; const txt = fs.readFileSync(F, "utf8"); const lines = txt.split("\n");
  let n = 0;
  const out = lines.map((l) => { if (!l.trim()) return l; let o; try { o = JSON.parse(l); } catch { return l; } if (o.area !== "GIN") return l;
    if (note[o.id]) { o.actual = `[${note[o.id]}] ORIGINAL: ${o.actual}`; o.result = "NOT TESTED"; o.impact = "none"; n++; return JSON.stringify(o); }
    if (dups[o.id]) { o.actual = `[DUPLICATE from an accidental parallel run of the same script; counted once, in ${dups[o.id]}] ORIGINAL: ${o.actual}`; o.result = "NOT TESTED"; o.impact = "none"; n++; return JSON.stringify(o); }
    if (o.id === "GIN-065") { o.actual = `[Improvement note, not a defect] ${o.actual}`; o.result = "PASS"; n++; return JSON.stringify(o); }
    return l; });
  if (fs.statSync(F).size !== before) { console.log("file changed while rewriting, retry"); continue; }
  fs.writeFileSync(F, out.join("\n")); console.log("rewrote", n, "rows"); break;
}
