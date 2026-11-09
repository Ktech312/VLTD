// Runs the local regression tests one after another against the simulated database (it is reset before each test) and prints a summary.
// Usage: node scripts/local-tests/run-all.cjs [name-fragment ...]   (needs the local build on :3100 and sim-supabase on :54321; see README.md)
const { spawnSync } = require("child_process"); const path = require("path");
const SIM = process.env.SIM_URL || "http://localhost:54321";
const TESTS = ["seasonal-theme", "lounge-post", "lounge-reply-vote-remove", "lounge-remove-own-only", "marketplace", "marketplace-sort", "add-item-photo-refused", "offline-photo-recovery", "frames-and-insights-defaults"];
const only = process.argv.slice(2); const list = only.length ? TESTS.filter((t) => only.some((o) => t.includes(o))) : TESTS; const rows = [];
(async () => {
  for (const t of list) {
    await fetch(SIM + "/__sim/reset").catch(() => { console.error("simulated database not reachable at " + SIM); process.exit(2); });
    const r = spawnSync(process.execPath, [path.join(__dirname, t + ".cjs")], { encoding: "utf8", timeout: 300000 });
    const out = (r.stdout || "") + (r.stderr || ""); const last = out.split("\n").reverse().find((l) => l.startsWith("{") && l.includes('"pass"'));
    let res = null; try { res = JSON.parse(last); } catch {} rows.push([t, res ? res.pass + " pass, " + res.fail + " fail" + (res.fail ? " (" + res.failures.join("; ") + ")" : "") : "NO RESULT"]); if (!res || res.fail) console.log(out.split("\n").filter((l) => /FAIL|Error/.test(l)).slice(0, 6).join("\n"));
  }
  console.log("\n" + rows.map(([a, b]) => a.padEnd(34) + b).join("\n")); process.exit(rows.some(([, b]) => /fail \(|NO RESULT/.test(b)) ? 1 : 0);
})();
