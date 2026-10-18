const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const getJson = (url) => new Promise((res, rej) => http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on("error", rej));
const net = require("net");
const freePort = () => new Promise((res) => { const sv = net.createServer(); sv.listen(0, "127.0.0.1", () => { const p = sv.address().port; sv.close(() => res(p)); }); });
const answers = (port) => new Promise((res) => { const r = http.get(`http://127.0.0.1:${port}/json/version`, (x) => { x.resume(); res(true); }); r.on("error", () => res(false)); r.setTimeout(800, () => { r.destroy(); res(false); }); });
let launchCount = 0;
async function launch(port = 9333, userDir = process.env.CHROME_PROFILE_ROOT ? path.join(process.env.CHROME_PROFILE_ROOT, "p" + (Date.now() % 1e7) + "-" + ++launchCount) : path.join(__dirname, "chrome-profile-" + Date.now() + "-" + process.pid + "-" + ++launchCount)) {
  // A browser left over from an earlier (killed) run may still be listening on this port: the new browser would fail to start and a
  // test would silently drive the old one. Take a port nobody is using instead, and say so.
  if (await answers(port)) { const next = await freePort(); console.log(`[cdp] port ${port} was already answered by an earlier browser; using ${next}`); port = next; }
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`, "--no-first-run", "--no-default-browser-check",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--window-size=1400,900", ...(process.env.CHROME_EXTRA ? process.env.CHROME_EXTRA.split(" ") : []), "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) { try { await getJson(`http://127.0.0.1:${port}/json/version`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const targets = await getJson(`http://127.0.0.1:${port}/json`);
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pending = new Map(); const listeners = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method) for (const l of listeners) l(m);
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error("CDP timeout: " + method)); } }, 45000); });
  const on = (fn) => listeners.push(fn);
  // What the page, the sign-in and the network looked like, kept small and free of tokens and item content, so a page that does not
  // appear in time can be explained afterwards instead of re-run.
  const diag = { requests: new Map(), failures: [], errors: [], navigations: [] };
  on((m) => {
    if (m.method === "Network.requestWillBeSent") {
      try {
        const u = new URL(m.params.request.url);
        if (/supabase\.co$/.test(u.hostname) && diag.requests.size < 400) {
          const h = m.params.request.headers || {}; const auth = h.Authorization || h.authorization || ""; const key = h.apikey || h.Apikey || "";
          diag.requests.set(m.params.requestId, { method: m.params.request.method, table: u.pathname.split("/").pop(), auth: !auth ? "none" : auth === "Bearer " + key ? "anon-key" : "user-jwt" });
        }
      } catch { /* not a url */ }
    } else if (m.method === "Network.responseReceived") {
      const r = diag.requests.get(m.params.requestId); if (r) { r.status = m.params.response.status; r.range = (m.params.response.headers || {})["content-range"]; }
    } else if (m.method === "Network.loadingFailed") {
      const r = diag.requests.get(m.params.requestId); if (diag.failures.length < 100) diag.failures.push({ table: r?.table, error: m.params.errorText, canceled: !!m.params.canceled });
    } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      if (diag.errors.length < 60) diag.errors.push(String((m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ")).slice(0, 160));
    } else if (m.method === "Runtime.exceptionThrown") {
      if (diag.errors.length < 60) diag.errors.push("EXC " + String(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text).slice(0, 160));
    } else if (m.method === "Page.frameNavigated" && !m.params.frame.parentId) {
      try { if (diag.navigations.length < 60) diag.navigations.push(new URL(m.params.frame.url).pathname); } catch { /* ignore */ }
    }
  });
  async function captureDiag(reason, label = "diag") {
    let state = null;
    try {
      state = JSON.parse(await Promise.race([evaluate(`(() => { let a = null; try { a = JSON.parse(localStorage.getItem('vltd-auth') || 'null'); } catch {} const t = document.body ? document.body.innerText : ''; return JSON.stringify({ path: location.pathname, hasSession: !!(a && a.access_token), userIdPrefix: a && a.user ? String(a.user.id).slice(0, 8) : null, expiresInSec: a && a.expires_at ? a.expires_at - Math.floor(Date.now() / 1000) : null, hasRefreshToken: !!(a && a.refresh_token), activeProfilePrefix: String(localStorage.getItem('vltd_active_profile_id_v1') || '').slice(0, 8), lsKeyCount: Object.keys(localStorage).length, bodyStart: t.slice(0, 220).replace(/\\s+/g, ' '), searchInput: !!document.querySelector('[aria-label="Search the vault"]'), itemLinks: document.querySelectorAll('main a[href^="/vault/item/"]').length, readyState: document.readyState }); })()`), new Promise((r) => setTimeout(() => r('"page did not answer in 10 s"'), 10000))]));
    } catch (e) { state = { error: String(e).slice(0, 120) }; }
    const out = { reason, at: new Date().toISOString(), port, state, supabaseRequests: [...diag.requests.values()].slice(-60), failures: diag.failures, errors: diag.errors, navigations: diag.navigations };
    try { fs.writeFileSync(path.join(__dirname, `${label}-${Date.now()}.json`), JSON.stringify(out, null, 1)); } catch { /* ignore */ }
    return out;
  }
  async function evaluate(expr, awaitPromise = true) {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async function close() { try { await send("Browser.close"); } catch {} try { ws.close(); } catch {} try { proc.kill(); } catch {} }
  return { send, on, evaluate, close, proc, userDir, captureDiag, diag, port };
}
module.exports = { launch };
