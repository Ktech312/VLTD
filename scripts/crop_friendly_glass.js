// One-time batch tool: trims the transparent margin off every Friendly
// Glass icon and re-centers the artwork on a square canvas, so the visible
// content fills a consistent fraction of the 256x256 frame across all 109
// icons instead of varying (some as low as ~79%). Proportions are
// preserved — this crops dead space, it does not stretch or distort.
//
// Run: node scripts/crop_friendly_glass.js
// (sharp needs this env var set to load standalone outside npm scripts)
process.env.npm_package_config_libvips = process.env.npm_package_config_libvips || ">=8.17.3";

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "design-assets", "icon-themes", "friendly-glass-v1", "icons");
const DEST_DIRS = [
  SRC_DIR,
  path.join(__dirname, "..", "public", "ui", "icon-themes", "friendly-glass-v1"),
];
const OUTPUT_SIZE = 256;
const EDGE_PAD_PCT = 0.04; // small breathing room so the crop isn't pixel-tight to the alpha edge

async function cropOne(name) {
  const src = path.join(SRC_DIR, name);
  const trimmedBuf = await sharp(src).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  const { width: tw, height: th } = trimmedBuf.info;
  const side = Math.round(Math.max(tw, th) * (1 + EDGE_PAD_PCT * 2));

  const finalBuf = await sharp(trimmedBuf.data)
    .resize(side, side, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  for (const dir of DEST_DIRS) {
    fs.writeFileSync(path.join(dir, name), finalBuf);
  }

  return { name, before: `${tw}x${th}`, fillPct: +((100 * Math.max(tw, th)) / side).toFixed(1) };
}

(async () => {
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith(".png"));
  console.log(`Processing ${files.length} icons...`);
  const results = [];
  for (const f of files) {
    try {
      results.push(await cropOne(f));
    } catch (err) {
      console.error("FAILED:", f, err.message);
    }
  }
  console.log(`Done. ${results.length}/${files.length} processed.`);
  fs.writeFileSync(path.join(__dirname, "_crop_report.json"), JSON.stringify(results, null, 2));
})();
