// Shared helpers for the EXH (Exhibitions) audit suites. Rows go to docs/audit-2026-10-18/rows.jsonl unless --dry is passed.
const L = require("./audit-lib.cjs");
const { session, controls, admin, sleep, man, fs, AUD } = L;
const DRY = process.argv.includes("--dry");
const AREA = "EXH";
const PNG = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/ui/scripts/exh-test-image.png";
// a valid 40x2700-ish png is not needed: a small real PNG (wide) is written once.
function ensurePng() {
  if (fs.existsSync(PNG)) return PNG;
  const zlib = require("zlib");
  const w = 94, h = 270; // 1:2.87 tall background shape
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 40 + (x * 2) % 200; raw[o + 1] = 90; raw[o + 2] = 200 - (y % 150); } }
  const crc = (buf) => { let c, crcT = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } let r = 0xffffffff; for (const b of buf) r = crcT[(r ^ b) & 0xff] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(PNG, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
  return PNG;
}

function rows() {
  const real = L.R(AREA);
  if (!DRY) return real;
  const out = (res) => (r) => { console.log(res.padEnd(10), "|", r.page, "|", r.control, "|", String(r.actual).slice(0, 220)); return r; };
  return { pass: out("PASS"), fail: out("FAIL"), blocked: out("BLOCKED"), nt: out("NOT TESTED"), check: (ok, r) => out(ok ? "PASS" : "FAIL")(r) };
}

// Real mouse click at the centre of the element returned by an in-page expression (a function body string returning an Element).
async function rectOf(S, elExpr, scroll = true) {
  return S.evaluate(`(() => { const el = (${elExpr}); if (!el) return null; if (${scroll}) el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, disabled: !!el.disabled }; })()`);
}
async function mclick(S, elExpr, { wait = 500, scroll = true } = {}) {
  const r = await rectOf(S, elExpr, scroll);
  if (!r) return false;
  await sleep(150);
  const r2 = await rectOf(S, elExpr, false); // re-measure after scroll settles
  const { x, y } = r2 || r;
  await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1 });
  await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, buttons: 0 });
  await sleep(wait);
  return true;
}
const byLabel = (label) => `[...document.querySelectorAll('button,a,[role=button],label,summary')].find(e => (e.getAttribute('aria-label')||'') === ${JSON.stringify(label)} || e.textContent.trim().replace(/\\s+/g,' ') === ${JSON.stringify(label)})`;
const byLabelRe = (re) => `[...document.querySelectorAll('button,a,[role=button],label,summary')].find(e => { const r = new RegExp(${JSON.stringify(re)}, 'i'); return r.test(e.getAttribute('aria-label')||'') || r.test(e.textContent.trim().replace(/\\s+/g,' ')); })`;
const bySel = (sel) => `document.querySelector(${JSON.stringify(sel)})`;

async function typeInto(S, elExpr, text, { clear = true } = {}) {
  await mclick(S, elExpr, { wait: 200 });
  // select everything, then type over the selection (as a person would); with no text, Delete the selection
  if (clear) { await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65, commands: ["selectAll"] }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 }); }
  if (text) await S.send("Input.insertText", { text });
  else if (clear) { await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 }); }
  await sleep(250);
}
async function key(S, k, code, vk) { const text = k === "Enter" ? String.fromCharCode(13) : k === " " ? " " : undefined; await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: code || k, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: code || k, windowsVirtualKeyCode: vk }); await sleep(200); }

async function gdb(id) { const r = await admin.from("galleries").select("*").eq("id", id).maybeSingle(); return r.data; }
// The item ids a gallery row holds (layout.itemIds first, then exhibition_layout.itemIds).
const gItemIds = (g) => (g?.layout?.itemIds ?? g?.exhibition_layout?.itemIds ?? []);
async function itemsOf(ids) { const r = await admin.from("vault_items").select("id,title,current_value,purchase_price,is_public,profile_id,status").in("id", ids); return r.data || []; }
async function cardText(S) { return S.evaluate(`[...document.querySelectorAll('main article')].map(a => a.innerText.replace(/\\s+/g,' ').trim())`); }
async function waitText(S, re, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const t = (await S.text()).replace(/\s+/g, " "); if (re.test(t)) return t; await sleep(400); } return (await S.text()).replace(/\s+/g, " "); }
async function drag(S, x0, y0, x1, y1, steps = 10) {
  await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0, button: "none" });
  await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", clickCount: 1, buttons: 1 });
  for (let i = 1; i <= steps; i++) { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps, button: "left", buttons: 1 }); await sleep(30); }
  await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: y1, button: "left", clickCount: 1, buttons: 0 });
  await sleep(500);
}
// Click a control that opens the native file picker, intercept the picker and hand it a real file.
async function uploadVia(S, clickExpr, file) {
  await S.send("Page.setInterceptFileChooserDialog", { enabled: true });
  let done = false;
  const p = new Promise((res) => S.c.on(async (e) => { if (e.method === "Page.fileChooserOpened" && !done) { done = true; try { await S.send("DOM.setFileInputFiles", { files: [file], backendNodeId: e.params.backendNodeId }); } catch (er) { res("ERR " + er.message); return; } res(true); } }));
  await mclick(S, clickExpr, { wait: 300 });
  const ok = await Promise.race([p, sleep(6000).then(() => false)]);
  await S.send("Page.setInterceptFileChooserDialog", { enabled: false });
  return ok;
}
module.exports = { uploadVia, ...L, DRY, AREA, rows, rectOf, mclick, byLabel, byLabelRe, bySel, typeInto, key, gdb, gItemIds, itemsOf, cardText, waitText, drag, ensurePng };
