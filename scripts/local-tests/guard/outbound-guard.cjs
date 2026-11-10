// Default-deny outbound network guard for the LOCAL TEST SERVER (testing infrastructure only; never loaded by the production app).
// Loaded with NODE_OPTIONS=--require=<this file>. Every TCP connection the server process (fetch, http, https, tls) tries to open is checked here: only a loopback address on a port
// listed in LOCAL_TEST_ALLOW_PORTS (default "3100,54321": the app itself and the simulated database) is allowed. Anything else is REFUSED with an error that names the destination,
// printed to the server's output, and appended to the file in LOCAL_TEST_BLOCKED_LOG so the test runner can fail the run. Nothing external is ever contacted: the refusal happens before any DNS lookup or connection.
// Pipes / unix sockets (used between Node's own processes) are allowed; they cannot leave the machine.
const net = require("node:net"), fs = require("node:fs"), path = require("node:path");
const ALLOW = new Set(String(process.env.LOCAL_TEST_ALLOW_PORTS || "3100,54321").split(",").map((s) => s.trim()).filter(Boolean));
const LOG = process.env.LOCAL_TEST_BLOCKED_LOG || path.join(__dirname, "outbound-blocked.log");
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", ""]);
const orig = net.Socket.prototype.connect;
// Node passes either the raw arguments or an already-normalised [options, callback] array to Socket.connect.
function target(args) { try { if (Array.isArray(args[0])) return args[0][0] || {}; const [opts] = net._normalizeArgs(args); return opts || {}; } catch { return { host: "unparseable", port: 0 }; } }
net.Socket.prototype.connect = function guardedConnect(...args) {
  const o = target(args);
  if (o.path) return orig.apply(this, args); // pipe / unix socket
  const host = String(o.host ?? "localhost").toLowerCase(), port = String(o.port ?? "");
  if (LOOPBACK.has(host) && ALLOW.has(port)) return orig.apply(this, args);
  const line = JSON.stringify({ at: new Date().toISOString(), host, port, pid: process.pid, allowedPorts: [...ALLOW] });
  try { fs.appendFileSync(LOG, line + "\n"); } catch { /* the console message below still shows it */ }
  const err = new Error("OUTBOUND BLOCKED by the local test guard: " + host + ":" + port + " is not an allowed local test service (allowed loopback ports: " + [...ALLOW].join(", ") + ")");
  err.code = "LOCAL_TEST_OUTBOUND_BLOCKED"; console.error("[local-test-guard] " + err.message);
  process.nextTick(() => this.destroy(err)); return this;
};
module.exports = { allowedPorts: [...ALLOW], log: LOG };
