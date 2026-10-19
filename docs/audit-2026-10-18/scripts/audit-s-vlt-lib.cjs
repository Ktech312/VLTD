// Shared bits for the VLT audit suites: expected values computed from the database with the app's own value rule (src/lib/vaultStats.ts).
const L = require("./audit-lib.cjs");
const { admin, sleep, man } = L;
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const money = (n) => "$" + Math.round(Math.abs(n)).toLocaleString("en-US");

function effective(r) { for (const v of [num(r.value_median), num(r.estimated_value), num(r.current_value), num(r.last_comp_value)]) if (fin(v) && v > 0) return v; return 0; }
function explicit(r) { return effective(r) > 0 || (num(r.current_value) !== null && num(r.current_value) === 0); }
function recorded(r) { return [r.purchase_price, r.purchase_tax, r.purchase_shipping, r.purchase_fees].some((v) => num(v) !== null && fin(num(v))); }
function cost(r) { return (num(r.purchase_price) || 0) + (num(r.purchase_tax) || 0) + (num(r.purchase_shipping) || 0) + (num(r.purchase_fees) || 0); }
function basis(r) { if (explicit(r)) return { b: "explicit", a: effective(r) }; if (recorded(r)) return { b: "purchase", a: cost(r) }; return { b: "missing", a: 0 }; }
function isSold(r) { return r.status === "SOLD" || !!r.sold_at || num(r.sold_price) !== null; }
function isSupply(r) { return String(r.universe || "").toUpperCase() === "MISC" && String(r.category_label || r.category || "").trim() === "Supplies & Display"; }
function isActive(r) { return !isSold(r) && !isSupply(r) && r.status !== "WISHLIST"; }

async function rows(profileId) {
  const out = []; let from = 0;
  for (;;) { const r = await admin.from("vault_items").select("*").eq("profile_id", profileId).order("id").range(from, from + 999); if (r.error) throw new Error(r.error.message); out.push(...r.data); if (r.data.length < 1000) break; from += 1000; }
  return out;
}
function expected(all) {
  const owned = all.filter(isActive); const soldRows = all.filter(isSold);
  let costAll = 0, filled = 0, priced = 0, pricedN = 0, ghost = 0, missing = 0, gain = 0, costBase = 0, gainN = 0, noValue = 0, noCost = 0, zeroCost = 0;
  for (const r of owned) {
    costAll += cost(r); const v = basis(r);
    if (v.b === "explicit") { pricedN++; priced += v.a; filled += v.a; } else if (v.b === "purchase") { ghost++; filled += v.a; } else missing++;
    if (!explicit(r)) noValue++; else if (cost(r) > 0) { gain += effective(r) - cost(r); costBase += cost(r); gainN++; } else if (num(r.purchase_price) !== null) zeroCost++; else noCost++;
  }
  const revenue = soldRows.reduce((s, r) => s + (num(r.sold_price) || 0), 0);
  return { owned, soldRows, count: owned.length, cost: costAll, filled, priced, pricedN, ghost, missing, gain, costBase, gainN, noValue, noCost, zeroCost, gainPct: costBase > 0 ? (gain / costBase) * 100 : null, soldCount: soldRows.length, revenue };
}
const squash = (s) => String(s || "").replace(/\s+/g, " ").trim();
async function mouseClick(S, x, y) {
  await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
// click an element like a person: scroll it into view, then a real mouse click at its centre
async function clickEl(S, selOrJs, { js = false } = {}) {
  const pt = await S.evaluate(`(() => { const el = ${js ? selOrJs : `document.querySelector(${JSON.stringify(selOrJs)})`}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);
  if (!pt) return false; await sleep(250); await mouseClick(S, pt.x, pt.y); return true;
}
async function drag(S, x0, y0, x1, y1, steps = 12) {
  await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y: y0 });
  await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", clickCount: 1 });
  for (let i = 1; i <= steps; i++) { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps, button: "left", buttons: 1 }); await sleep(16); }
  await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y: y1, button: "left", clickCount: 1 });
}
async function touchSwipe(S, x0, y0, x1, y1, steps = 10) {
  await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }] }); await sleep(16); }
  await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function setProfile(S, id) { await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(id)}); true`); }
const BASE_PATTERNS = ["*/api/ai/*", "*/api/billing/*", "*/api/auth/*", "*/api/newsletter*", "*/api/waitlist*", "*/api/push/*", "*/api/clubs/notify*", "*/api/launch-access*", "*/api/admin/*", "*/api/card-lookup*", "*/api/psa-lookup*", "*/api/upc-lookup*", "*/api/comic-lookup*", "*/api/vinyl-lookup*", "*supabase.co/auth/v1/*", "*supabase.co/functions/v1/*"];
// Refuse the data connection: every Supabase REST request is answered 503 by the audit library's interception handler (Fetch.enable with an extra pattern). Off = back to the library's own patterns.
async function blockRest(S, on, extra = ["*supabase.co/rest/v1/*"]) { await S.send("Fetch.enable", { patterns: (on ? BASE_PATTERNS.concat(extra) : BASE_PATTERNS).map((urlPattern) => ({ urlPattern })) }); }
async function offline(S, on) { await S.send("Network.emulateNetworkConditions", { offline: !!on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); }
module.exports = { blockRest, offline, ...L, L, num, fin, money, effective, explicit, cost, basis, isSold, isActive, rows, expected, squash, mouseClick, clickEl, drag, touchSwipe, setProfile };
