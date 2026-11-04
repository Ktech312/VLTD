// Isolated headless Chrome sessions (own profile directory each) for the business-membership checks. Real form sign-in; synthetic accounts only.
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-biz1";
const { launch } = require("../../audit-2026-10-18/scripts/cdp.cjs");
const { fs, sleep } = require("./lib.cjs");

const OPEN = [];
async function closeAll() { for (const s of OPEN.splice(0)) { try { await s.close(); } catch { /* already closed */ } } }
process.on("exit", () => { for (const s of OPEN) { try { s.c.proc.kill(); } catch { /* gone */ } } });
async function open(base, opts = {}) {
  const { width = 1440, height = 900 } = opts;
  const c = await launch(9400 + Math.floor(Math.random() * 400));
  const { send, evaluate } = c;
  await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  const net = []; // supabase requests: method, path, status
  const byId = new Map();
  const errors = [];
  c.on((e) => {
    const p = e.params;
    if (e.method === "Network.requestWillBeSent") {
      try { const u = new URL(p.request.url); if (/supabase\.co$/.test(u.hostname)) byId.set(p.requestId, { method: p.request.method, path: u.pathname.replace(/^\/(rest|auth)\/v1\//, "") + (u.search ? u.search.slice(0, 110) : "") }); } catch { /* ignore */ }
    } else if (e.method === "Network.responseReceived") {
      const r = byId.get(p.requestId); if (r) { r.status = p.response.status; net.push(r); }
    } else if (e.method === "Runtime.consoleAPICalled" && p.type === "error") errors.push((p.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
  });
  // BEFORE the database function is applied to production, answer ONLY the call to rpc/list_member_profiles with what the function
  // returns (same logic as supabase/migrations/20261103_business_member_profiles.sql, proven in PGlite), computed from the real tables
  // with the service key. Every other request goes to the real database untouched. Off unless simulateRpc is set.
  if (opts.simulateRpc) {
    const { admin } = require("./lib.cjs");
    await send("Fetch.enable", { patterns: [{ urlPattern: "*rpc/list_member_profiles*", requestStage: "Request" }] });
    c.on(async (e) => {
      if (e.method !== "Fetch.requestPaused") return;
      const p = e.params;
      let body = "[]";
      try {
        const auth = (p.request.headers.Authorization || p.request.headers.authorization || "").replace(/^Bearer /, "");
        const sub = JSON.parse(Buffer.from(auth.split(".")[1], "base64url").toString()).sub;
        const mem = (await admin.from("profile_members").select("profile_id,role").eq("user_id", sub).in("role", ["admin", "member"])).data || [];
        const ids = mem.map((x) => x.profile_id);
        const prof = ids.length ? (await admin.from("profiles").select("id,user_id,username,display_name,profile_type,bio,avatar_url,avatar_emoji,primary_focus,is_public,created_at,business_type,website,tier,tier_expires_at,tier_source,onboarding_completed").in("id", ids)).data || [] : [];
        const out = prof.filter((x) => x.profile_type === "business" && x.user_id !== sub).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
          .map(({ user_id, ...rest }) => ({ ...rest, member_role: mem.find((x) => x.profile_id === rest.id).role }));
        body = JSON.stringify(out);
      } catch (err) { body = "[]"; if (process.env.QA_DEBUG) console.log("sim error", String(err).slice(0, 200)); }
      if (process.env.QA_DEBUG) console.log("sim answered", body.slice(0, 160));
      send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "access-control-allow-origin", value: "*" }, { name: "access-control-allow-headers", value: "*" }], body: Buffer.from(body).toString("base64") }).catch(() => {});
    });
  }
  let dialogMode = "accept"; const dialogs = [];
  c.on((e) => { if (e.method === "Page.javascriptDialogOpening") { dialogs.push(e.params.message); send("Page.handleJavaScriptDialog", { accept: dialogMode === "accept" }).catch(() => {}); } });
  const S = {
    c, send, evaluate, net, errors, dialogs, base,
    go: async (p) => { await send("Page.navigate", { url: base + p }); await sleep(800); },
    text: () => evaluate("document.body ? document.body.innerText : ''"),
    path: () => evaluate("location.pathname + location.search"),
    waitFor: async (expr, timeout = 30000, label = expr) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await evaluate(`(() => { try { return !!(${expr}); } catch { return false; } })()`)) return true; } catch { /* navigating */ } await sleep(250); } throw new Error("timeout waiting for: " + String(label).slice(0, 140)); },
    settle: async (ms = 2500) => { await sleep(ms); },
    shot: async (file) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(file, Buffer.from(r.data, "base64")); },
    clickText: (re) => evaluate(`(() => { const re = new RegExp(${JSON.stringify("^(?:" + re + ")$")}, 'i'); const el = [...document.querySelectorAll('button,a,[role="button"],[role="menuitem"],[role="tab"],[role="option"],label')].find((b) => re.test(b.textContent.trim().replace(/\\s+/g, ' ')) || re.test(b.getAttribute('aria-label') || '')); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`),
    setVal: (sel, v) => evaluate(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); if (!i) return false; const proto = i.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`),
    // the real sign-in form
    login: async (email, password) => {
      await S.go("/login");
      await S.waitFor("document.querySelector('input[type=email]')", 90000, "login form");
      for (let attempt = 0; attempt < 6; attempt++) {
        await sleep(3000); // let the page finish loading before typing
        await S.setVal("input[type=email]", email); await S.setVal("input[type=password]", password);
        await S.clickText("Sign in|Log in|Sign In|Continue|Login");
        try { await S.waitFor("!location.pathname.startsWith('/login')", 15000, "left /login"); break; } catch { if (attempt === 5) throw new Error("sign-in did not complete"); }
      }
      await sleep(2500);
    },
    activeProfile: () => evaluate("localStorage.getItem('vltd_active_profile_id_v1')"),
    setActive: (id) => evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(id)})`),
    take: () => { const x = net.splice(0, net.length); return x; },
    close: () => c.close(),
  };
  OPEN.push(S);
  return S;
}
module.exports = { open, closeAll };
