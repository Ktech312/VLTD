// Regression tests for how the Vault reads this device's saved copy and the cloud, so the page stays usable.
// Runs the real src/lib/vaultModel.ts and vaultLocalStore.ts (transpiled on the fly) against a simulated browser: no network.
//
//   npm run test:vault-load
//
// Defects (demonstrated 2026-10-14 on a 1,484-item collection): every read of the device copy decoded, repaired and re-saved all
// items (~0.4 s each, dozens per page load, which froze the page), and a cloud pull that failed looked the same as one that
// found nothing, so a page could show "your vault is empty" for a Vault that had simply not arrived.

const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-load-"));
for (const name of ["vaultModel", "vaultLocalStore", "sessionGuard"]) {
  const src = fs.readFileSync(path.join(root, "src", "lib", name + ".ts"), "utf8");
  fs.writeFileSync(
    path.join(out, name + ".js"),
    ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  );
}

// ---- simulated browser ----
let store = new Map();
let quota = Infinity;
const storage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    const next = new Map(store); next.set(k, String(v));
    let size = 0; for (const [a, b] of next) size += a.length + b.length;
    if (size > quota) throw new Error("QuotaExceededError");
    store.set(k, String(v));
  },
  removeItem: (k) => { store.delete(k); },
};
global.window = {
  localStorage: storage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
};
Object.defineProperty(global, "localStorage", { get: () => global.window.localStorage, configurable: true });

// ---- fakes for what vaultModel imports ----
let cloudRows = []; // what the fake cloud holds for the profile
let cloudFails = false;
let clientSession = true; // does the fake browser client hold a signed-in session?
let deltaCalls = 0;
const mocks = {
  vaultCloud: {
    hasSupabaseEnv: () => true,
    isDirectBrowserImageUrl: (u) => /^https?:|^blob:|^data:|^\//.test(String(u || "")),
    getVaultImagePublicUrl: (k) => `https://cdn.example/${k}`,
    fetchVaultItemsDelta: async () => {
      deltaCalls++;
      if (cloudFails) throw new Error("Failed to fetch");
      return { items: cloudRows.map((r) => ({ ...r })), cursor: undefined, delta: false };
    },
  },
  supabaseClient: { getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: clientSession ? { access_token: "x" } : null } }) } }) },
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
const model = require(path.join(out, "vaultModel.js"));
const localStore = require(path.join(out, "vaultLocalStore.js"));

let pass = 0, fail = 0;
const t = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail ?? ""); } };

const PROFILE = "p-1";
function makeItems(n, profile = PROFILE) {
  return Array.from({ length: n }, (_, i) => ({
    id: `item-${i}`, profile_id: profile, title: `Item ${i}`, universe: "SPORTS", category: "Sports Cards", createdAt: 1_700_000_000_000 + i,
    purchasePrice: i, status: "COLLECTION", isNew: false, isPublic: false,
    images: [{ id: `https://img.example/${i}.jpg`, storageKey: `https://img.example/${i}.jpg`, url: `https://img.example/${i}.jpg`, order: 0 }],
    notes: "n".repeat(300),
  }));
}
function seed(items) {
  store = new Map();
  store.set("vltd-auth", JSON.stringify({ user: { id: "user-1" } }));
  store.set("vltd_active_profile_id_v1", PROFILE);
  localStore.resetVaultLocalMemory();
  localStore.writeVaultLocalJson(JSON.stringify(items));
}

// 1. A read of an unchanged device copy is cheap, and gives the same answer every time.
{
  seed(makeItems(1500));
  const first = model.loadItems({ profileId: PROFILE });
  const t0 = Date.now();
  let last;
  for (let i = 0; i < 60; i++) last = model.loadItems({ profileId: PROFILE });
  const ms = Date.now() - t0;
  t("1,500 items load", first.length === 1500 && last.length === 1500);
  t(`60 further reads of an unchanged copy take well under what one repair pass costs (${ms} ms)`, ms < 1500, ms + " ms");
  t("same items come back", JSON.stringify(first.map((i) => i.id)) === JSON.stringify(last.map((i) => i.id)));
}

// 2. What a caller does to the items it received never leaks into what the next caller gets.
{
  seed(makeItems(5));
  const a = model.loadItems({ profileId: PROFILE });
  a[0].title = "Changed in a caller";
  a[0].isNew = true;
  a.pop();
  const b = model.loadItems({ profileId: PROFILE });
  const first = b.find((i) => i.id === "item-0");
  t("a caller's edits are not seen by the next read", b.length === 5 && first && first.title === "Item 0" && first.isNew === false, JSON.stringify(b.map((i) => i.title)));
  t("the list itself is a fresh array every time", model.loadItems({ profileId: PROFILE }) !== model.loadItems({ profileId: PROFILE }));
}

// 3. A change to the device copy is seen immediately: a save here, a save from another tab, a restore.
{
  seed(makeItems(5));
  model.loadItems({ profileId: PROFILE });
  model.saveItem({ ...model.loadItems({ profileId: PROFILE }).find((i) => i.id === "item-2"), title: "Renamed" });
  t("a save is seen by the next read", model.loadItems({ profileId: PROFILE }).find((i) => i.id === "item-2").title === "Renamed");

  // another tab writes a different list straight into storage
  localStore.resetVaultLocalMemory();
  localStore.writeVaultLocalJson(JSON.stringify(makeItems(3)));
  const afterOtherTab = model.loadItems({ profileId: PROFILE });
  t("a write from another tab is seen by the next read", afterOtherTab.length === 3, String(afterOtherTab.length));

  // the stored copy is removed (another person took the device over)
  store.delete("vltd_vault_items_v1");
  localStore.resetVaultLocalMemory();
  t("an emptied device copy reads as empty, not as the remembered list", model.loadItems({ profileId: PROFILE }).length === 0);
}

// 4. Items of another profile are still never returned.
{
  seed([...makeItems(3), ...makeItems(2, "other-profile").map((i, n) => ({ ...i, id: "o" + n }))]);
  const mine = model.loadItems({ profileId: PROFILE });
  t("only the asked-for profile's items are returned", mine.length === 3 && mine.every((i) => i.profile_id === PROFILE));
}

// 5. A full browser store: the page keeps working from memory and does not recompress megabytes on every read.
{
  seed(makeItems(5));
  model.loadItems({ profileId: PROFILE });
  quota = 1; // nothing more fits
  model.saveItem({ ...model.loadItems({ profileId: PROFILE })[0], title: "Kept in memory" });
  const t0 = Date.now();
  let seen = null;
  for (let i = 0; i < 30; i++) seen = model.loadItems({ profileId: PROFILE });
  t("a save that could not be stored is still seen", seen.some((i) => i.title === "Kept in memory"));
  t(`30 reads while the store is full are fast (${Date.now() - t0} ms)`, Date.now() - t0 < 1500);
  quota = Infinity;
}

// 6. The cloud pull says whether the cloud really answered. (A different profile each time: a pull that just finished for the same
// profile and an unchanged device copy is deliberately reused for a few seconds.)
(async () => {
  seed([]);
  cloudFails = true;
  const failed = await model.syncVaultItemsFromSupabaseChecked("p-fail");
  t("a failed pull is reported as not answered (not as an empty vault)", failed.ok === false && failed.items.length === 0);

  // A failed download makes the next automatic one wait (3 s, 6 s ... 5 min; added in 3d26569). That wait is the app working as designed,
  // so the test clears it between scenarios the way the Retry button does.
  model.resetCloudBackoff();
  cloudFails = false;
  cloudRows = [];
  const empty = await model.syncVaultItemsFromSupabaseChecked("p-empty");
  t("a pull that finds nothing is reported as answered", empty.ok === true && empty.items.length === 0);

  cloudRows = makeItems(4, "p-full");
  const filled = await model.syncVaultItemsFromSupabaseChecked("p-full");
  t("a pull that finds items returns them", filled.ok === true && filled.items.length === 4, String(filled.items.length));

  // nobody signed in: nothing is pulled and nothing is claimed
  store.delete("vltd-auth");
  const nobody = await model.syncVaultItemsFromSupabaseChecked("p-nobody");
  t("with nobody signed in the pull is not reported as answered", nobody.ok === false);

  // 7. An answer from a cloud we could not ask properly is never read as "empty".
  store.set("vltd-auth", JSON.stringify({ user: { id: "user-1" } })); // (signed in again)
  cloudFails = false; cloudRows = [];
  clientSession = false;
  const noSession = await model.syncVaultItemsFromSupabaseChecked("p-nosession");
  t("a client that holds no signed-in session has not been answered (the database would say no rows)", noSession.ok === false);
  clientSession = true;
  const noProfile = await model.syncVaultItemsFromSupabaseChecked("");
  t("no active profile: not answered, not empty", noProfile.ok === false);
  const fine = await model.syncVaultItemsFromSupabaseChecked("p-fine");
  t("with a session and a profile the same empty answer is a real one", fine.ok === true);

  console.log(`
${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
