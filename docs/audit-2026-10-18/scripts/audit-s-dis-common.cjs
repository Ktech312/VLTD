// Shared helpers for the DIS audit suites: real mouse clicks / drags / touch swipes, menus, CDP failure interception.
const lib = require("./audit-lib.cjs");
const { sleep } = lib;
const jl = require("./journey-lib.cjs");
const fs = require("fs");
const path = require("path");
// DIS_DRY=1 prints rows without writing them to rows.jsonl (used while debugging a script)
const DRY = !!process.env.DIS_DRY; let dryN = 0;
const R = DRY ? () => { const p = (res) => (r) => { console.log(res.padEnd(10), "dry-" + ++dryN, "|", r.control, "|", String(r.actual).slice(0, 260)); return r; }; return { pass: p("PASS"), fail: p("FAIL"), blocked: p("BLOCKED"), nt: p("NOT TESTED"), check: (ok, r) => p(ok ? "PASS" : "FAIL")(r) }; } : lib.R;

const INTERCEPT = ["*/api/ai/*", "*/api/billing/*", "*/api/auth/*", "*/api/newsletter*", "*/api/waitlist*", "*/api/push/*", "*/api/clubs/notify*", "*/api/launch-access*", "*/api/admin/*", "*/api/card-lookup*", "*/api/psa-lookup*", "*/api/upc-lookup*", "*/api/comic-lookup*", "*/api/vinyl-lookup*", "*supabase.co/auth/v1/*", "*supabase.co/functions/v1/*"];

// element centre (after scrolling it into view and letting any smooth scroll finish) for an expression that evaluates to an element
async function centre(S, expr) {
  const get = `(() => { const el = ${expr}; if (!el) return null; const b = el.getBoundingClientRect(); const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, top: !!hit && (hit === el || el.contains(hit) || hit.contains(el)) }; })()`;
  const first = await S.evaluate(`(() => { const el = ${expr}; if (!el) return false; const b0 = el.getBoundingClientRect(); const inView = b0.top >= 90 && b0.bottom <= innerHeight - 20 && b0.left >= 0 && b0.right <= innerWidth; if (!inView) el.scrollIntoView({ block: 'center', inline: 'center' }); return true; })()`);
  if (!first) return null;
  let prev = null, cur = null;
  for (let i = 0; i < 25; i++) { await sleep(120); cur = await S.evaluate(get); if (prev && cur && Math.abs(prev.x - cur.x) < 0.5 && Math.abs(prev.y - cur.y) < 0.5) break; prev = cur; }
  return cur;
}
// real mouse click at the element's centre. Returns false (not found), "covered" (something else is on top) or true
async function click(S, expr, { dbl = false } = {}) {
  const c = await centre(S, expr);
  if (!c) return false;
  await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c.x, y: c.y, button: "none" });
  const n = dbl ? 2 : 1;
  for (let i = 1; i <= n; i++) {
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, button: "left", clickCount: i, buttons: 1 });
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.x, y: c.y, button: "left", clickCount: i, buttons: 0 });
  }
  await sleep(450);
  return c.top === false ? "covered" : true;
}
// element by visible text/label (regex source), scope = css selector to look in
const byText = (re, scope = "body", tags = "button,a,[role=button],[role=menuitemradio],[role=tab]") => `([...document.querySelector(${JSON.stringify(scope)}).querySelectorAll(${JSON.stringify(tags)})].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 1 && r.height > 1; }).find((b) => { const rx = new RegExp(${JSON.stringify(re)}, 'i'); return rx.test(b.getAttribute('aria-label') || '') || rx.test(b.textContent.replace(/\\s+/g, ' ').trim()); }))`;
async function clickText(S, re, o = {}) { return click(S, byText(re, o.scope, o.tags), o); }

// open a PillSelect (button with aria-label) and pick the option by its label
async function pick(S, ariaLabel, optionRe) {
  const a = await click(S, `document.querySelector('button[aria-label=${JSON.stringify(ariaLabel)}]')`);
  await sleep(300);
  const b = await click(S, `([...document.querySelectorAll('[role=menu] [role=menuitemradio]')].find((o) => new RegExp(${JSON.stringify(optionRe)}, 'i').test(o.textContent)))`);
  await sleep(700);
  return a && b;
}
const menuLabels = (S) => S.evaluate(`[...document.querySelectorAll('[role=menu] [role=menuitemradio]')].map((o) => o.textContent.trim())`);

async function mouseDrag(S, x0, y, x1, { steps = 8, hold = 0 } = {}) {
  await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y, button: "none" });
  await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y, button: "left", clickCount: 1, buttons: 1 });
  for (let i = 1; i <= steps; i++) { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x1 - x0) * i) / steps, y, button: "left", buttons: 1 }); await sleep(30); }
  if (hold) await sleep(hold);
  await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y, button: "left", clickCount: 1, buttons: 0 });
  await sleep(700);
}
async function touchSwipe(S, x0, y, x1, steps = 8) {
  await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y, id: 1 }] });
  for (let i = 1; i <= steps; i++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * i) / steps, y, id: 1 }] }); await sleep(30); }
  await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(800);
}
async function key(S, k, code, vk) {
  await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk });
  await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
  await sleep(450);
}
// click into an input (real mouse), clear it, type text with real insertText
async function typeInto(S, selector, text) {
  await click(S, `document.querySelector(${JSON.stringify(selector)})`);
  await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 });
  await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 });
  await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
  await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
  if (text) await S.send("Input.insertText", { text });
  await sleep(700);
}

// make requests matching `patterns` fail (the audit answers them 503 "intercepted by audit"); restoreNet() to stop
async function failRequests(S, patterns) {
  await S.send("Fetch.enable", { patterns: [...INTERCEPT, ...patterns].map((urlPattern) => ({ urlPattern })) });
}
async function restoreNet(S) {
  await S.send("Fetch.enable", { patterns: INTERCEPT.map((urlPattern) => ({ urlPattern })) });
}
// record the bodies of intercepted requests (for the Report / post style actions); OPTIONS preflights are ignored
function captureBodies(S, matcher) {
  S.bodies = S.bodies || [];
  S.c.on((e) => { if (e.method === "Fetch.requestPaused" && matcher.test(e.params.request.url) && e.params.request.method !== "OPTIONS") S.bodies.push({ method: e.params.request.method, url: e.params.request.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 120), body: String(e.params.request.postData || "").slice(0, 600) }); });
}
// the app scrolls inside .vltd-content-wrap (fixed, overflow auto), not the window
const scrollTo = (S, y) => S.evaluate(`(() => { const s = document.querySelector('.vltd-content-wrap') || document.scrollingElement; s.scrollTop = ${y === 'end' ? 's.scrollHeight' : y}; return s.scrollTop; })()`);
// page-level stub: requests whose URL matches reSource are NOT sent; their method/body are recorded in window.__fx and the app gets a 503 (or the given status)
async function stubFetch(S, reSource, status = 503) {
  const fn = (reSrc, st) => {
    if (window.__fxInstalled) return; window.__fxInstalled = true; window.__fx = [];
    const re = new RegExp(reSrc); const orig = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input && input.url) || String(input);
      if (re.test(url)) {
        let body = ""; try { body = init && init.body ? String(init.body) : (input && input.clone ? await input.clone().text() : ""); } catch (e) {}
        window.__fx.push({ method: (init && init.method) || (input && input.method) || "GET", url: url.replace(/^https?:[/][/][^/]+/, "").slice(0, 140), body: body.slice(0, 700) });
        return new Response(JSON.stringify({ message: "intercepted by audit" }), { status: st, headers: { "content-type": "application/json" } });
      }
      return orig(input, init);
    };
  };
  const src = "(" + fn.toString() + ")(" + JSON.stringify(reSource) + "," + status + ");";
  await S.send("Page.addScriptToEvaluateOnNewDocument", { source: src });
  try { await S.evaluate(src); } catch (e) {}
}
const fxList = (S) => S.evaluate("window.__fx ? JSON.parse(JSON.stringify(window.__fx)) : []").catch(() => []);
// page-level stub with a handler: handler(url, init) runs IN THE PAGE and returns null (pass through) or { status, body }. Every matched call is recorded in window.__fx2.
async function stubHandler(S, reSource, handlerFn, dataObj) {
  const fn = (reSrc, hsrc, data) => {
    if (window.__fx2Installed) return; window.__fx2Installed = true; window.__fx2 = [];
    const re = new RegExp(reSrc); const h = (0, eval)("(" + hsrc + ")"); const orig = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input && input.url) || String(input);
      if (re.test(url)) {
        const out = await h(url, init, data);
        if (out) { window.__fx2.push({ method: (init && init.method) || "GET", url: url.replace(/^https?:[/][/][^/]+/, "").slice(0, 160), status: out.status }); return new Response(JSON.stringify(out.body), { status: out.status, headers: { "content-type": "application/json" } }); }
      }
      return orig(input, init);
    };
  };
  const src = "(" + fn.toString() + ")(" + JSON.stringify(reSource) + "," + JSON.stringify(handlerFn.toString()) + "," + JSON.stringify(dataObj || null) + ");";
  await S.send("Page.addScriptToEvaluateOnNewDocument", { source: src });
  try { await S.evaluate(src); } catch (e) {}
}
const fx2List = (S) => S.evaluate("window.__fx2 ? JSON.parse(JSON.stringify(window.__fx2)) : []").catch(() => []);
const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
module.exports = { ...lib, stubHandler, fx2List, stubFetch, fxList, scrollTo, R, env: jl.env, centre, click, clickText, byText, pick, menuLabels, mouseDrag, touchSwipe, key, typeInto, failRequests, restoreNet, captureBodies, clean, INTERCEPT, fs, path, seed: () => JSON.parse(fs.readFileSync(path.join(__dirname, "dis-seed.json"), "utf8")) };
