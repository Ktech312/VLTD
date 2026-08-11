// Copies the zxing-wasm reader binary into public/ so it's served as a
// plain static asset (Next.js requires WASM to live under public/ or be
// fetched from a URL — it can't be bundled into a server/client JS chunk
// directly). Runs automatically on `npm install` (see package.json
// "postinstall") so a fresh `npm ci` on Vercel always has it, without
// committing a binary into git.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm");
const destDir = path.join(__dirname, "..", "public");
const dest = path.join(destDir, "zxing_reader.wasm");

if (!fs.existsSync(src)) {
  console.warn("[copy-zxing-wasm] source wasm not found at", src, "-- skipping (zxing-wasm not installed?)");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[copy-zxing-wasm] copied ${fs.statSync(dest).size} bytes to public/zxing_reader.wasm`);
