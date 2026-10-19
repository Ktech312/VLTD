// Shared helpers for the ACC area suites (real mouse/keyboard events through CDP).
const L = require("./audit-lib.cjs");
const { sleep } = L;

const RECT_JS = (expr) => `(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`;

// find an element by visible label (regex source), optional css scope, returns the JS expression
function byText(re, scope = "button,a,[role=button],[role=menuitem],[role=tab],[role=switch],label,summary,input[type=checkbox],input[type=radio]", flags = "i") {
  return `[...document.querySelectorAll(${JSON.stringify(scope)})].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; }).find((e) => { const rx = new RegExp(${JSON.stringify(re)}, ${JSON.stringify(flags)}); const a = (e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim(); const t = (e.innerText || e.value || '').replace(/\\s+/g, ' ').trim(); return (a && rx.test(a)) || rx.test(t); })`;
}

async function mouseClick(S, x, y, opts = {}) {
  await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: opts.right ? "right" : "left", buttons: 1, clickCount: 1 });
  await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: opts.right ? "right" : "left", buttons: 0, clickCount: 1 });
}
async function touchTap(S, x, y) {
  await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await sleep(60);
  await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
// real click on an element described by a JS expression; returns false if no such element
async function clickExpr(S, expr, { touch = false } = {}) {
  let r = await S.evaluate(RECT_JS(expr));
  if (!r) return false;
  // pages use smooth scrolling: wait until the element's position stops moving before clicking
  for (let i = 0; i < 25; i++) { await sleep(150); const n = await S.evaluate(RECT_JS(expr)); if (!n) return false; const same = Math.abs(n.x - r.x) < 1 && Math.abs(n.y - r.y) < 1; r = n; if (same) break; }
  if (touch) await touchTap(S, r.x, r.y); else await mouseClick(S, r.x, r.y);
  return true;
}
const clickText = (S, re, scope, o) => clickExpr(S, byText(re, scope), o);
const clickSel = (S, sel, o) => clickExpr(S, `document.querySelector(${JSON.stringify(sel)})`, o);

async function focusSel(S, sel) { return S.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.focus(); return document.activeElement === e; })()`); }
async function typeInto(S, sel, text, { clear = true } = {}) {
  const r = await S.evaluate(RECT_JS(`document.querySelector(${JSON.stringify(sel)})`));
  if (!r) return false;
  await mouseClick(S, r.x, r.y);
  if (clear) { await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 }); await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 }); }
  if (text) await S.send("Input.insertText", { text });
  await sleep(100);
  return true;
}
const KEYS = { Enter: [13, "Enter"], Escape: [27, "Escape"], ArrowDown: [40, "ArrowDown"], ArrowUp: [38, "ArrowUp"], ArrowLeft: [37, "ArrowLeft"], ArrowRight: [39, "ArrowRight"], Tab: [9, "Tab"], Space: [32, " "], Backspace: [8, "Backspace"] };
async function press(S, key, modifiers = 0) {
  const k = KEYS[key];
  const code = k ? k[0] : key.toUpperCase().charCodeAt(0);
  const kk = k ? k[1] : key;
  const text = !k && !modifiers ? key : key === "Enter" ? "\r" : undefined;
  await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: kk, code: k ? kk : "Key" + key.toUpperCase(), modifiers, windowsVirtualKeyCode: code, ...(text ? { text } : {}) });
  await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: kk, code: k ? kk : "Key" + key.toUpperCase(), modifiers, windowsVirtualKeyCode: code });
  await sleep(120);
}
const waitPath = async (S, re, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const p = await S.path().catch(() => ""); if (re.test(p)) return p; await sleep(250); } return await S.path().catch(() => ""); };
const bodyText = async (S) => ((await S.text().catch(() => "")) || "").replace(/\s+/g, " ").trim();
const vis = (S, expr) => S.evaluate(`!!(${expr})`);
module.exports = { ...L, mouseClick, touchTap, clickExpr, clickText, clickSel, byText, typeInto, focusSel, press, waitPath, bodyText, RECT_JS, vis };
