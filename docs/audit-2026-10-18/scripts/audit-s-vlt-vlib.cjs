// Vault-page helpers for the VLT suites.
const V = require("./audit-s-vlt-lib.cjs");
const { sleep, squash, num, clickEl, mouseClick } = V;

const SEARCH_FIELDS = ["title", "subtitle", "number", "grade", "notes", "category", "category_label", "subcategory_label", "universe", "storage_location", "cert_number", "serial_number", "purchase_source", "purchase_location", "order_number", "price_source", "price_notes"];
const searchText = (r) => SEARCH_FIELDS.map((f) => r[f]).filter(Boolean).join(" ").toLowerCase();
const hasPhoto = (r) => !!r.image_front_url || (Array.isArray(r.images_json) && r.images_json.length > 0);
function gaps(r) {
  const g = [];
  if (!hasPhoto(r)) g.push("photo");
  if (V.basis(r).b !== "explicit") g.push("value");
  const p = num(r.purchase_price);
  if (p === null || !Number.isFinite(p)) g.push("cost"); else if (!(p > 0)) g.push("cost_zero");
  if ([r.grade, r.cert_number, r.serial_number, r.number, r.subtitle].some((x) => typeof x === "string" && x.trim() !== "")) { /* identified */ } else g.push("identity");
  return g;
}
const isSupply = (r) => String(r.universe || "").toUpperCase() === "MISC" && String(r.category_label || r.category || "").trim() === "Supplies & Display";
const counted = (r) => V.isActive(r); // not sold, not supply, not wishlist

// ids of the items the list is showing right now (any view), in page order
const ids = (S) => S.evaluate("(() => { const seen = []; for (const a of document.querySelectorAll('main a[href^=\"/vault/item/\"]')) { const m = /\\/vault\\/item\\/([^?#/]+)/.exec(a.getAttribute('href')); if (m && !seen.includes(m[1])) seen.push(m[1]); } return seen; })()");
const setMode = async (S, label) => { await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)} && b.closest('div').textContent.includes('View'))`, { js: true }); await sleep(1400); };
async function typeInto(S, selector, text, { js = false } = {}) {
  await clickEl(S, selector, { js });
  await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, commands: ["selectAll"] });
  await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65 });
  if (text === "") { await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 }); }
  else await S.send("Input.insertText", { text });
  await sleep(900);
}
const PAGE_SEARCH = 'input[aria-label="Search the vault"]';
const stats = (S) => S.evaluate(`(() => {
  const lab = (re) => { const b = [...document.querySelectorAll('main button, main a')].find((x) => re.test(x.getAttribute('aria-label') || '')); return b ? b.getAttribute('aria-label') : null; };
  const total = lab(/^Total value/); const items = lab(/items\\. Show the complete list/); const doc = lab(/^Documentation complete/); const rev = lab(/^Needs review/);
  const n = (re, s) => { const m = re.exec(s || ''); return m ? m[1] : null; };
  const txt = document.body.innerText.replace(/\\s+/g, ' ');
  const chips = [...document.querySelectorAll('main button')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim()).filter((t) => /^(Pop Culture|Sports|TCG & Non Sport Card|Music|Games|Misc|Art|Jewelry & Apparel|Built, Botany & Bar|Gears & Gasoline) \\d+$/.test(t));
  const wallCount = /(\\d+) items(?= All \\()/.exec(txt);
  return { totalValue: n(/^Total value (\\$[\\d,]+)/, total), itemsCard: n(/^(\\d+) items\\./, items), docReady: n(/: (\\d+) of \\d+ items/, doc), docOf: n(/: \\d+ of (\\d+) items/, doc), needsReview: n(/^Needs review: (\\d+)/, rev), chips, wallCount: wallCount ? wallCount[1] : null, pressedItems: (document.querySelector('button[aria-label*="Show the complete list"]') || {}).getAttribute && document.querySelector('button[aria-label*="Show the complete list"]').getAttribute('aria-pressed'), gainLine: (document.querySelector('[data-testid=vault-gain]') || {}).innerText, gainBasis: (document.querySelector('[data-testid=vault-gain-basis]') || {}).innerText, emptyState: /No items match your current filters|NO MATCHES|No items match\\./.test(txt), emptyVault: /Your vault is empty/.test(txt), filterPills: [...document.querySelectorAll('section[aria-label="Active filters"] button')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim()) };
})()`);
module.exports = { ...V, V, SEARCH_FIELDS, searchText, hasPhoto, gaps, isSupply, counted, ids, setMode, typeInto, PAGE_SEARCH, stats };
