// Replaces the colour parser of contrast-scan.cjs: the colour and its alpha are recovered by drawing it over white and over black (no double un-premultiplying).
const fs = require("fs");
const f = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/contrast-scan.cjs";
const lines = fs.readFileSync(f, "utf8").split("\n");
const i = lines.findIndex((l) => l.startsWith("  const rgba = (c) =>"));
if (i < 0) throw new Error("rgba line not found");
lines[i] = "  const rgba = (c) => { if (!c || c === 'transparent') return [0, 0, 0, 0]; const m = c.match(/^rgba?\\\\(\\\\s*([\\\\d.]+)[, ]+\\\\s*([\\\\d.]+)[, ]+\\\\s*([\\\\d.]+)(?:\\\\s*[,/]\\\\s*([\\\\d.]+%?))?\\\\s*\\\\)$/); if (m) { let a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return a === 0 ? [0, 0, 0, 0] : [+m[1], +m[2], +m[3], a]; } const draw = (bg) => { cx.globalCompositeOperation = 'source-over'; cx.fillStyle = bg; cx.fillRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; }; const w = draw('#fff'), b = draw('#000'); const a = 1 - (w[1] - b[1]) / 255; if (a <= 0.004) return [0, 0, 0, 0]; return [Math.min(255, Math.round(b[0] / a)), Math.min(255, Math.round(b[1] / a)), Math.min(255, Math.round(b[2] / a)), Math.min(1, a)]; };";
fs.writeFileSync(f, lines.join("\n"));
console.log("patched line", i + 1);
