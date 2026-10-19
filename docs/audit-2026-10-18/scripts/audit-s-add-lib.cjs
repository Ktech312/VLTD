// Shared helpers for the ADD-area audit suites (audit-s-add-*.cjs). Synthetic fixture only.
const L = require("./audit-lib.cjs");
const zlib = require("zlib");
const { R, admin, sleep, man, fs, path, AUD } = L;
const A = R("ADD");
const OUT = path.join(__dirname, "add-tmp"); fs.mkdirSync(OUT, { recursive: true });

// ---------- synthetic files ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
// A valid PNG: a flat colour with a lighter band (so it is recognisable), or incompressible noise when `noise` is set (for the oversize file).
function mkPng(file, w, h, rgb = [40, 120, 200], noise = false) {
  const stride = w * 3 + 1; const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    if (noise) { require("crypto").randomFillSync(raw, y * stride + 1, w * 3); continue; }
    for (let x = 0; x < w; x++) { const o = y * stride + 1 + x * 3; const band = (x + y) % 64 < 8 ? 60 : 0; raw[o] = Math.min(255, rgb[0] + band); raw[o + 1] = Math.min(255, rgb[1] + band); raw[o + 2] = Math.min(255, rgb[2] + band); }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: noise ? 0 : 6 })), chunk("IEND", Buffer.alloc(0))]));
  return file;
}
const tmp = (name) => path.join(OUT, name).replace(/\\/g, "/");

// ---------- driving the page like a person ----------
async function rectOf(S, expr) {
  return S.evaluate(`(() => { const el = (${expr}); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, disabled: !!(el.disabled || el.getAttribute('aria-disabled') === 'true'), vis: r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' }; })()`);
}
async function mouseAt(S, x, y, { clicks = 1 } = {}) {
  await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  for (let i = 1; i <= clicks; i++) {
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: i });
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: i });
  }
}
// real mouse click at the centre of the element the expression returns. Returns the rect (null when the element does not exist).
async function click(S, expr, opts = {}) { await sleep(150); const r = await rectOf(S, expr); if (!r) return null; await sleep(250); const r2 = await rectOf(S, expr) || r; await mouseAt(S, r2.x, r2.y, opts); return r2; }
const btnExpr = (re, scope = "document") => `[...${scope}.querySelectorAll('button,a,[role=button],[role=tab],label,summary')].find((b) => { const rx = new RegExp(${JSON.stringify(String(re).replace(/\(\?:\.\*\\\|\)\?/g, ""))}, 'i'); return rx.test((b.getAttribute('aria-label') || '').trim()) || rx.test((b.getAttribute('title') || '').trim()) || rx.test(b.textContent.trim().replace(/\\s+/g, ' ')); })`;
const clickText = (S, re, opts) => click(S, btnExpr(re), opts);
// focus an input/textarea and insert text as typed/pasted input (real input events), replacing what was there
async function typeInto(S, expr, text, { keep = false } = {}) {
  const r = await rectOf(S, expr); if (!r) return false;
  await mouseAt(S, r.x, r.y);
  await S.evaluate(`(() => { const el = (${expr}); el.focus(); ${keep ? "" : "if (el.select) el.select();"} return true; })()`);
  if (!keep) { await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 }); }
  if (text !== "") await S.send("Input.insertText", { text });
  await sleep(120);
  return true;
}
async function pickSelect(S, expr, textOrValue) {
  return S.evaluate(`(() => { const s = (${expr}); if (!s) return 'no select'; const want = ${JSON.stringify(textOrValue)}; const o = [...s.options].find((x) => x.text.trim() === want || x.value === want); if (!o) return 'no option: ' + [...s.options].map((x) => x.text.trim()).join('|'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
}
async function uploadFiles(S, selector, files, index = 0) {
  await S.send("DOM.enable");
  const doc = await S.send("DOM.getDocument", { depth: 1 });
  const q = await S.send("DOM.querySelectorAll", { nodeId: doc.root.nodeId, selector });
  if (!q.nodeIds || !q.nodeIds[index]) return false;
  await S.send("DOM.setFileInputFiles", { nodeId: q.nodeIds[index], files: Array.isArray(files) ? files : [files] });
  return true;
}
const alertText = (S) => S.evaluate("[...document.querySelectorAll('[role=alert],[role=status]')].filter((a) => a.id !== 'vltd-load-stalled' && a.getBoundingClientRect().height > 0 && getComputedStyle(a).visibility !== 'hidden').map((a) => a.textContent.trim()).filter(Boolean).join(' | ')");
const text = async (S) => (await S.text()).replace(/\s+/g, " ");

// ---------- database (YOUR fixture's profiles only) ----------
const COLS = "id,profile_id,title,subtitle,number,grade,purchase_price,purchase_tax,purchase_shipping,purchase_fees,current_value,notes,image_front_url,image_front_storage_path,universe,category,category_label,subcategory_label,purchase_source,purchase_location,storage_location,cert_number,brand,condition,added_via,images_json,status,estimated_value,created_at,is_public,item_code,tags,item_type,year";
const mine = () => { const m = man(); return [m.personalId, m.businessId]; };
async function rowsByTitle(profileId, prefix) { const r = await admin.from("vault_items").select(COLS).eq("profile_id", profileId).like("title", prefix + "%"); if (r.error) throw new Error(r.error.message); return r.data || []; }
async function allCount(profileId) { return (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", profileId)).count || 0; }
const poll = async (fn, ms = 40000, step = 1500) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; };
// Remove an item row and any files stored for it, by exact id, inside my profiles only.
async function removeItems(rows) {
  const ps = mine();
  for (const r of rows) {
    if (!ps.includes(r.profile_id)) continue;
    for (const x of (r.images_json || [])) { const m = /\/object\/public\/([^/]+)\/(.+)$/.exec(String(x.url || "")); if (m) await admin.storage.from(m[1]).remove([decodeURIComponent(m[2])]).catch(() => {}); if (x.storageKey && !/^local/.test(String(x.storageKey))) await admin.storage.from("vault-images").remove([x.storageKey]).catch(() => {}); }
    await admin.from("vault_items").delete().eq("id", r.id).eq("profile_id", r.profile_id);
  }
}
async function removeByPrefix(prefix) { for (const p of mine()) await removeItems(await rowsByTitle(p, prefix)); }

// ---------- interrupted connection: block every request to the vault_items table (net::ERR_BLOCKED_BY_CLIENT) ----------
// (CDP Fetch interception is already used by the audit library for its own refusals, so Network.setBlockedURLs is used for the same effect.)
const block = (S, on) => S.send("Network.setBlockedURLs", { urls: on ? ["*supabase.co/rest/v1/vault_items*"] : [] });
const offline = (S, on) => S.send("Network.emulateNetworkConditions", { offline: !!on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

// rows: records PASS/FAIL, takes a screenshot only for a FAIL
let shotN = 0;
async function rec(S, ok, r) {
  let ev = r.evidence || "";
  if (!ok && S && !ev) ev = await S.jshot(`add-fail-${process.pid}-${++shotN}`);
  return A.check(!!ok, { ...r, evidence: ev });
}
module.exports = { ...L, A, OUT, mkPng, tmp, rectOf, mouseAt, click, clickText, btnExpr, typeInto, alertText, pickSelect, uploadFiles, text, rowsByTitle, allCount, poll, removeItems, removeByPrefix, mine, block, offline, rec, crc32 };

// ---------- file chooser through the real button ----------
// Intercept the browser's file dialog, click the visible button with a real mouse click, answer the dialog with the files.
async function chooseViaButton(S, buttonExpr, files) {
  await S.send("Page.setInterceptFileChooserDialog", { enabled: true });
  let resolved = null;
  const got = new Promise((res) => { const h = (e) => { if (e.method === "Page.fileChooserOpened") { resolved = e.params; res(e.params); } }; S.c.on(h); setTimeout(() => res(null), 8000); });
  const r = await click(S, buttonExpr);
  if (!r) { await S.send("Page.setInterceptFileChooserDialog", { enabled: false }); return { clicked: false }; }
  const p = await got;
  if (!p) { await S.send("Page.setInterceptFileChooserDialog", { enabled: false }); return { clicked: true, dialog: false }; }
  await S.send("DOM.enable");
  await S.send("DOM.setFileInputFiles", { files: Array.isArray(files) ? files : [files], backendNodeId: p.backendNodeId });
  await S.send("Page.setInterceptFileChooserDialog", { enabled: false });
  return { clicked: true, dialog: true, multiple: p.mode === "selectMultiple" };
}
// the input that belongs to a visible label (walks up from the label until a container holds an input/select/textarea)
const fieldInput = (lab) => `(() => { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().toLowerCase() === ${JSON.stringify(lab.toLowerCase())}); if (!l) return null; let e = l; for (let i = 0; i < 2 && e; i++) { e = e.parentElement; const f = e && e.querySelector('input:not([type=checkbox]):not([type=file]),select,textarea'); if (f) return f; } return null; })()`;
module.exports.chooseViaButton = chooseViaButton; module.exports.fieldInput = fieldInput;
