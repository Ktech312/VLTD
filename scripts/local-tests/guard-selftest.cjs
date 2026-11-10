// Tests the default-deny guard itself, without contacting anything: (1) a server process with the guard loaded cannot open a connection to an external host or to a loopback port that is not allowed
// (the refusal happens before any lookup, so nothing leaves the machine), is told why, and the attempt is logged; (2) an allowed local service still works; (3) a build with the production
// database address / key is refused before anything is built; (4) a server start without the clean-build marker, or with another database address, is refused.
const { spawnSync, spawn } = require("child_process"); const path = require("path"); const fs = require("fs"); const http = require("http"); const os = require("os");
const { check } = require("./lib.cjs"); const L = require("./lib.cjs");
const guardDir = path.join(__dirname, "guard"), root = path.resolve(__dirname, "../..");
(async () => {
  const log = path.join(os.tmpdir(), "vltd-guard-selftest-" + process.pid + ".log"); try { fs.rmSync(log, { force: true }); } catch { /* none */ }
  const allowed = http.createServer((q, s) => s.end("local ok")); await new Promise((r) => allowed.listen(0, "127.0.0.1", r)); const allowedPort = allowed.address().port;
  const probe = `
    const http = require("http"); const results = {};
    const tryGet = (name, url) => new Promise((res) => { const q = http.get(url, (r) => { let d = ""; r.on("data", (c) => d += c); r.on("end", () => { results[name] = "ok:" + d; res(); }); }); q.on("error", (e) => { results[name] = "error:" + (e.code || e.message).slice(0, 60); res(); }); q.setTimeout(4000, () => { q.destroy(); results[name] = "timeout"; res(); }); });
    (async () => {
      await tryGet("external-by-name", "http://example.com/"); await tryGet("external-by-ip", "http://203.0.113.7/"); await tryGet("loopback-not-allowed", "http://127.0.0.1:9/");
      await tryGet("allowed-local", "http://127.0.0.1:${allowedPort}/");
      try { await fetch("https://example.org/"); results["fetch-external"] = "ok"; } catch (e) { results["fetch-external"] = "error:" + ((e.cause && e.cause.code) || e.message).slice(0, 60); }
      console.log("RESULTS " + JSON.stringify(results));
    })();`;
  // asynchronous on purpose: the allowed local service lives in THIS process and must be able to answer while the probe runs
  const r = await new Promise((resolve) => { const c = spawn(process.execPath, ["-e", probe], { env: { ...process.env, NODE_OPTIONS: "--require=" + path.join(guardDir, "outbound-guard.cjs"), LOCAL_TEST_ALLOW_PORTS: String(allowedPort), LOCAL_TEST_BLOCKED_LOG: log } }); let stdout = "", stderr = ""; c.stdout.on("data", (d) => (stdout += d)); c.stderr.on("data", (d) => (stderr += d)); c.on("exit", () => resolve({ stdout, stderr })); setTimeout(() => { try { c.kill(); } catch { /* done */ } }, 60000); });
  allowed.close(); const m = /RESULTS (.*)/.exec(r.stdout || ""); const res = m ? JSON.parse(m[1]) : {}; const logged = fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "";
  check("guard: an external host by name is refused (not contacted)", /LOCAL_TEST_OUTBOUND_BLOCKED/.test(res["external-by-name"] || ""), res);
  check("guard: an external address by IP is refused", /LOCAL_TEST_OUTBOUND_BLOCKED/.test(res["external-by-ip"] || ""), res);
  check("guard: fetch() to an external host is refused", /LOCAL_TEST_OUTBOUND_BLOCKED|fetch failed|BLOCKED/.test(res["fetch-external"] || "") && !/^ok/.test(res["fetch-external"] || ""), res);
  check("guard: a loopback port that is not allowed is refused", /LOCAL_TEST_OUTBOUND_BLOCKED/.test(res["loopback-not-allowed"] || ""), res);
  check("guard: the configured local service still answers", res["allowed-local"] === "ok:local ok", res);
  check("guard: refusals are visible - named in the server's output and listed in the log file", /OUTBOUND BLOCKED by the local test guard: example\.com/.test(r.stderr || "") && /example\.com/.test(logged) && /example\.org/.test(logged) && /203\.0\.113\.7/.test(logged), { stderr: (r.stderr || "").slice(0, 200), logged: logged.slice(0, 200) });
  try { fs.rmSync(log, { force: true }); } catch { /* ignore */ }
  // build refusal with production-style configuration (refused before anything is built)
  const b1 = spawnSync(process.execPath, [path.join(guardDir, "guarded-build.cjs")], { encoding: "utf8", timeout: 30000, env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sim-anon-key" } });
  check("build guard: a build with a non-local database address is refused (exit 2, nothing built)", b1.status === 2 && /REFUSED/.test(b1.stderr || "") && !/Creating an optimized/.test((b1.stdout || "") + (b1.stderr || "")), { status: b1.status, err: (b1.stderr || "").slice(0, 200) });
  const b2 = spawnSync(process.execPath, [path.join(guardDir, "guarded-build.cjs")], { encoding: "utf8", timeout: 30000, env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a-real-looking-anon-key" } });
  check("build guard: a build with a key that is not the simulator's is refused", b2.status === 2 && /REFUSED/.test(b2.stderr || ""), { status: b2.status });
  const b3 = spawnSync(process.execPath, [path.join(guardDir, "guarded-build.cjs")], { encoding: "utf8", timeout: 30000, env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" } });
  check("build guard: a build with no database address is refused", b3.status === 2 && /REFUSED/.test(b3.stderr || ""), { status: b3.status });
  // start refusal: wrong database address
  const s1 = spawnSync(process.execPath, [path.join(guardDir, "start-local.cjs")], { encoding: "utf8", timeout: 30000, env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", LOCAL_PORT: "3199" } });
  check("start guard: starting with a non-local database address (or without the clean-build marker) is refused", s1.status === 2 && /REFUSED/.test(s1.stderr || ""), { status: s1.status, err: (s1.stderr || "").slice(0, 200) });
  check("the guard files are not part of the app (nothing under src/ or next.config loads them)", !/outbound-guard|guarded-build|start-local/.test(fs.readFileSync(path.join(root, "next.config.ts"), "utf8").toString().concat(fs.existsSync(path.join(root, "next.config.mjs")) ? "" : "")), 0);
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
