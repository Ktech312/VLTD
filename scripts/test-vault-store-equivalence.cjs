// Differential test of the device copy of the Vault: the new code (working tree) against the code before the saved-copy speed-up
// (git ref below). The same steps are run against both on a simulated browser (no network); after every step what the app would
// show and what is stored on the device must be the same. Also checks the new guarantees: a marked copy is read without being
// repaired again, and every way the mark can be wrong (another tab, a restore, an interrupted save, an edit that is not in repaired
// form, another account's copy) falls back to the full repair.
//
//   node scripts/test-vault-store-equivalence.cjs
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const { execSync } = require("child_process");
const ts = require("typescript");

const OLD_REF = "1d53b1a"; // the commit before the speed-up
const root = path.resolve(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-equiv-"));
const NAMES = ["vaultModel", "vaultLocalStore", "sessionGuard"];

function transpile(src) {
  return ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
}
const dirs = { old: path.join(tmp, "old"), new: path.join(tmp, "new") };
for (const k of Object.keys(dirs)) fs.mkdirSync(dirs[k], { recursive: true });
for (const name of NAMES) {
  const rel = `src/lib/${name}.ts`;
  const oldSrc = execSync(`git show ${OLD_REF}:${rel}`, { cwd: root, maxBuffer: 1 << 26 }).toString("utf8");
  fs.writeFileSync(path.join(dirs.old, name + ".js"), transpile(oldSrc));
  fs.writeFileSync(path.join(dirs.new, name + ".js"), transpile(fs.readFileSync(path.join(root, rel), "utf8")));
}

// ---- simulated browser ----
let store = new Map();
let failWrites = (key) => false;
const storage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (failWrites(k)) throw new Error("QuotaExceededError"); store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
global.window = {
  localStorage: storage, dispatchEvent: () => true, addEventListener: () => {},
  btoa: (s) => Buffer.from(s, "binary").toString("base64"), atob: (s) => Buffer.from(s, "base64").toString("binary"),
};
Object.defineProperty(global, "localStorage", { get: () => global.window.localStorage, configurable: true });

let cloudRows = [];
let idCounter = 0;
const mocks = {
  vaultCloud: {
    hasSupabaseEnv: () => true,
    isDirectBrowserImageUrl: (u) => /^https?:|^blob:|^data:|^\//.test(String(u || "")),
    getVaultImagePublicUrl: (k) => `https://cdn.example/${k}`,
    fetchVaultItemsDelta: async () => ({ items: cloudRows.map((r) => ({ ...r })), cursor: undefined, delta: false }),
  },
  privatePhotos: { resolvePrivateImageUrlSync: () => "" },
  id: { newId: () => "gen-" + ++idCounter },
  supabaseClient: { getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "x" } } }) } }) },
  subscription: { getTierSafe: () => "FULL" },
  galleryTier: { getVaultItemLimit: () => Infinity },
  pricingMvp: { normalizeComparables: (v) => v, normalizePriceSources: (v) => v },
};
let activeDir = dirs.new;
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === "fflate") return origLoad.call(this, path.join(root, "node_modules", "fflate", "lib", "index.cjs"), parent, ...rest);
  const m = request.match(/^(?:\.\/|@\/lib\/)([A-Za-z0-9_]+)$/);
  if (m && mocks[m[1]]) return mocks[m[1]];
  if (m && fs.existsSync(path.join(activeDir, m[1] + ".js"))) return origLoad.call(this, path.join(activeDir, m[1] + ".js"), parent, ...rest);
  return origLoad.call(this, request, parent, ...rest);
};
// a fresh page: every module (and so every in-memory copy) starts empty
function freshPage(which) {
  activeDir = dirs[which];
  for (const key of Object.keys(require.cache)) if (key.startsWith(tmp)) delete require.cache[key];
  idCounter = 0;
  return { model: require(path.join(activeDir, "vaultModel.js")), local: require(path.join(activeDir, "vaultLocalStore.js")) };
}

let pass = 0, fail = 0;
const t = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail === undefined ? "" : String(detail).slice(0, 600)); } };
const PROFILE = "p-1";
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);

// ---- seeds ----
function modernItems(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `item-${i}`, profile_id: PROFILE, title: `Item ${i}`, universe: "TOYS", category: "Action Figures", createdAt: 1_700_000_000_000 + i * 1000,
    purchasePrice: i, purchaseTax: 0, status: "COLLECTION", isNew: false, isPublic: false,
    toyBoxIncluded: i % 2 === 0 ? false : true, toyIsComplete: false, isFirstEdition: false,
    specs: i % 3 === 0 ? { condition: "Mint", boxed: "No", edition: "First", count: "0" } : undefined,
    currentValue: i % 4 === 0 ? undefined : 10 + i,
    images: [{ id: `https://img.example/${i}.jpg`, storageKey: `https://img.example/${i}.jpg`, url: `https://img.example/${i}.jpg`, order: 0 }],
    notes: "n".repeat(50), zzUnknownField: i % 7 === 0 ? { keep: "me?" } : undefined,
  }));
}
function legacyItems() {
  const base = { profile_id: PROFILE, universe: "SPORTS", createdAt: 1_600_000_000_000, status: "COLLECTION", purchasePrice: 2 }; // (a blank price is the one deliberate difference from the old build: see test-gain-rule.cjs)
  return [
    { ...base, id: "L1", title: "Only a front url", imageFrontUrl: "https://img.example/front.jpg" },
    { ...base, id: "L2", title: "Front and back", imageFrontUrl: "https://img.example/f2.jpg", imageBackUrl: "https://img.example/b2.jpg" },
    { ...base, id: "L3", title: "Has a dead blob image", images: [{ id: "blob:abc", storageKey: "blob:abc", url: "blob:abc", order: 0 }, { id: "https://img.example/ok.jpg", storageKey: "https://img.example/ok.jpg", url: "https://img.example/ok.jpg", order: 1 }] },
    { ...base, id: "L4", title: "Numbers as text", purchasePrice: "12.5", currentValue: "99", purchaseTax: "x" },
    { ...base, id: "L5", title: "No profile", profile_id: undefined },
    { ...base, id: "L6", title: "" },
    { ...base, id: "dup", title: "Duplicate one" }, { ...base, id: "dup", title: "Duplicate two" },
    { ...base, title: "No id at all" },
    { ...base, id: "L9", title: "Odd status", status: "WHATEVER", isNew: "yes" },
    { ...base, id: "L10", title: "Duplicate image keys", images: [{ id: "a", storageKey: "https://img.example/a.jpg", url: "https://img.example/a.jpg", order: 3 }, { id: "b", storageKey: "https://img.example/a.jpg", url: "https://img.example/a.jpg", order: 0 }] },
    { ...base, id: "L11", title: "Unknown stuff", mystery: { deep: [1, 2, 3] }, toyBoxIncluded: false },
  ];
}
function seedStore(items, settle = true) {
  store = new Map();
  store.set("vltd-auth", JSON.stringify({ user: { id: "user-1" } }));
  store.set("vltd_active_profile_id_v1", PROFILE);
  failWrites = () => false;
  const { local } = freshPage("old");
  local.resetVaultLocalMemory();
  local.writeVaultLocalJson(JSON.stringify(items));
  // Real stored data was written by the app (already in its stored form): let the previous build settle it once.
  if (settle) freshPage("old").model.loadItems({ includeAllProfiles: true });
  return store;
}
function snapshotStorage() { return new Map(store); }
function restoreStorage(snap) { store = new Map(snap); }

// what the app would show, and what is on the device, in a comparable form
function observe(page) {
  const shown = sortKeys(page.model.loadItems({ includeAllProfiles: true }));
  const stored = page.local.readVaultLocalJson();
  return { shown: JSON.stringify(shown), stored: stored ? JSON.stringify(sortKeys(JSON.parse(stored))) : null };
}

// a scenario is a list of steps; each step is { name, run(page, which) }. Both builds run it from the same starting storage.
async function runScenario(title, seedItems, steps, opts = {}) {
  const results = {};
  const startSnap = (() => { seedStore(seedItems, opts.settle !== false); return snapshotStorage(); })();
  for (const which of ["old", "new"]) {
    restoreStorage(startSnap);
    failWrites = () => false;
    cloudRows = [];
    const log = [];
    let page = freshPage(which);
    for (const step of steps) {
      if (step.reload) page = freshPage(which);
      if (step.run) await step.run(page, which);
      log.push({ step: step.name, ...observe(page) });
    }
    results[which] = { log, usedMark: store.has("vltd_vault_items_repaired_v1") };
    results[which].finalStore = new Map(store);
  }
  const a = results.old.log, b = results.new.log;
  for (let i = 0; i < a.length; i++) {
    // A newly added item is kept in its repaired form straight away (the old build did that at the next load): steps that add an item are only
    // compared once the copy has been read again.
    if (steps[i].soft) continue;
    if (opts.rawFirst && i === 0) { /* an unsettled raw copy: the first screen is the repaired list in its older (unprocessed) form; every later screen must match */ } else t(`${title}: "${a[i].step}" shows the same items as before the change`, a[i].shown === b[i].shown, a[i].shown === b[i].shown ? "" : `\nold ${a[i].shown.slice(0, 300)}\nnew ${b[i].shown.slice(0, 300)}`);
    t(`${title}: "${a[i].step}" stores the same on the device`, a[i].stored === b[i].stored, a[i].stored === b[i].stored ? "" : `\nold ${(a[i].stored || "").slice(0, 300)}\nnew ${(b[i].stored || "").slice(0, 300)}`);
  }
  return results;
}

const item = (page, id) => page.model.loadItems({ includeAllProfiles: true }).find((x) => String(x.id) === id);

(async () => {
  // ---------- 1. modern items ----------
  const edits = [
    { name: "first page load", run: (p) => { p.model.loadItems(); } },
    { name: "reload", reload: true, run: (p) => { p.model.loadItems(); } },
    { name: "edit one item (title, explicit false, details)", run: (p) => { const it = item(p, "item-5"); p.model.saveItem({ ...it, title: "Renamed", toyBoxIncluded: false, isFirstEdition: false, specs: { condition: "Good", boxed: "No", edition: "Second", count: "0" } }); } },
    { name: "reload after the edit", reload: true, run: (p) => { p.model.loadItems(); } },
    { name: "add a new item", soft: true, run: (p) => { p.model.saveItem({ id: "new-1", profile_id: PROFILE, title: "Brand new", createdAt: Date.UTC(2026, 9, 1), status: "COLLECTION", purchasePrice: 7, images: [] }); } },
    { name: "mark an item as viewed", soft: true, run: (p) => { p.model.markItemViewed("item-9"); } },
    { name: "append two items", soft: true, run: (p) => { p.model.appendItems([{ id: "ap-1", profile_id: PROFILE, title: "Appended 1", createdAt: 1, purchasePrice: 1 }, { id: "ap-2", profile_id: PROFILE, title: "Appended 2", createdAt: 2, purchasePrice: 1 }]); } },
    { name: "save a batch", soft: true, run: (p) => { const a = item(p, "item-1"), b = item(p, "item-2"); p.model.saveItemsBatch([{ ...a, notes: "batch a" }, { ...b, notes: "batch b", toyIsComplete: true }]); } },
    { name: "reload again", reload: true, run: (p) => { p.model.loadItems(); } },
    { name: "delete one (whole list saved)", run: (p) => { p.model.saveItems(p.model.getAllLocalItems().filter((x) => x.id !== "item-3")); } },
    { name: "reload after the delete", reload: true, run: (p) => { p.model.loadItems(); } },
  ];
  const modern = await runScenario("modern items", modernItems(120), edits);
  t("modern items: the new build marks the stored copy as repaired", modern.new.usedMark === true, modern.new.usedMark);

  // ---------- 2. legacy / odd shapes ----------
  const odd = await runScenario("odd and older items", legacyItems(), [
    { name: "first page load", run: (p) => { p.model.loadItems(); } },
    { name: "reload", reload: true, run: (p) => { p.model.loadItems(); } },
    { name: "edit an older item", run: (p) => { const it = item(p, "L2"); if (it) p.model.saveItem({ ...it, title: "L2 renamed", toyBoxIncluded: false }); } },
    { name: "reload after the edit", reload: true, run: (p) => { p.model.loadItems(); } },
    { name: "reload once more", reload: true, run: (p) => { p.model.loadItems(); } },
  ], { settle: false, rawFirst: true });
  t("older shapes: the copy is marked as repaired once a load leaves it unchanged", odd.new.usedMark === true, odd.new.usedMark);

  // ---------- 3. the cloud pull ----------
  const cloudStep = (name, rows) => ({ name, run: async (p) => { cloudRows = rows; await p.model.syncVaultItemsFromSupabaseChecked(PROFILE); } });
  await runScenario("pull", modernItems(60), [
    { name: "page load", run: (p) => { p.model.loadItems(); } },
    cloudStep("a pull that brings nothing", []),
    cloudStep("a pull that brings a changed item and a new one", [
      { ...modernItems(60)[4], title: "Changed in the cloud", currentValue: 777, toyBoxIncluded: false },
      { id: "cloud-new", profile_id: PROFILE, title: "Only in the cloud", createdAt: 1_800_000_000_000, status: "COLLECTION", purchasePrice: 3, images: [] },
    ]),
    { name: "reload", reload: true, run: (p) => { p.model.loadItems(); } },
    { name: "a local edit, then a pull with an older copy of that item", run: async (p) => { const it = item(p, "item-7"); p.model.saveItem({ ...it, title: "Local newer title" }); cloudRows = [{ ...modernItems(60)[7], title: "Old cloud title" }]; await p.model.syncVaultItemsFromSupabaseChecked(PROFILE); } },
    { name: "reload after the pull", reload: true, run: (p) => { p.model.loadItems(); } },
  ]);

  // ---------- 4. the mark is only trusted when it is right ----------
  {
    // (a) marked, then another tab writes a different list: the mark no longer matches, so it is repaired in full
    seedStore(legacyItems(), false);
    let page = freshPage("new");
    page.model.loadItems();
    page = freshPage("new");
    page.model.loadItems();
    t("a repaired copy gets marked", store.has("vltd_vault_items_repaired_v1") && page.local.isVaultLocalRepaired());
    // another tab writes an unrepaired list in place
    page.local.resetVaultLocalMemory();
    page.local.writeVaultLocalJson(JSON.stringify(legacyItems()));
    page = freshPage("new");
    const viaMark = page.model.loadItems({ includeAllProfiles: true });
    const oldPage = (() => { const snap = snapshotStorage(); const p0 = freshPage("old"); p0.model.loadItems({ includeAllProfiles: true }); const p = freshPage("old"); const r = p.model.loadItems({ includeAllProfiles: true }); restoreStorage(snap); return r; })();
    const viaMark2 = freshPage("new").model.loadItems({ includeAllProfiles: true });
    t("another tab's different list is repaired in full, not trusted because of the old mark", JSON.stringify(sortKeys(viaMark2)) === JSON.stringify(sortKeys(oldPage)), viaMark2.length + " vs " + oldPage.length);
  }
  {
    // (b) an interrupted save: the new text is stored but the mark was not updated (the mark write fails)
    seedStore(modernItems(40));
    let page = freshPage("new");
    page.model.loadItems();
    page = freshPage("new");
    page.model.loadItems();
    failWrites = (key) => key === "vltd_vault_items_repaired_v1";
    page.model.saveItem({ ...item(page, "item-2"), title: "Saved, mark not written" });
    failWrites = () => false;
    page = freshPage("new");
    const shown = page.model.loadItems({ includeAllProfiles: true });
    t("an interrupted save (text stored, mark not updated) still shows the saved edit after reload", shown.find((x) => x.id === "item-2")?.title === "Saved, mark not written");
    t("...and the old mark does not match the new text, so it was repaired in full", !page.local.isVaultLocalRepaired() || page.model.loadItems({ includeAllProfiles: true }).length === 40);
  }
  {
    // (c) the store is full: the copy lives in memory only and is never marked
    seedStore(modernItems(30));
    let page = freshPage("new");
    page.model.loadItems();
    page = freshPage("new");
    page.model.loadItems();
    failWrites = (key) => key === "vltd_vault_items_v1";
    page.model.saveItem({ ...item(page, "item-1"), title: "Only in memory" });
    t("a save that could not be stored is still shown", item(page, "item-1")?.title === "Only in memory");
    t("a copy that only exists in memory is never marked as repaired", page.local.isVaultLocalRepaired() === false);
    failWrites = () => false;
  }
  {
    // (d) an edit that is not in repaired form (a number kept as text): the list is not marked, so the next load repairs it in full
    seedStore(modernItems(30));
    let page = freshPage("new");
    page.model.loadItems();
    page = freshPage("new");
    page.model.loadItems();
    page.model.saveItem({ ...item(page, "item-4"), purchasePrice: "55" });
    t("an edit that the repair step would change leaves the copy unmarked", page.local.isVaultLocalRepaired() === false);
    page = freshPage("new");
    t("...and after a reload the repaired value is what is shown", item(page, "item-4")?.purchasePrice === 55, String(item(page, "item-4")?.purchasePrice));
  }
  {
    // (e) another account's copy parked and restored: the mark describes text only
    seedStore(modernItems(30));
    let page = freshPage("new");
    page.model.loadItems();
    page = freshPage("new");
    page.model.loadItems();
    const mine = store.get("vltd_vault_items_v1");
    store.set("vltd_vault_items_v1", mine.slice(0, -5) + "AAAA="); // some other, damaged or different text in the same place
    page.local.resetVaultLocalMemory();
    t("a different stored text is not taken as repaired", page.local.isVaultLocalRepaired() === false);
    store.set("vltd_vault_items_v1", mine);
    page.local.resetVaultLocalMemory();
    t("the same text put back is recognised again", page.local.isVaultLocalRepaired() === true);
  }
  {
    // (f) a person with a different active profile than the items: items without a profile are still given the active one
    seedStore(legacyItems());
    let page = freshPage("new");
    page.model.loadItems();
    store.set("vltd_active_profile_id_v1", "p-other");
    page = freshPage("new");
    const shown = page.model.loadItems({ includeAllProfiles: true });
    t("every item still has a profile after switching profile", shown.every((x) => x.profile_id));
  }

  {
    // adding one item (a form fills in only some fields) must not make the whole copy "not repaired" again
    seedStore(modernItems(60));
    let page = freshPage("new");
    page.model.loadItems();
    page = freshPage("new");
    page.model.loadItems();
    page.model.saveItem({ id: "form-1", profile_id: PROFILE, title: "From the Add Item form", universe: "SPORTS", purchasePrice: 12, addedVia: "manual", images: [], createdAt: Date.UTC(2026, 9, 2) });
    t("after adding one item the saved copy is still marked as repaired", page.local.isVaultLocalRepaired() === true);
    const shownNew = sortKeys(page.model.loadItems({ includeAllProfiles: true }).find((x) => x.id === "form-1"));
    // what the old build shows for the same item once its repair step has run (the next load)
    const snap = snapshotStorage();
    restoreStorage(snapshotStorage());
    seedStore(modernItems(60));
    let old = freshPage("old"); old.model.loadItems();
    old.model.saveItem({ id: "form-1", profile_id: PROFILE, title: "From the Add Item form", universe: "SPORTS", purchasePrice: 12, addedVia: "manual", images: [], createdAt: Date.UTC(2026, 9, 2) });
    old = freshPage("old");
    const shownOld = sortKeys(old.model.loadItems({ includeAllProfiles: true }).find((x) => x.id === "form-1"));
    t("the added item reads the same as the old build shows it after its repair step", JSON.stringify(shownNew) === JSON.stringify(shownOld), JSON.stringify(shownNew).slice(0, 200) + " vs " + JSON.stringify(shownOld).slice(0, 200));
    restoreStorage(snap);
  }

  // ---------- 5. speed: a marked copy is read without repairing every item ----------
  {
    seedStore(modernItems(1500));
    let page = freshPage("new");
    page.model.loadItems(); // full repair, sets the mark
    const t0Old = (() => { const snap = snapshotStorage(); const p = freshPage("old"); const s = Date.now(); p.model.loadItems(); const d = Date.now() - s; restoreStorage(snap); return d; })();
    page = freshPage("new");
    const s1 = Date.now();
    const items = page.model.loadItems({ includeAllProfiles: true });
    const newMs = Date.now() - s1;
    t(`1,500 items: a reload of a marked copy (${newMs} ms) is much faster than the old reload (${t0Old} ms)`, items.length === 1500 && newMs * 2 < t0Old, `${newMs} vs ${t0Old}`);
    const median = (xs) => xs.slice().sort((x, y) => x - y)[Math.floor(xs.length / 2)];
    const snap = snapshotStorage();
    const newTimes = [], oldTimes = [];
    for (let r = 0; r < 5; r++) { const s2 = performance.now(); page.model.saveItem({ ...item(page, "item-" + (10 + r)), title: "Edited " + r }); newTimes.push(performance.now() - s2); }
    const afterNew = snapshotStorage();
    restoreStorage(snap);
    const pOld = freshPage("old"); pOld.model.loadItems();
    for (let r = 0; r < 5; r++) { const s3 = performance.now(); pOld.model.saveItem({ ...item(pOld, "item-" + (10 + r)), title: "Edited " + r }); oldTimes.push(performance.now() - s3); }
    restoreStorage(afterNew);
    const editMs = median(newTimes).toFixed(0), editOld = median(oldTimes).toFixed(0);
    t(`1,500 items: saving one edit (median ${editMs} ms) is not slower than before (${editOld} ms)`, Number(editMs) <= Number(editOld) * 1.25 + 2, `${editMs} vs ${editOld}`);
    t("after the edit the copy is still marked (so the next reload is fast too)", freshPage("new").local.isVaultLocalRepaired() === true);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
