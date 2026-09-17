// One-time batch tool: trims each Friendly Glass icon down to just its
// real artwork and re-centers it on a square canvas, so visible content
// fills a consistent fraction of the 256x256 frame across all 109 icons.
//
// A plain alpha bounding-box trim (sharp's .trim()) isn't enough here:
// several icons carry a small disconnected sliver of an adjacent icon
// bleeding in from one edge (a pre-existing defect from how the source
// sheets were cut into cells) with a fully-transparent gap between that
// sliver and the real content. A naive bbox trim includes the sliver in
// the crop. This instead finds the LARGEST contiguous non-transparent
// band on each axis independently and crops to that, which drops a
// disconnected sliver as long as a genuinely empty (alpha=0) gap
// separates it from the real artwork.
//
// Run: node scripts/crop_friendly_glass.js
process.env.npm_package_config_libvips = process.env.npm_package_config_libvips || ">=8.17.3";

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// Reads from the true, never-touched originals (restored from commit
// 1ff5152 into scripts/_true_originals) so repeated runs of this script
// never compound resize/recrop quality loss on top of a previous pass.
const SRC_DIR = path.join(__dirname, "_true_originals");
const DEST_DIRS = [
  path.join(__dirname, "..", "design-assets", "icon-themes", "friendly-glass-v1", "icons"),
  path.join(__dirname, "..", "public", "ui", "icon-themes", "friendly-glass-v1"),
];
const OUTPUT_SIZE = 256;
const EDGE_PAD_PCT = 0.04;
// A line "has content" only if it has a real number of solidly-opaque
// pixels — not just summed alpha, which a single anti-aliased stray pixel
// can push over a low threshold and wrongly bridge a real transparent gap
// between the icon and a disconnected bleed sliver (verified: summed alpha
// falsely bridged a gap that pixel-count correctly identified as empty).
const OPAQUE_ALPHA = 128;
const MIN_OPAQUE_PIXELS = 2;

// Given an array of per-line opaque-pixel counts, returns [start, end]
// (inclusive) of the largest contiguous run of lines with real content.
function largestBand(lineCounts) {
  const isContent = lineCounts.map((c) => c >= MIN_OPAQUE_PIXELS);
  let bestStart = -1, bestLen = 0, curStart = -1;
  for (let i = 0; i <= isContent.length; i++) {
    if (i < isContent.length && isContent[i]) {
      if (curStart === -1) curStart = i;
    } else if (curStart !== -1) {
      const len = i - curStart;
      if (len > bestLen) { bestLen = len; bestStart = curStart; }
      curStart = -1;
    }
  }
  return [bestStart, bestStart + bestLen - 1];
}

async function cropOne(name) {
  const src = path.join(SRC_DIR, name);
  const { data, info } = await sharp(src).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  const rowCount = new Array(h).fill(0);
  const colCount = new Array(w).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > OPAQUE_ALPHA) {
        rowCount[y]++;
        colCount[x]++;
      }
    }
  }

  const [y0, y1] = largestBand(rowCount);
  const [x0, x1] = largestBand(colCount);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;

  const cropped = await sharp(src).extract({ left: x0, top: y0, width: cw, height: ch }).toBuffer();

  const side = Math.round(Math.max(cw, ch) * (1 + EDGE_PAD_PCT * 2));
  const finalBuf = await sharp(cropped)
    .resize(side, side, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  for (const dir of DEST_DIRS) {
    fs.writeFileSync(path.join(dir, name), finalBuf);
  }

  return {
    name,
    originalContentBbox: `x:${x0}-${x1} y:${y0}-${y1}`,
    trimmedTo: `${cw}x${ch}`,
    fillPct: +((100 * Math.max(cw, ch)) / side).toFixed(1),
  };
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
