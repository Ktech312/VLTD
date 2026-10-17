// Shared helpers for the item / Share / Home checks (synthetic QA account only).
const fs = require("fs");
const { launch } = require("./cdp.cjs");
const env = require("../qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qa = JSON.parse(fs.readFileSync(__dirname + "/qa_ui.json", "utf8"));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function session(base, { width = 1440, height = 900, mobile = false, theme = "deep-vault", downloads } = {}) {
  const c = await launch(9800 + Math.floor(Math.random() * 150));
  const { send, evaluate } = c;
  await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  if (downloads) { fs.mkdirSync(downloads, { recursive: true }); await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads.replace(/\//g, "\\"), eventsEnabled: true }); }
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: qa.email, password: qa.password });
  if (error) throw error;
  await send("Page.navigate", { url: base + "/robots.txt" }); await sleep(1500);
  await evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(data.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(qa.profileId)}); localStorage.setItem('vltd-theme', ${JSON.stringify(theme)}); true`);
  const S = {
    c, send, evaluate, base,
    go: async (path) => { await send("Page.navigate", { url: base + path }); },
    waitFor: async (expr, timeout = 60000, label = expr) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) { try { const v = await evaluate(`(() => { try { return !!(${expr}); } catch { return false; } })()`); if (v) return true; } catch { /* page busy or navigating */ } await sleep(250); }
      throw new Error("timeout waiting for: " + String(label).slice(0, 120));
    },
    shot: async (file, clip) => { const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); fs.writeFileSync(file, Buffer.from(r.data, "base64")); },
    // Bounding box (page coordinates) of the smallest wide container that holds a text, for cropped screenshots.
    boxOf: async (textRe, minW = 500) => evaluate(`(() => { const re = new RegExp(${JSON.stringify(textRe)}, 'i'); const all = [...document.querySelectorAll('h1,h2,h3,div,span,p')]; const hit = all.find((e) => e.children.length === 0 && re.test(e.textContent.trim()) ); if (!hit) return null; let el = hit; for (let i = 0; i < 8 && el.parentElement; i++) { const cl = String(el.className || ""); if ((cl.includes("rounded-[24px]") || cl.includes("rounded-[18px]") || el.tagName === "SECTION") && el.getBoundingClientRect().width >= ${minW}) break; el = el.parentElement; } const r = el.getBoundingClientRect(); return { x: Math.max(0, r.left + scrollX), y: r.top + scrollY, width: r.width, height: r.height }; })()`),
    // Scrolls the container holding a text to the top of the screen (the page scrolls inside a wrapper, so window.scrollTo does nothing).
    reveal: async (textRe, minW = 500) => evaluate(`(() => { const re = new RegExp(${JSON.stringify(textRe)}, 'i'); const all = [...document.querySelectorAll('h1,h2,h3,div,span,p')]; const hit = all.find((e) => e.children.length === 0 && re.test(e.textContent.trim())); if (!hit) return null; let el = hit; for (let i = 0; i < 8 && el.parentElement; i++) { const cl = String(el.className || ""); if ((cl.includes("rounded-[24px]") || cl.includes("rounded-[18px]") || el.tagName === "SECTION") && el.getBoundingClientRect().width >= ${minW}) break; el = el.parentElement; } el.scrollIntoView({ block: 'start' }); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`),
    click: async (selectorOrText) => evaluate(`(() => { const q = ${JSON.stringify(selectorOrText)}; let el = null; if (q.startsWith('text:')) { const re = new RegExp('^' + q.slice(5) + '$', 'i'); el = [...document.querySelectorAll('button,a,[role="button"]')].find((b) => re.test(b.textContent.trim().replace(/\\s+/g, ' ')) || re.test(b.getAttribute('aria-label') || '')); } else el = document.querySelector(q); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`),
    close: () => c.close(),
  };
  return S;
}

module.exports = { session, qa, admin, sleep, env };
