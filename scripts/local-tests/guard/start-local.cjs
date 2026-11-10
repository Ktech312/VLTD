// Starts the local production server for testing, behind the outbound guard. Refuses unless the build carries the marker written by guarded-build.cjs (so a build made with production
// configuration cannot be started by mistake), and refuses if the environment points anywhere but the simulator the build was made for.
//   node scripts/local-tests/guard/start-local.cjs   (port 3100; LOCAL_TEST_ALLOW_PORTS to change what may be contacted; blocked attempts are listed in guard/outbound-blocked.log)
const fs = require("node:fs"), path = require("node:path"), { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "../../.."), markerPath = path.join(root, ".next", "LOCAL_TEST_BUILD.json");
const fail = (msg) => { console.error("[start-local] REFUSED: " + msg); process.exit(2); };
let marker; try { marker = JSON.parse(fs.readFileSync(markerPath, "utf8")); } catch { fail("this build has no local-test marker. Build it with scripts/local-tests/guard/guarded-build.cjs."); }
if (!marker.clean) fail("the build marker does not say clean.");
const port = String(process.env.LOCAL_PORT || "3100"), url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || marker.url);
if (url !== marker.url || !/^http:\/\/(localhost|127\.0\.0\.1):/.test(url)) fail("the database address must be the simulator the build was made for (" + marker.url + "), got " + url);
const log = process.env.LOCAL_TEST_BLOCKED_LOG || path.join(__dirname, "outbound-blocked.log"); try { fs.writeFileSync(log, ""); } catch { /* ignore */ }
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: marker.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sim-anon-key", NEXT_TELEMETRY_DISABLED: "1", LOCAL_TEST_ALLOW_PORTS: process.env.LOCAL_TEST_ALLOW_PORTS || port + ",54321", LOCAL_TEST_BLOCKED_LOG: log, NODE_OPTIONS: ((process.env.NODE_OPTIONS || "") + " --require=" + path.join(__dirname, "outbound-guard.cjs")).trim() };
for (const k of Object.keys(env)) if (/(SERVICE_ROLE|SECRET|STRIPE|OPENAI|ANTHROPIC|RESEND|SENDGRID|TWILIO|PSA_|WEBHOOK|SMTP|API_KEY)/i.test(k) && !/^NEXT_PUBLIC_/.test(k)) env[k] = "";
console.log("[start-local] http://localhost:" + port + " behind the outbound guard; allowed: loopback ports " + env.LOCAL_TEST_ALLOW_PORTS + "; blocked attempts are logged to " + log);
spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", port], { cwd: root, env, stdio: "inherit" }).on("exit", (c) => process.exit(c ?? 0));
