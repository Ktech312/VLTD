// Small helper for the exhibition-sharing check. Own isolated headless Chrome per role; never EK's browser.
const path = require("path");
const SC = path.resolve(__dirname, "../../audit-2026-10-18/scripts");
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-shr";
process.env.AUDIT_MANIFEST = process.env.AUDIT_MANIFEST || path.join(SC, "qa_audit_shr1.json");
const { browser, admin, sleep, man, fs } = require(SC + "/journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3002").slice(7);
const EVID = path.resolve(__dirname, "../evidence");

// kind: owner | viewer (unrelated signed-in QA collector) | visitor (signed out)
async function session(kind, { width = 1440, height = 900 } = {}) {
  const m = man();
  const opts = { width, height };
  if (kind === "visitor") opts.withSession = false;
  else if (kind === "owner" && process.env.SHR_AS === "viewer") opts.creds = m.k;
  else if (kind === "owner") opts.creds = { email: m.email, password: m.password, profileId: m.personalId };
  else if (kind === "viewer") opts.creds = m.k;
  const S = await browser(BASE, opts);
  S.kind = kind; S.net = []; S.errs = [];
  await S.send("Network.enable");
  const bodies = new Map();
  S.c.on((e) => {
    const p = e.params;
    if (e.method === "Network.responseReceived") {
      const u = p.response.url;
      if (/supabase\.co\/(rest|functions)\//.test(u) || /\/api\//.test(u)) {
        const rec = { id: p.requestId, status: p.response.status, url: u.replace(/^https?:\/\/[^/]+/, "").slice(0, 160) };
        S.net.push(rec);
      }
    } else if (e.method === "Network.loadingFinished") {
      const rec = S.net.find((r) => r.id === p.requestId);
      if (rec) S.send("Network.getResponseBody", { requestId: p.requestId }).then((b) => { rec.body = (b.body || "").slice(0, 200000); }).catch(() => {});
    }
  });
  S.sleep = sleep;
  S.settle = async (ms = 6000) => { await sleep(ms); };
  S.visit = async (p) => { S.net.length = 0; await S.go(p); await sleep(1200); await S.waitFor("document.readyState==='complete'", 60000).catch(() => {}); await sleep(5000); };
  S.shotTo = async (name) => { const f = path.join(EVID, name + ".png"); await S.shot(f); return f; };
  // real mouse click at the centre of an in-page element expression
  S.mclick = async (expr, wait = 600) => {
    const get = (scroll) => S.evaluate(`(() => { const el = (${expr}); if (!el) return null; if (${scroll}) el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (!(await get(true))) return false;
    await sleep(200);
    const { x, y } = await get(false);
    await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1 });
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, buttons: 0 });
    await sleep(wait);
    return true;
  };
  S.byText = (txt, tags = "button,a") => `[...document.querySelectorAll(${JSON.stringify(tags)})].find(b => b.textContent.trim() === ${JSON.stringify(txt)})`;
  S.byLabel = (l) => `document.querySelector(${JSON.stringify(`[aria-label="${l}"]`)})`;
  return S;
}
module.exports = { session, admin, sleep, man, fs, BASE, EVID, path };
