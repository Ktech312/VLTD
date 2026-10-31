// Contact sheets of the coverage screenshots: per state (populated, empty) and width, tops on the first rows and ends below.
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const SP = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad";
const IN = process.argv[2], OUT = process.argv[3];
const fs = require("fs"); fs.mkdirSync(OUT, { recursive: true });
const pages = ["vault-items", "vault-for-sale", "vault-sold", "vault-insights", "vault-goals", "vault-insurance", "exhibition-new", "exhibition-from-search", "add-item", "quick-add", "upload-single", "upload-bulk", "exhibition-builder"];
(async () => {
  for (const state of ["populated", "empty"]) for (const w of [390, 320]) {
    const h = Math.round(w * 2.165), tw = 250, th = Math.round(250 * h / w), cols = 7;
    const files = [...pages.map((p) => `${state}-${p}-top-${w}.jpg`), ...pages.map((p) => `${state}-${p}-end-${w}.jpg`)];
    const comps = [];
    for (let i = 0; i < files.length; i++) {
      if (!fs.existsSync(IN + "/" + files[i])) continue;
      comps.push({ input: await sharp(IN + "/" + files[i]).resize(tw, th, { fit: "contain", background: "#000" }).toBuffer(), left: (i % cols) * (tw + 4), top: Math.floor(i / cols) * (th + 4) });
    }
    await sharp({ create: { width: cols * (tw + 4), height: 4 * (th + 4), channels: 3, background: "#333" } }).composite(comps).jpeg({ quality: 82 }).toFile(`${OUT}/${state}-${w}.jpg`);
  }
  console.log("sheets written");
})();
