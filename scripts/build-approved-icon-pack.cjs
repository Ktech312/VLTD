// Reuse the app's semantic vector silhouettes with the approved navigation finish.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/components/ui/AppIcon.tsx"), "utf8");
const start = source.indexOf("const PATHS:");
const end = source.indexOf("\n};", start) + 3;
if (start < 0 || end < start) throw new Error("Cannot locate semantic icon paths");
const code = ts.transpileModule(source.slice(start, end) + "\nmodule.exports = PATHS;", {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const mod = { exports: {} };
new Function("React", "module", code)(React, mod);
const out = path.join(root, "public/ui/icon-themes/cyan-purple-neon-v1");
fs.mkdirSync(out, { recursive: true });
const names = Object.keys(mod.exports);
const boundsPath = path.join(__dirname, "approved-icon-bounds.json");
const bounds = fs.existsSync(boundsPath) ? JSON.parse(fs.readFileSync(boundsPath, "utf8")) : {};
// Simple armchair: open back, substantial arms and seat, two short legs.
const lounge = '<path d="M6 11V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v4M6 15h12M5 11H3v8h18v-8h-3v4M6 11v4M6 19l-2 3h3l2-3m6 0 2 3h3l-2-3"/>';
for (const name of names) {
  if (name === "dashboard" || name === "vault") continue;
  const art = name === "communityBoard"
    ? `<g transform="translate(1 1) scale(1.25)">${lounge}</g>`
    : renderToStaticMarkup(React.createElement("g", { transform: "translate(1 1) scale(1.25)" }, mod.exports[name]));
  // Bounds are measured from the complete symbol in its local coordinate system,
  // not the 32px canvas or individual paths. Every silhouette gets the full palette.
  const b = bounds[name] || { x: 3, y: 3, width: 18, height: 18 };
  const defs = `<linearGradient id="ink" x1="${b.x}" y1="${b.y}" x2="${b.x + b.width}" y2="${b.y + b.height}" gradientUnits="userSpaceOnUse"><stop stop-color="#27e3ff"/><stop offset=".32" stop-color="#4e85ff"/><stop offset=".62" stop-color="#a46bff"/><stop offset=".88" stop-color="#fc46e3"/></linearGradient>`;
  // Same 32px canvas, dark edge, 2px gradient stroke and restrained halo as Home/Vault.
  // Compensate for the path coordinate scale to keep the final stroke width constant.
  const layer = (stroke, width, opacity = 1) => `<g stroke="${stroke}" stroke-width="${width / 1.25}" opacity="${opacity}">${art.replaceAll("currentColor", stroke)}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none"><defs>${defs}</defs><g stroke-linecap="round" stroke-linejoin="round">${layer("#08172c", 3.5)}${layer("url(#ink)", 2)}${layer("url(#ink)", 4, .12)}</g></svg>\n`;
  fs.writeFileSync(path.join(out, name + ".svg"), svg);
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ style: "Cyan–purple neon", icons: names }, null, 2) + "\n");
console.log(`Approved pack: ${names.length} icons (Home and Vault preserved).`);
