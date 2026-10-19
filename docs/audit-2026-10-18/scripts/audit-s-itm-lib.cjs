// Shared helpers for the ITM audit suites (item details, For Sale / Sold / Sales, /share). Fixture tag: itm.
const L = require("./audit-lib.cjs");
const { session, controls, R, AUD, admin, sleep, man, fs } = L;
const m = man();
const P = m.personalId, B = m.businessId, ST = m.stamp;
const AREA = "ITM";
const rr = R(AREA);

// the fixture ids by role (see audit-fixture.cjs): sorted-by-id order of the 26 owned items
// ids[0]=_1 valued 120 cost 40 | ids[1]=_10 explicit $0 value cost 15 | ids[2]=_11 purchase only | ids[3]=_12 missing | ids[4..7]=_13.._16 FOR_SALE | ids[8]=_17 public 300 | ids[9]=_18 public 75
const sorted = ["1", "10", "11", "12", "13", "14", "15", "16", "17", "18"].map((n) => `qa_vz_${ST}_${n}`);
const ID = { valued: sorted[0], zero: sorted[1], ghost: sorted[2], missing: sorted[3], sale: sorted.slice(4, 8), pub1: sorted[8], pub2: sorted[9] };

async function dbItem(id) { const r = await admin.from("vault_items").select("*").eq("id", id).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data; }
async function dbPatch(id, patch) { const r = await admin.from("vault_items").update(patch).eq("id", id); if (r.error) throw new Error(r.error.message); }
// extra QA items on the Personal (or Business) profile that are in NO exhibit (the fixture's 26 items are all in exhibits). Removed with the fixture (cleanup deletes by profile).
async function mkItem(tag, extra = {}, profile = P) {
  const id = `qa_vz_${ST}_itm_${tag}`;
  const row = { id, profile_id: profile, title: `QA ITM ${tag}`, universe: "POP_CULTURE", category: "comics", category_label: "Comics", status: "COLLECTION", is_public: false, created_at: Date.now() - 86400e3,
    image_front_url: "/collectibles/comic-slab.png", image_front_storage_path: "/collectibles/comic-slab.png",
    images_json: [{ id: "/collectibles/comic-slab.png#0", storageKey: "/collectibles/comic-slab.png", url: "/collectibles/comic-slab.png", order: 0, localOnly: false, role: "primary", isPrivateStorage: false }], ...extra };
  await admin.from("vault_items").delete().eq("id", id);
  const r = await admin.from("vault_items").insert(row); if (r.error) throw new Error("mkItem " + tag + ": " + r.error.message);
  return id;
}

// real mouse click at the centre of an element (found by a JS expression returning the element)
async function rect(S, expr) {
  return S.evaluate(`(() => { const el = (${expr}); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);
}
async function mclick(S, expr, { count = 1 } = {}) {
  const r = await rect(S, expr); if (!r) return false; await sleep(150);
  const r2 = await rect(S, expr);
  await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r2.x, y: r2.y });
  await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: r2.x, y: r2.y, button: "left", clickCount: count });
  await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r2.x, y: r2.y, button: "left", clickCount: count });
  return true;
}
// element finders (as expression strings)
const byText = (re, sel = "button,a,[role=button],[role=menuitem],[role=tab],label,summary") => `[...document.querySelectorAll(${JSON.stringify(sel)})].find((b) => { const t = (b.innerText || b.textContent || '').trim().replace(/\\s+/g, ' '); return new RegExp(${JSON.stringify(re)}, 'i').test(t); })`;
const byLabel = (re, sel = "button,a,input,textarea,select,[role=button],[role=switch],[role=tab]") => `[...document.querySelectorAll(${JSON.stringify(sel)})].find((b) => new RegExp(${JSON.stringify(re)}, 'i').test(b.getAttribute('aria-label') || ''))`;
async function typeIn(S, text, { clear = false } = {}) {
  if (clear) { await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 }); await key(S, "Backspace", 8); }
  if (text) await S.send("Input.insertText", { text });
}
async function key(S, k, vk, code) {
  await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code: code || k, windowsVirtualKeyCode: vk });
  if (k === "Enter") await S.send("Input.dispatchKeyEvent", { type: "char", text: "\r", key: k, code: "Enter", windowsVirtualKeyCode: 13 });
  await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: code || k, windowsVirtualKeyCode: vk });
}
const ENTER = (S) => key(S, "Enter", 13);
const ESC = (S) => key(S, "Escape", 27);
const TAB = (S) => key(S, "Tab", 9);
async function text(S) { return (await S.text()).replace(/\s+/g, " "); }
async function openItem(S, id, { wait = true } = {}) {
  await S.visit(`/vault/item/${id}`);
  if (wait) await S.waitFor("document.querySelector('h1') && document.body.innerText.includes('ITEM SUMMARY')", 60000, "item page " + id).catch(() => {});
  await sleep(800);
}
// wait until the item row in the database satisfies a predicate (the durable upload queue is asynchronous)
async function dbWait(id, pred, ms = 20000) {
  const t0 = Date.now(); let row;
  while (Date.now() - t0 < ms) { row = await dbItem(id); try { if (pred(row)) return { ok: true, row }; } catch {} await sleep(700); }
  return { ok: false, row };
}
// refuse requests to the items table (interrupted connection). mode on = fail, off = continue
async function blockItems(S, on) {
  if (on) {
    await S.send("Fetch.enable", { patterns: [{ urlPattern: "*supabase.co/rest/v1/vault_items*", requestStage: "Request" }, ...[]] }).catch(() => {});
  }
}
module.exports = { ...L, S_: session, controls, rr, ID, P, B, ST, m, dbItem, dbPatch, mkItem, rect, mclick, byText, byLabel, typeIn, key, ENTER, ESC, TAB, text, openItem, dbWait, sleep, admin, fs, AUD, R };

// ---- per-suite check helper: PASS needs an asserted behaviour; a FAIL gets a settled screenshot taken at that moment ----
let shotN = 0;
function makeCk(getS, defaults = {}) {
  const out = [];
  const ck = async (ok, r) => {
    const rowd = { ...defaults, ...r };
    if (!ok && !rowd.evidence) {
      try { const S = getS(); await sleep(300); rowd.evidence = await S.jshot(`itm-fail-${Date.now().toString(36)}-${++shotN}`); } catch {}
    }
    const o = rr.check(!!ok, rowd); out.push(o); return !!ok;
  };
  const nt = (r) => { const o = rr.nt({ ...defaults, ...r }); out.push(o); };
  const bl = (r) => { const o = rr.blocked({ ...defaults, ...r }); out.push(o); };
  return { ck, nt, bl, out };
}
const sumRows = (out) => { const c = {}; out.forEach((o) => (c[o.result] = (c[o.result] || 0) + 1)); return c; };
module.exports.makeCk = makeCk; module.exports.sumRows = sumRows;

// corrections: rows.jsonl is append-only and shared with other auditors, so a first-run row that was a TEST mistake is superseded by a correction row (never edited).
module.exports.corr = (ids, reason, replacedBy = "") => rr.nt({ page: "(correction)", control: `CORRECTION: ${ids.join(", ")} superseded`, expected: "First-run rows invalid because of a test mistake are excluded from the defect count", actual: `TEST MISTAKE, not an app result: ${reason}${replacedBy ? " Re-run result in " + replacedBy + "." : ""}`, impact: "none", repro: "n/a" });
// dismiss the "Add to Home Screen" install banner (it covers the bottom-left of the page and intercepts clicks there)
module.exports.dismissBanner = async (S) => { await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || x.innerText || '').trim() === 'Dismiss' && x.closest('div')?.innerText?.includes('Add to Home Screen')); if (b) { b.click(); return true; } return false; })()`).catch(() => {}); };
