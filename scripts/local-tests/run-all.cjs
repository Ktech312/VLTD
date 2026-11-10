// Runs the local regression tests one after another against the simulated database (it is reset before each test) and prints a summary.
// Usage: node scripts/local-tests/run-all.cjs [name-fragment ...]   (needs the local build on :3100 and sim-supabase on :54321; see README.md)
// Default-deny: a test FAILS if its browser tried to reach a non-local host (guard/browser-blocked.log), and the run FAILS if the app server tried to leave the machine
// (guard/outbound-blocked.log, written by the outbound guard that start-local.cjs loads). Both are attempts that were refused, never made.
const { spawnSync } = require("child_process"); const path = require("path"); const fs = require("fs");
const SIM = process.env.SIM_URL || "http://localhost:54321";
const BLOCKED_BROWSER = path.join(__dirname, "guard", "browser-blocked.log"), BLOCKED_SERVER = process.env.LOCAL_TEST_BLOCKED_LOG || path.join(__dirname, "guard", "outbound-blocked.log");
const TESTS = ["guard-selftest","traffic-guards","seasonal-theme","lounge-post","lounge-reply-vote-remove","lounge-remove-own-only","marketplace","marketplace-sort","add-item-photo-refused","add-item-photo-save-hardening","offline-photo-recovery","pending-photo-recovery","save-failures","documents","documents-recovery","exhibition-privacy","business-permissions","financial-consistency","add-item-fields","dialogs-keyboard","outage-states","outage-integrity","api-guards","frames-and-insights-defaults"]; // phone-layouts, contrast, automatic-requests, upload-timeout and the inspection scripts are run on their own (they take several minutes)
const only = process.argv.slice(2); const list = only.length ? TESTS.filter((t) => only.some((o) => t.includes(o))) : TESTS; const rows = [];
let KNOWN = {}; try { KNOWN = JSON.parse(fs.readFileSync(path.join(__dirname, "guard", "known-refused.json"), "utf8")); } catch { /* none */ }
const lines = (f) => { try { return fs.readFileSync(f, "utf8").split("\n").filter(Boolean); } catch { return []; } };
async function resetSim() { /* a long test can leave a stale keep-alive socket: retry, and say so */ for (let i = 0; i < 4; i++) { try { await fetch(SIM + "/__sim/reset", { headers: { connection: "close" } }); return; } catch (e) { if (i === 3) { console.error("simulated database not reachable at " + SIM + " (" + String((e && e.cause && e.cause.code) || (e && e.message)) + ")"); process.exit(2); } await new Promise((r) => setTimeout(r, 1500)); } } }
(async () => {
  for (const t of list) {
    await resetSim();
    try { fs.writeFileSync(BLOCKED_BROWSER, ""); } catch { /* ignore */ }
    const r = spawnSync(process.execPath, [path.join(__dirname, t + ".cjs")], { encoding: "utf8", timeout: 1500000, env: { ...process.env, LOCAL_TEST_BROWSER_BLOCKED_LOG: BLOCKED_BROWSER } });
    const out = (r.stdout || "") + (r.stderr || ""); const last = out.split("\n").reverse().find((l) => l.startsWith("{") && l.includes('"pass"'));
    let res = null; try { res = JSON.parse(last); } catch { /* no result */ }
    const blocked = [...new Set(lines(BLOCKED_BROWSER).map((l) => { try { return JSON.parse(l).host; } catch { return "?"; } }))];
    const summary = res ? res.pass + " pass, " + res.fail + " fail" + (res.fail ? " (" + res.failures.join("; ") + ")" : "") : "NO RESULT";
    const unknown = blocked.filter((h) => !KNOWN[h]), known = blocked.filter((h) => KNOWN[h]);
    rows.push([t, unknown.length ? "BLOCKED EXTERNAL REQUESTS to " + unknown.join(", ") + " (test result: " + summary + ")" : summary + (known.length ? "  [refused, known: " + known.join(", ") + "]" : "")]);
    console.log("[" + rows[rows.length - 1][0] + "] " + rows[rows.length - 1][1]);
    if (!res || res.fail || unknown.length) console.log(out.split("\n").filter((l) => /FAIL|Error|local-test-guard/.test(l)).slice(0, 6).join("\n"));
  }
  const serverBlocked = lines(BLOCKED_SERVER);
  if (serverBlocked.length) rows.push(["local server outbound guard", "BLOCKED " + serverBlocked.length + " attempt(s) by the app server to leave the machine: " + [...new Set(serverBlocked.map((l) => { try { const j = JSON.parse(l); return j.host + ":" + j.port; } catch { return "?"; } }))].join(", ")]);
  console.log("\n" + rows.map(([a, b]) => a.padEnd(34) + b).join("\n")); process.exit(rows.some(([, b]) => /fail \(|NO RESULT|BLOCKED/.test(b)) ? 1 : 0);
})();
