// Replaces the background model of contrast-scan.cjs: opaque gradients keep each colour stop (worst one counts); translucent gradients (card sheens) are averaged; photo backgrounds are skipped as unknown.
const fs = require("fs");
const f = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/contrast-scan.cjs";
let s = fs.readFileSync(f, "utf8");
const a = s.indexOf("  const bgs = (el) =>"); const b = s.indexOf("    return bases; };") + "    return bases; };".length;
if (a < 0 || b < a) throw new Error("block not found");
const neu = `  const bgs = (el) => { const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e);
    const rootBg = rgba(getComputedStyle(document.body).backgroundColor); let bases = rootBg[3] > 0 ? [over(rootBg, [255, 255, 255, 1])] : [[16, 18, 22, 1]];
    for (let i = chain.length - 1; i >= 0; i--) { const cs = getComputedStyle(chain[i]); const img = cs.backgroundImage || ''; if (/url\\(/.test(img)) return null; // a picture behind the text: unknown, skipped
      const col = rgba(cs.backgroundColor); let nb = bases; if (col[3] > 0) nb = nb.map((b) => over(col, b));
      if (/gradient/.test(img)) { const st = stopsOf(img); if (st.length) { if (st.every((x) => x[3] >= 0.9)) nb = st.map((x) => over(x, nb[0])); else { const base0 = nb[0]; const mix = st.map((x) => over(x, base0)); nb = [[mix.reduce((t, m) => t + m[0], 0) / mix.length, mix.reduce((t, m) => t + m[1], 0) / mix.length, mix.reduce((t, m) => t + m[2], 0) / mix.length, 1]]; } } }
      bases = nb.slice(0, 8); }
    return bases; };`;
s = s.slice(0, a) + neu + s.slice(b);
s = s.replace("const bg = bgs(e); const effText", "const bg = bgs(e); if (!bg) { skippedPhoto++; continue; } const effText").replace("let checked = 0, marginal = 0;", "let checked = 0, marginal = 0, skippedPhoto = 0;").replace("return { checked, marginal, fails: out };", "return { checked, marginal, skippedPhoto, fails: out };");
fs.writeFileSync(f, s);
console.log("patched");
