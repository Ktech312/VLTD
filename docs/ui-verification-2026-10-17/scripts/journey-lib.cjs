// Helpers for the one-collector-journey check (synthetic account only; removed by journey-cleanup.cjs).
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/qa-chrome";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { launch } = require("./cdp.cjs");
const env = require("../qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MANIFEST = path.join(__dirname, "qa_journey.json");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const man = () => JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

// One browser. withSession: true injects the QA account's session (what a signed-in tab holds); false is a clean visitor.
async function browser(base, { withSession = true, activeProfile, width = 1440, height = 900, mobile = false, creds } = {}) {
  const m = fs.existsSync(MANIFEST) ? man() : null;
  const c = await launch(9700 + Math.floor(Math.random() * 200));
  const { send, evaluate } = c;
  await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  const reqs = [];
  c.on((e) => { if (e.method === "Network.requestWillBeSent") reqs.push({ method: e.params.request.method, url: e.params.request.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 140), host: (() => { try { return new URL(e.params.request.url).hostname; } catch { return ""; } })() }); });
  await send("Page.navigate", { url: base + "/robots.txt" }); await sleep(1500);
  if (withSession && (m || creds)) {
    const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.signInWithPassword({ email: (creds || m).email, password: (creds || m).password });
    if (error) throw error;
    await evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(data.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(activeProfile || (creds ? creds.profileId : m.personalId))}); localStorage.setItem('vltd-theme', 'deep-vault'); true`);
  }
  const S = {
    c, send, evaluate, base, reqs,
    go: (p) => send("Page.navigate", { url: base + p }),
    waitFor: async (expr, timeout = 60000, label = expr) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) { try { if (await evaluate(`(() => { try { return !!(${expr}); } catch { return false; } })()`)) return true; } catch { /* navigating */ } await sleep(250); }
      throw new Error("timeout waiting for: " + String(label).slice(0, 140));
    },
    text: () => evaluate("document.body.innerText"),
    path: () => evaluate("location.pathname + location.search"),
    shot: async (file) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(file, Buffer.from(r.data, "base64")); },
    // click the first button/link whose visible text or aria-label matches (case-insensitive, whole text)
    clickText: (re) => evaluate(`(() => { const re = new RegExp(${JSON.stringify("^(?:" + re + ")$")}, 'i'); const el = [...document.querySelectorAll('button,a,[role="button"],[role="menuitem"],[role="tab"],label')].find((b) => re.test(b.textContent.trim().replace(/\\s+/g, ' ')) || re.test(b.getAttribute('aria-label') || '')); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`),
    clickSel: (sel) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`),
    setVal: (sel, v) => evaluate(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); if (!i) return false; const proto = i.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : i.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`),
    close: () => c.close(),
  };
  return S;
}

module.exports = { browser, admin, sleep, env, MANIFEST, man, fs, path, crypto, createClient };
