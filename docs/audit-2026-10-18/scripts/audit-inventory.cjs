// Static route inventory from the repository: every page and API route, its source, guards, who links to it, static control counts.
const fs = require("fs");
const path = require("path");
const REPO = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28";
const OUT = REPO + "/docs/audit-2026-10-18";
fs.mkdirSync(OUT, { recursive: true });
const walk = (d, acc = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else acc.push(p.replace(/\\/g, "/")); } return acc; };
const files = walk(REPO + "/src/app");
const pages = files.filter((f) => /\/page\.tsx$/.test(f));
const apis = files.filter((f) => /\/route\.tsx?$/.test(f));
const toRoute = (f) => "/" + f.replace(REPO + "/src/app/", "").replace(/\/?(page\.tsx|route\.tsx?)$/, "").replace(/\(.*?\)\//g, "");
const srcFiles = walk(REPO + "/src").filter((f) => /\.(tsx?|ts)$/.test(f));
const srcText = srcFiles.map((f) => ({ f, t: fs.readFileSync(f, "utf8") }));
const redirects = fs.existsSync(REPO + "/next.config.ts") ? fs.readFileSync(REPO + "/next.config.ts", "utf8") : fs.existsSync(REPO + "/next.config.js") ? fs.readFileSync(REPO + "/next.config.js", "utf8") : "";
const mw = ["src/middleware.ts", "src/proxy.ts", "middleware.ts", "proxy.ts"].map((p) => REPO + "/" + p).find((p) => fs.existsSync(p));
const mwText = mw ? fs.readFileSync(mw, "utf8") : "";
const rows = [];
for (const f of pages) {
  const t = fs.readFileSync(f, "utf8");
  const route = toRoute(f);
  const dyn = (route.match(/\[[^\]]+\]/g) || []).join("");
  const base = route.replace(/\[\[?\.{0,3}[^\]]+\]?\]/g, "").replace(/\/+$/, "") || "/";
  // who links to it: href="/route" or `/route` or router.push("/route") outside the page itself
  const staticPrefix = route.split("[")[0].replace(/\/$/, "") || "/";
  const needle = new RegExp("[\"'`]" + staticPrefix.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&") + (dyn ? "/" : "[\"'`?#/]"), "g");
  const linkers = srcText.filter((s) => s.f !== f && needle.test(s.t) && !/\/api\//.test(s.f)).map((s) => s.f.replace(REPO + "/", ""));
  needle.lastIndex = 0;
  const count = (re) => (t.match(re) || []).length;
  rows.push({
    route, dynamic: dyn || "", file: f.replace(REPO + "/", ""), client: /^["']use client["']/.test(t),
    redirectOnly: /\bredirect\(|router\.replace\(|permanentRedirect/.test(t) && t.length < 1500,
    guard: [/ProtectedRoute/.test(t) && "ProtectedRoute", /RouteGuard/.test(t) && "RouteGuard", /getCurrentUser|getSession/.test(t) && "auth-check", /isAdmin|admin/i.test(route) && "admin-route"].filter(Boolean).join("+"),
    linkedFrom: linkers.length, linkedFromSample: linkers.slice(0, 4).join(" | "),
    staticButtons: count(/<button\b|<PillButton\b/g), staticLinks: count(/<Link\b|<a\b/g), staticInputs: count(/<input\b|<textarea\b|<select\b|<PillSelect\b/g), staticOnClick: count(/onClick=/g),
    lines: t.split("\n").length,
  });
}
rows.sort((a, b) => a.route.localeCompare(b.route));
const apiRows = apis.map((f) => ({ route: toRoute(f), file: f.replace(REPO + "/", ""), methods: (fs.readFileSync(f, "utf8").match(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g) || []).map((m) => m.split(/\s+/).pop()).join("/") })).sort((a, b) => a.route.localeCompare(b.route));
fs.writeFileSync(OUT + "/routes-static.json", JSON.stringify({ pages: rows, apis: apiRows, middleware: mw ? mw.replace(REPO + "/", "") : null }, null, 1));
const csv = (arr) => { const k = Object.keys(arr[0]); return [k.join(","), ...arr.map((r) => k.map((c) => '"' + String(r[c]).replace(/"/g, '""') + '"').join(","))].join("\n"); };
fs.writeFileSync(OUT + "/routes-static.csv", csv(rows));
console.log("pages", rows.length, "apis", apiRows.length, "middleware", mw, "unlinked pages:", rows.filter((r) => r.linkedFrom === 0).map((r) => r.route).join(" "));
