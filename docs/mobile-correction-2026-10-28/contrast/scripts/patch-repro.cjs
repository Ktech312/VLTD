// Rewrites the reproduction block of contrast-eight.cjs so each case builds a fresh element and measures it in one step.
const fs = require("fs");
const f = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/contrast-eight.cjs";
const lines = fs.readFileSync(f, "utf8").split("\n");
const i = lines.findIndex((l) => l.includes("const before = await measure("));
if (i < 0) throw new Error("block not found");
const fresh = (styleExpr) => "`(() => { const b = document.createElement('button'); b.type = 'button'; b.className = ${JSON.stringify(cls)}; b.setAttribute('style', " + styleExpr + "); b.textContent = 'Save'; (document.querySelector('main') || document.body).appendChild(b); const cs = getComputedStyle(b); const c = cs.color; const r = (${ratioFn}); const out = { color: c, onLight: r(c, ${JSON.stringify(LIGHT)}), onDark: r(c, ${JSON.stringify(DARK)}), tag: 'BUTTON', text: 'Save' }; b.remove(); return out; })()`";
lines.splice(i, 3,
  "      const before = await S.evaluate(" + fresh("${JSON.stringify(style)}") + ");",
  "      const after = await S.evaluate(" + fresh("${JSON.stringify(style + '; color: #0B0B0B')}") + ");");
fs.writeFileSync(f, lines.join("\n"));
console.log("patched at line", i + 1);
