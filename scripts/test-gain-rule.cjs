// The one rule for "unrealized change" (src/lib/vaultStats.ts): only items with a real value AND a recorded cost are measured, the rest are
// counted by reason, and an unknown cost stays different from a cost entered as $0 all the way through the device copy.
//   node scripts/test-gain-rule.cjs
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-gain-"));
for (const name of ["vaultStats", "vaultModel", "vaultLocalStore", "sessionGuard"]) {
  const src = fs.readFileSync(path.join(root, "src", "lib", name + ".ts"), "utf8");
  fs.writeFileSync(path.join(out, name + ".js"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
}
let store = new Map();
global.window = {
  localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } },
  dispatchEvent: () => true, addEventListener: () => {},
  btoa: (s) => Buffer.from(s, "binary").toString("base64"), atob: (s) => Buffer.from(s, "base64").toString("binary"),
};
Object.defineProperty(global, "localStorage", { get: () => global.window.localStorage, configurable: true });
const mocks = {
  vaultCloud: { hasSupabaseEnv: () => true, isDirectBrowserImageUrl: (u) => /^https?:|^blob:|^data:|^\//.test(String(u || "")), getVaultImagePublicUrl: (k) => "https://cdn.example/" + k, fetchVaultItemsDelta: async () => ({ items: [], delta: false }) },
  privatePhotos: { resolvePrivateImageUrlSync: () => "" },
  id: { newId: () => "gen-" + Math.random().toString(36).slice(2) },
  pricingMvp: { normalizeComparables: (v) => v, normalizePriceSources: (v) => v },
};
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === "fflate") return origLoad.call(this, path.join(root, "node_modules", "fflate", "lib", "index.cjs"), parent, ...rest);
  const m = request.match(/^(?:\.\/|@\/lib\/)([A-Za-z0-9_]+)$/);
  if (m && mocks[m[1]]) return mocks[m[1]];
  if (m && fs.existsSync(path.join(out, m[1] + ".js"))) return origLoad.call(this, path.join(out, m[1] + ".js"), parent, ...rest);
  return origLoad.call(this, request, parent, ...rest);
};
const stats = require(path.join(out, "vaultStats.js"));
const model = require(path.join(out, "vaultModel.js"));
const local = require(path.join(out, "vaultLocalStore.js"));

let pass = 0, fail = 0;
const t = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail ?? ""); } };
const base = { profile_id: "p-1", status: "COLLECTION", createdAt: 1 };
const items = [
  { ...base, id: "a", title: "A", currentValue: 300, purchasePrice: 100 },
  { ...base, id: "b", title: "B", currentValue: 200, purchasePrice: 100 },
  { ...base, id: "c", title: "C", currentValue: 100, purchaseTax: 10, purchasePrice: 90 },
  { ...base, id: "d", title: "D", currentValue: 1000 },                       // value, cost never recorded
  { ...base, id: "e", title: "E", currentValue: 500, purchasePrice: 0 },       // value, price entered as $0
  { ...base, id: "f", title: "F", purchasePrice: 50 },                         // cost, no value
  { ...base, id: "g", title: "G" },                                            // neither
];
const g = stats.summarizeGain(items);
t("measured items are those with a value and a recorded cost (3 of 7)", g.eligibleCount === 3 && g.totalCount === 7, JSON.stringify(g));
t("change = value minus cost over the measured items only (+$300 on a $300 cost; tax counts in the cost)", g.gain === 300 && g.costBasis === 300, JSON.stringify(g));
t("the percentage is of the measured cost", Math.abs(g.gainPct - (g.gain / g.costBasis) * 100) < 1e-9 && g.costBasis === 300);
t("exclusions are counted by reason (no cost 1, $0 cost 1, no value 2)", g.noCostCount === 1 && g.zeroCostCount === 1 && g.noValueCount === 2, JSON.stringify(g));
t("an unknown cost and a cost of $0 are reported as different things", stats.gainStatus(items[3]) === "no-cost" && stats.gainStatus(items[4]) === "zero-cost");
t("an item with no value is never a loss of everything paid", stats.gainStatus(items[5]) === "no-value" && stats.itemGain(items[5]) === null);
t("the exclusions are said in words", stats.describeGainExclusions(g) === "1 without a recorded cost, 1 bought for $0, 2 without a value", stats.describeGainExclusions(g));
const filled = stats.summarizeValues(items, "fill"), priced = stats.summarizeValues(items, "priced");
t("the display setting changes the total value but not the change, its count or its cost basis", filled.totalValue !== priced.totalValue && filled.totalGain === priced.totalGain && filled.gainItemCount === priced.gainItemCount && filled.costBase === priced.costBase && filled.gainPct === priced.gainPct, `${filled.totalValue}/${priced.totalValue}`);
t("nothing measurable: no percentage, no invented zero", stats.summarizeGain([items[5], items[6]]).gainPct === null && stats.summarizeGain([]).eligibleCount === 0);

// the device copy keeps "unknown" unknown
store = new Map();
store.set("vltd-auth", JSON.stringify({ user: { id: "u1" } }));
store.set("vltd_active_profile_id_v1", "p-1");
local.resetVaultLocalMemory();
model.saveItem({ ...base, id: "blank", title: "Blank price" });
model.saveItem({ ...base, id: "zero", title: "Zero price", purchasePrice: 0 });
model.saveItem({ ...base, id: "pay", title: "Paid", purchasePrice: 12.5 });
for (const pass2 of [1, 2]) {
  // (a second pass after the repair step has run on the stored copy)
  local.resetVaultLocalMemory();
  const loaded = Object.fromEntries(model.loadItems().map((i) => [i.id, i]));
  t(`a blank price stays blank through the repair step (pass ${pass2})`, loaded.blank && loaded.blank.purchasePrice === undefined, String(loaded.blank?.purchasePrice));
  t(`a price entered as 0 stays 0 (pass ${pass2})`, loaded.zero && loaded.zero.purchasePrice === 0);
  t(`a price keeps its value (pass ${pass2})`, loaded.pay && loaded.pay.purchasePrice === 12.5);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
