// Builds the contact sheets for the closeout from the audit screenshots (emulated phone widths of the live app, not a physical phone).
//   node make-sheets.cjs <audit dir> <out dir>
const fs = require("fs"), path = require("path");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const [, , AUD, OUT] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
const SCALE = 0.4, PAD = 14, LABEL = 34, BG = { r: 14, g: 16, b: 20 };
async function sheet(name, rows) {
  // rows: [[label, file], ...] laid out in one row (or several rows when rows is an array of arrays)
  const grid = Array.isArray(rows[0][0]) ? rows : [rows];
  const tiles = [];
  let y = PAD, maxW = 0;
  for (const row of grid) {
    let x = PAD, rowH = 0;
    for (const [label, file] of row) {
      const buf = await sharp(path.join(AUD, file)).resize({ width: Math.round(780 * SCALE * (/-320\./.test(file) ? 0.82 : 1)) }).jpeg({ quality: 80 }).toBuffer();
      const meta = await sharp(buf).metadata();
      const svg = Buffer.from(`<svg width="${meta.width}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg"><text x="2" y="24" font-family="Arial" font-size="20" fill="#cfd4da">${label}</text></svg>`);
      tiles.push({ input: svg, left: x, top: y }, { input: buf, left: x, top: y + LABEL });
      x += meta.width + PAD; rowH = Math.max(rowH, meta.height + LABEL);
    }
    maxW = Math.max(maxW, x); y += rowH + PAD;
  }
  await sharp({ create: { width: maxW, height: y, channels: 3, background: BG } }).composite(tiles).jpeg({ quality: 82 }).toFile(path.join(OUT, name));
  console.log("wrote", name, maxW + "x" + y);
}
(async () => {
  const pages = [["Home", "home"], ["Vault", "vault"], ["Exhibitions", "exhibitions"], ["Discover", "discover"], ["Insights", "insights"]];
  await sheet("1-after-390.jpg", pages.map(([l, k]) => [l + " 390", `after-${k}-top-390.jpg`]));
  await sheet("2-after-320.jpg", pages.map(([l, k]) => [l + " 320", `after-${k}-top-320.jpg`]));
  await sheet("3-before-after.jpg", [
    [["Vault before", "before-vault-top-390.jpg"], ["Vault after", "after-vault-top-390.jpg"], ["Exhibitions before", "before-exhibitions-top-390.jpg"], ["Exhibitions after", "after-exhibitions-top-390.jpg"], ["Insights before", "before-insights-top-390.jpg"], ["Insights after", "after-insights-top-390.jpg"]],
  ]);
  await sheet("4-menus.jpg", [["Add chooser 390", "after-menu-add-390.jpg"], ["More 390", "after-menu-more-390.jpg"], ["Add chooser 320", "after-menu-add-320.jpg"], ["More 320", "after-menu-more-320.jpg"]]);
  await sheet("5-scroll-ends-390.jpg", pages.map(([l, k]) => [l + " end 390", `after-${k}-end-390.jpg`]));
})();
