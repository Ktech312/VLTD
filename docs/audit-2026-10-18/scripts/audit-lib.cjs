// Shared helpers for the 2026-10-18 audit: sessions in each state, side-effect stubs and interception, settling, control inventory, result rows.
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, admin, sleep, man, fs, path, MANIFEST } = require("./journey-lib.cjs");
const REPO = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28";
const AUD = REPO + "/docs/audit-2026-10-18";
fs.mkdirSync(AUD + "/shots", { recursive: true });
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);

// Requests that would spend money, send mail, change the account's credentials or notify real people are answered by the audit, never sent.
const INTERCEPT = ["*/api/ai/*", "*/api/billing/*", "*/api/auth/*", "*/api/newsletter*", "*/api/waitlist*", "*/api/push/*", "*/api/clubs/notify*", "*/api/launch-access*", "*/api/admin/*", "*/api/card-lookup*", "*/api/psa-lookup*", "*/api/upc-lookup*", "*/api/comic-lookup*", "*/api/vinyl-lookup*", "*supabase.co/auth/v1/*", "*supabase.co/functions/v1/*"];
const PASS_THROUGH = [/supabase\.co\/auth\/v1\/token/, /supabase\.co\/auth\/v1\/user$/];

const INIT = `(() => {
  if (window.__aud) return;
  window.__aud = { print: 0, opens: [], share: 0, shared: null, clip: [], downloads: [], blobs: [], dialogs: [] };
  window.print = () => { window.__aud.print++; };
  window.open = (u) => { window.__aud.opens.push(String(u)); return null; };
  try { Object.defineProperty(navigator, 'share', { value: async (d) => { window.__aud.share++; window.__aud.shared = { title: d && d.title, url: d && d.url }; }, configurable: true }); } catch (e) {}
  try { Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true }); } catch (e) {}
  try { if (navigator.clipboard) navigator.clipboard.writeText = async (t) => { window.__aud.clip.push(String(t).slice(0, 120)); }; } catch (e) {}
  document.addEventListener('click', (e) => { const a = e.target && e.target.closest && e.target.closest('a[download]'); if (a) { window.__aud.downloads.push(a.getAttribute('download') || a.href); e.preventDefault(); } }, true);
  const cou = URL.createObjectURL; URL.createObjectURL = function (b) { try { window.__aud.blobs.push({ type: b && b.type, size: b && b.size }); } catch (e) {} return cou.call(URL, b); };
})();`;

async function session(kind, { width = 1440, height = 900, mobile = false } = {}) {
  const m = man();
  const opts = { width, height, mobile };
  if (kind === "visitor") opts.withSession = false;
  else if (kind === "owner") opts.creds = { email: m.email, password: m.password, profileId: m.personalId };
  else if (kind === "business") { opts.creds = { email: m.email, password: m.password, profileId: m.businessId }; opts.activeProfile = m.businessId; }
  else if (kind === "viewer") opts.creds = m.k;
  else if (kind === "onboard") opts.creds = m.c;
  const S = await browser(BASE, opts);
  S.kind = kind; S.intercepted = []; S.dialogs = []; S.dialogMode = "dismiss"; S.inflight = 0; S.lastNet = Date.now(); S.consoleErrors = []; S.badResponses = [];
  await S.send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
  await S.send("Page.enable"); await S.send("Network.enable"); await S.send("Runtime.enable");
  await S.send("Fetch.enable", { patterns: INTERCEPT.map((urlPattern) => ({ urlPattern })) });
  const reqUrl = new Map();
  S.c.on((e) => {
    const p = e.params;
    if (e.method === "Fetch.requestPaused") {
      const url = p.request.url;
      if (process.env.AUDIT_ALLOW_SIGNOUT === '1' && url.includes("supabase.co/auth/v1/logout")) { S.send('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {}); S.signoutPassed = (S.signoutPassed || 0) + 1; return; }
      if (PASS_THROUGH.some((re) => re.test(url)) && !(p.request.method === "PUT" || p.request.method === "PATCH" || p.request.method === "DELETE")) { S.send("Fetch.continueRequest", { requestId: p.requestId }).catch(() => {}); return; }
      S.intercepted.push({ method: p.request.method, url: url.replace(/^https?:\/\/[^/]+/, "").slice(0, 120), host: (() => { try { return new URL(url).hostname; } catch { return ""; } })() });
      S.send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 503, responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "access-control-allow-origin", value: "*" }], body: Buffer.from('{"error":"intercepted by audit"}').toString("base64") }).catch(() => {});
    } else if (e.method === "Network.requestWillBeSent") { if (p.type !== "WebSocket" && p.type !== "EventSource") { S.inflight++; reqUrl.set(p.requestId, p.request.url); S.lastNet = Date.now(); } }
    else if (e.method === "Network.loadingFinished" || e.method === "Network.loadingFailed") { if (reqUrl.delete(p.requestId)) { S.inflight = Math.max(0, S.inflight - 1); S.lastNet = Date.now(); } }
    else if (e.method === "Network.responseReceived") {
      const st = p.response.status; const u = p.response.url;
      if (st >= 400 && !/intercepted/.test(u) && (/vltd|supabase/.test(u)) && S.badResponses.length < 200) S.badResponses.push({ status: st, url: u.replace(/^https?:\/\/[^/]+/, "").slice(0, 110), host: (() => { try { return new URL(u).hostname.slice(0, 20); } catch { return ""; } })() });
    } else if (e.method === "Runtime.consoleAPICalled" && p.type === "error") { if (S.consoleErrors.length < 100) S.consoleErrors.push((p.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200)); }
    else if (e.method === "Runtime.exceptionThrown") { if (S.consoleErrors.length < 100) S.consoleErrors.push("EXC " + String(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text).slice(0, 200)); }
    else if (e.method === "Page.javascriptDialogOpening") {
      S.dialogs.push({ type: p.type, message: String(p.message).slice(0, 160) });
      S.send("Page.handleJavaScriptDialog", { accept: S.dialogMode === "accept", promptText: "" }).catch(() => {});
    }
  });
  S.settle = async ({ max = 30000, quiet = 900, minText = 30 } = {}) => {
    const t0 = Date.now();
    while (Date.now() - t0 < max) {
      let ok = false;
      try { ok = await S.evaluate(`document.readyState !== 'loading' && (document.body ? document.body.innerText.length : 0) >= ${minText}`); } catch { ok = false; }
      if (ok && S.inflight <= 2 && Date.now() - S.lastNet >= quiet) { await sleep(400); return true; }
      await sleep(250);
    }
    return false;
  };
  S.visit = async (p) => { S.consoleErrors.length = 0; S.badResponses.length = 0; await S.go(p); await sleep(600); const ok = await S.settle(); return ok; };
  S.look = async () => S.evaluate("window.__aud ? JSON.parse(JSON.stringify(window.__aud)) : null").catch(() => null);
  S.jshot = async (name, { full = false } = {}) => {
    const file = `${AUD}/shots/${name}.jpg`;
    try {
      let clip;
      if (full) { const dims = await S.evaluate("({ w: Math.max(document.documentElement.scrollWidth, innerWidth), h: Math.min(Math.max(document.documentElement.scrollHeight, innerHeight), 2400) })"); await S.send("Emulation.setDeviceMetricsOverride", { width: S._w, height: dims.h, deviceScaleFactor: 1, mobile: S._mobile }); await sleep(500); }
      const r = await S.send("Page.captureScreenshot", { format: "jpeg", quality: 62, ...(clip ? { clip } : {}) });
      if (full) await S.send("Emulation.setDeviceMetricsOverride", { width: S._w, height: S._h, deviceScaleFactor: 1, mobile: S._mobile });
      fs.writeFileSync(file, Buffer.from(r.data, "base64"));
      return `shots/${name}.jpg`;
    } catch (e) { return ""; }
  };
  S._w = width; S._h = height; S._mobile = mobile;
  return S;
}

// Everything on the page a person could try: with the label they see, where it leads, and whether it is shown and enabled.
const CONTROLS_JS = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const label = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || el.getAttribute('placeholder') || el.getAttribute('alt') || (el.querySelector && el.querySelector('img') && el.querySelector('img').alt) || '').replace(/\\s+/g, ' ').trim().slice(0, 70);
  const region = (el) => { const r = el.closest('dialog,[role=dialog],[role=menu],nav,header,aside,footer,main,form,[data-vault-chrome],[role=tablist]'); return r ? (r.getAttribute('role') || r.tagName.toLowerCase()) : 'page'; };
  const out = []; const seen = new Set(); let n = 0;
  const add = (el, kind) => { if (seen.has(el)) return; seen.add(el); const id = 'a' + (n++); el.setAttribute('data-aud', id); out.push({ id, kind, label: label(el), href: el.getAttribute && el.getAttribute('href') || '', target: el.getAttribute && el.getAttribute('target') || '', type: el.getAttribute && (el.getAttribute('type') || el.getAttribute('role') || ''), disabled: !!(el.disabled || el.getAttribute('aria-disabled') === 'true'), visible: vis(el), region: region(el), pressed: el.getAttribute('aria-pressed') || el.getAttribute('aria-expanded') || el.getAttribute('aria-selected') || el.getAttribute('aria-current') || '', tag: el.tagName.toLowerCase() }); };
  document.querySelectorAll('a[href]').forEach((e) => add(e, 'link'));
  document.querySelectorAll('button,[role=button],summary').forEach((e) => add(e, 'button'));
  document.querySelectorAll('[role=tab]').forEach((e) => add(e, 'tab'));
  document.querySelectorAll('[role=menuitem],[role=option]').forEach((e) => add(e, 'menuitem'));
  document.querySelectorAll('[role=switch],input[type=checkbox],input[type=radio]').forEach((e) => add(e, 'toggle'));
  document.querySelectorAll('select').forEach((e) => add(e, 'select'));
  document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea').forEach((e) => add(e, e.type === 'file' ? 'upload' : e.type === 'search' ? 'search' : 'input'));
  document.querySelectorAll('[tabindex]:not([tabindex="-1"])').forEach((e) => { if (!seen.has(e) && !e.closest('a,button')) add(e, 'focusable'); });
  // things that look clickable but are not a link or button
  document.querySelectorAll('div,span,li,article,section,img,svg,td,tr,p,h2,h3').forEach((e) => { if (seen.has(e) || e.closest('a,button,[role=button],summary,select,label')) return; if (getComputedStyle(e).cursor === 'pointer' && vis(e)) add(e, 'card-clickable'); });
  return out;
})()`;
async function controls(S) { return S.evaluate(CONTROLS_JS).catch(() => []); }

// result rows
const ROWS = AUD + "/rows.jsonl";
function nextId(area) { const f = AUD + "/counters-" + area + ".txt"; let n = 0; try { n = Number(fs.readFileSync(f, "utf8")) || 0; } catch {} n++; fs.writeFileSync(f, String(n)); return `${area}-${String(n).padStart(3, "0")}`; }
function row(area, r) { const o = { id: r.id || nextId(area), area, page: r.page || "", control: r.control || "", expected: r.expected || "", actual: r.actual || "", result: r.result, evidence: r.evidence || "", impact: r.impact || "", repro: r.repro || "", at: new Date().toISOString() }; fs.appendFileSync(ROWS, JSON.stringify(o) + "\n"); console.log(o.result.padEnd(10), o.id, "|", o.page, "|", o.control, "|", String(o.actual).slice(0, 140)); return o; }
const R = (area) => ({
  pass: (r) => row(area, { ...r, result: "PASS" }),
  fail: (r) => row(area, { ...r, result: "FAIL" }),
  blocked: (r) => row(area, { ...r, result: "BLOCKED" }),
  nt: (r) => row(area, { ...r, result: "NOT TESTED" }),
  check: (ok, r) => row(area, { ...r, result: ok ? "PASS" : "FAIL" }),
});
module.exports = { session, controls, CONTROLS_JS, row, R, AUD, REPO, BASE, admin, sleep, man, fs, path, MANIFEST };
