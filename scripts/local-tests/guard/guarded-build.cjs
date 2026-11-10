// Builds the app for LOCAL TESTING only, and refuses to do it with production configuration.
//   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=sim-anon-key node scripts/local-tests/guard/guarded-build.cjs
// 1. The database address must be a loopback address and the key must be the simulator's: otherwise nothing is built (exit 2).
// 2. Provider/service secrets set in the environment are blanked for the build, so none can be baked in.
// 3. After the build, the bundle is searched for the real address (read from .env.local) and any *.supabase.co host; if one is found the build marker is NOT written and the build is deleted (exit 3).
// start-local.cjs refuses to start a build that has no marker.
const fs = require("node:fs"), path = require("node:path"), { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../../.."), marker = path.join(root, ".next", "LOCAL_TEST_BUILD.json");
const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || ""), key = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
const fail = (code, msg) => { console.error("[guarded-build] REFUSED: " + msg); process.exit(code); };
let host = ""; try { host = new URL(url).hostname; } catch { /* handled below */ }
if (!/^(localhost|127\.0\.0\.1)$/.test(host)) fail(2, "NEXT_PUBLIC_SUPABASE_URL must be a loopback address (for example http://localhost:54321), got '" + (url ? host || "unparseable" : "nothing") + "'. A test build must never carry the production database address.");
if (key !== "sim-anon-key") fail(2, "NEXT_PUBLIC_SUPABASE_ANON_KEY must be the simulator key 'sim-anon-key'.");
const strip = {};
for (const k of Object.keys(process.env)) if (/(SERVICE_ROLE|SECRET|STRIPE|OPENAI|ANTHROPIC|RESEND|SENDGRID|TWILIO|PSA_|WEBHOOK|SMTP|API_KEY|TOKEN)/i.test(k) && k !== "NEXT_PUBLIC_SUPABASE_ANON_KEY") strip[k] = "";
try { fs.rmSync(marker, { force: true }); } catch { /* none */ }
const env = { ...process.env, ...strip, NEXT_TELEMETRY_DISABLED: "1" };
console.log("[guarded-build] building against " + url + (Object.keys(strip).length ? " (blanked in this build: " + Object.keys(strip).join(", ") + ")" : ""));
const r = spawnSync(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "build", "--webpack"], { cwd: root, env, stdio: "inherit" });
if (r.status !== 0) fail(r.status || 1, "next build failed");
const realHosts = new Set();
for (const f of [".env.local", ".env", ".env.production"]) {
  const p = path.join(root, f); if (!fs.existsSync(p)) continue;
  for (const m of fs.readFileSync(p, "utf8").matchAll(/^[A-Z0-9_]*SUPABASE_URL\s*=\s*"?([^"\r\n]+)"?/gm)) { try { realHosts.add(new URL(m[1]).hostname); } catch { /* ignore */ } }
}
const needles = [...realHosts].filter((h) => !/^(localhost|127\.0\.0\.1)$/.test(h)); const hits = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name === "cache") continue; walk(p); continue; }
    if (!/\.(js|json|html|rsc|txt|map|body)$/.test(e.name)) continue;
    let t; try { t = fs.readFileSync(p, "utf8"); } catch { continue; }
    for (const n of needles) if (t.includes(n)) hits.push(path.relative(root, p) + " -> <real host>");
    if (/[a-z0-9]{15,}\.supabase\.co/.test(t)) hits.push(path.relative(root, p) + " -> *.supabase.co");
  }
})(path.join(root, ".next"));
if (hits.length) { fs.rmSync(path.join(root, ".next"), { recursive: true, force: true }); fail(3, "the real database address was found in the build output (" + hits.slice(0, 3).join("; ") + "). The build was deleted."); }
fs.writeFileSync(marker, JSON.stringify({ url, builtAt: new Date().toISOString(), searchedFor: needles.length + " real host(s) from the env files, and *.supabase.co", clean: true }));
console.log("[guarded-build] OK: build contains no real database address; marker written.");
