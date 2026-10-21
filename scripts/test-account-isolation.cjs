// Regression tests for account isolation: one person's saved data must never reach the next person who signs in on the same
// browser, a late answer for someone who has left must never be saved for someone else, and the Vault must not re-run its sync
// forever. Runs the real source files (transpiled on the fly) against a simulated browser: no network, no Supabase.
//
//   npm run test:isolation
//
// Every test below was written for a defect that was demonstrated on the live site (2026-10-13); the comment above each says which.

const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-isolation-"));

// Source files under test, transpiled flat into one folder.
const FILES = ["localDataOwner", "sessionGuard", "vaultLocalStore", "vaultSyncQueue", "collectionGoals", "cloudSaveStatus", "specsDeviceOnly", "pushNotifications", "onboardingDraft", "goalRules"];
for (const name of FILES) {
  const src = fs.readFileSync(path.join(root, "src", "lib", name + ".ts"), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  fs.writeFileSync(path.join(out, name + ".js"), js);
}

// ---- simulated browser ----
let store;
let quota = Infinity; // total characters allowed, to simulate a full browser store
let storageBroken = false;
function makeStorage() {
  store = new Map();
  return {
    get length() { if (storageBroken) throw new Error("storage unavailable"); return store.size; },
    key: (i) => { if (storageBroken) throw new Error("storage unavailable"); return Array.from(store.keys())[i] ?? null; },
    getItem: (k) => { if (storageBroken) throw new Error("storage unavailable"); return store.has(k) ? store.get(k) : null; },
    setItem: (k, v) => {
      if (storageBroken) throw new Error("storage unavailable");
      const next = new Map(store); next.set(k, String(v));
      let size = 0; for (const [a, b] of next) size += a.length + b.length;
      if (size > quota) throw new Error("QuotaExceededError");
      store.set(k, String(v));
    },
    removeItem: (k) => { if (storageBroken) throw new Error("storage unavailable"); store.delete(k); },
  };
}
const events = [];
global.Event = class { constructor(n) { this.type = n; } };
global.window = {
  localStorage: makeStorage(),
  dispatchEvent: (e) => { events.push(e.type); return true; },
  addEventListener: () => {},
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
};
Object.defineProperty(global, "navigator", { value: { onLine: true }, configurable: true });
Object.defineProperty(global, "localStorage", { get: () => global.window.localStorage, configurable: true });
function reset() {
  storageBroken = false; quota = Infinity;
  global.window.localStorage = makeStorage();
  events.length = 0;
}
const get = (k) => (store.has(k) ? store.get(k) : null);
const set = (k, v) => store.set(k, v);

// ---- module wiring: relative and "@/lib/..." imports go to the transpiled copies, or to a mock ----
const mocks = {};
// vaultCloud is mocked (it talks to the network) but isNetworkFailure is a pure rule that collectionGoals depends on: use the real code from the source file
const vaultCloudSrc = fs.readFileSync(path.join(root, "src", "lib", "vaultCloud.ts"), "utf8");
const nfStart = vaultCloudSrc.indexOf("export function isNetworkFailure");
const nfEnd = vaultCloudSrc.indexOf("\n}\n", nfStart) + 3;
const realIsNetworkFailure = new Function("exports", ts.transpileModule(vaultCloudSrc.slice(nfStart, nfEnd), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText + "; return exports.isNetworkFailure;")({});
mocks.vaultCloud = { isNetworkFailure: realIsNetworkFailure };
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === "fflate") return origLoad.call(this, path.join(root, "node_modules", "fflate"), parent, ...rest);
  const m = request.match(/^(?:\.\/|@\/lib\/)([A-Za-z0-9_]+)$/);
  if (m) {
    if (mocks[m[1]]) return mocks[m[1]];
    if (FILES.includes(m[1])) return origLoad.call(this, path.join(out, m[1] + ".js"), parent, ...rest);
  }
  return origLoad.call(this, request, parent, ...rest);
};
const load = (name) => require(path.join(out, name + ".js"));

let pass = 0, fail = 0;
const t = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail ?? ""); } };
const session = (id) => JSON.stringify({ access_token: "x", user: { id } });

const A = "user-A", B = "user-B", PA = "profile-A", PB = "profile-B", PUB = "profile-someone-else";
const itemsA = JSON.stringify([{ id: "a1", title: "A item", profile_id: PA }]);
const publicCache = JSON.stringify([{ id: "pub1", profile_id: PUB, title: "Someone's public exhibition", visibility: "PUBLIC" }]);
const galleriesA = JSON.stringify([{ id: "gA", profile_id: PA, title: "A locked", visibility: "LOCKED" }, { id: "pub1", profile_id: PUB, title: "Someone's public exhibition", visibility: "PUBLIC" }]);

(async () => {
  const owner = load("localDataOwner");
  const guard = load("sessionGuard");
  const vls = load("vaultLocalStore");

  // === Defect: account A's data was shown to account B on the same browser (found 2026-10-13) ===
  reset();
  owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
  set("vltd_vault_items_v1", itemsA); set("vltd_galleries", galleriesA); set("vltd_collection_goals_v1:" + PA, "[goalA]"); set("vltd_active_profile_id_v1", PA);
  set("vltd-theme", "cloud-gradient");
  owner.reconcileLocalDataOwner(B); owner.resolveLegacyOwner(B, []);
  t("B signing in after A sees none of A's items, exhibitions, goals or active profile", get("vltd_vault_items_v1") === null && get("vltd_galleries") === null && get("vltd_collection_goals_v1:" + PA) === null && get("vltd_active_profile_id_v1") === null);
  t("display settings are not moved", get("vltd-theme") === "cloud-gradient");
  t("A's data is parked, not deleted", get("vltd_stash:" + A + ":vltd_vault_items_v1") === itemsA);
  owner.reconcileLocalDataOwner(null);
  owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
  t("A signing back in gets everything back", get("vltd_vault_items_v1") === itemsA && get("vltd_collection_goals_v1:" + PA) === "[goalA]" && get("vltd_active_profile_id_v1") === PA);

  // === Defect: after sign-out the site caches other people's PUBLIC exhibitions; on the next sign-in (even the SAME person) that
  //     cache was read as proof the device held foreign private data, and the person's OWN restored data was quarantined ===
  reset();
  owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
  set("vltd_vault_items_v1", itemsA); set("vltd_galleries", galleriesA); set("vltd_collection_goals_v1:" + PA, "[goalA]");
  set("vltd_wishlist:" + PA, "[wishA]"); set("vltd_sync_queue_v1", '[{"itemId":"a1"}]'); set("vltd_active_profile_id_v1", PA);
  owner.reconcileLocalDataOwner(null);
  set("vltd_galleries", publicCache); // the signed-out site refills its public exhibitions
  owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
  t("same person back in: own goals, wishlist, sync queue are restored, not quarantined",
    get("vltd_collection_goals_v1:" + PA) === "[goalA]" && get("vltd_wishlist:" + PA) === "[wishA]" && get("vltd_sync_queue_v1") === '[{"itemId":"a1"}]' && get("vltd_active_profile_id_v1") === PA);
  t("same person back in: nothing ended up in the unattributed quarantine", !Array.from(store.keys()).some((k) => k.startsWith("vltd_stash:unattributed")));
  const g = JSON.parse(get("vltd_galleries") || "[]").map((r) => r.id).sort().join(",");
  t("same person back in: own private exhibition returns and is merged with the public cache", g === "gA,pub1", g);
  t("owner is recorded again", get("vltd_local_owner_v1") === A);

  // === Defect: the public-exhibition cache (other people's profile ids) was parked as private "unattributed" data ===
  reset();
  set("vltd_galleries", publicCache);
  owner.reconcileLocalDataOwner(B); owner.resolveLegacyOwner(B, [PB]);
  t("a browser holding only the public exhibition cache is not quarantined", !Array.from(store.keys()).some((k) => k.startsWith("vltd_stash:unattributed")) && get("vltd_local_owner_v1") === B);

  // === Browser from before owners were recorded ===
  reset();
  set("vltd_vault_items_v1", itemsA); set("vltd_google_token_v1", "A-GOOGLE"); set("vltd_active_profile_id_v1", PA);
  owner.reconcileLocalDataOwner("user-new"); owner.resolveLegacyOwner("user-new", []);
  t("legacy browser: a new account does not inherit the old data", get("vltd_vault_items_v1") === null && get("vltd_local_owner_v1") === "user-new");
  t("legacy browser: the old data is quarantined", get("vltd_stash:unattributed:vltd_vault_items_v1") === itemsA);
  t("legacy browser: nothing is uploaded or assigned (no profile/owner keys point at the new account)", get("vltd_active_profile_id_v1") === null);
  owner.reconcileLocalDataOwner(null);
  owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
  t("legacy browser: the real owner gets the quarantined data back automatically", get("vltd_vault_items_v1") === itemsA && get("vltd_active_profile_id_v1") === PA);

  // === Defect: a second quarantine overwrote the first (same key names) ===
  reset();
  set("vltd_vault_items_v1", itemsA); set("vltd_active_profile_id_v1", PA);
  owner.reconcileLocalDataOwner("user-x"); owner.resolveLegacyOwner("user-x", []);
  const first = get("vltd_stash:unattributed:vltd_vault_items_v1");
  owner.reconcileLocalDataOwner(null);
  set("vltd_vault_items_v1", JSON.stringify([{ id: "z", profile_id: "profile-Z" }])); set("vltd_active_profile_id_v1", "profile-Z");
  owner.reconcileLocalDataOwner("user-y"); owner.resolveLegacyOwner("user-y", []);
  t("a later quarantine does not overwrite an earlier one", get("vltd_stash:unattributed:vltd_vault_items_v1") === first && get("vltd_stash:unattributed-2:vltd_vault_items_v1") !== null);
  owner.reconcileLocalDataOwner(null);
  owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
  t("each quarantine goes back only to the person who owns what it names", get("vltd_vault_items_v1") === itemsA && get("vltd_stash:unattributed-2:vltd_vault_items_v1") !== null);

  // === Mixed legacy cache is never given to someone who owns only part of it ===
  reset();
  set("vltd_vault_items_v1", JSON.stringify([{ id: "a1", profile_id: PA }, { id: "b1", profile_id: PB }]));
  owner.reconcileLocalDataOwner("user-x"); owner.resolveLegacyOwner("user-x", []);
  owner.reconcileLocalDataOwner(null); owner.reconcileLocalDataOwner(B); owner.resolveLegacyOwner(B, [PB]);
  t("mixed legacy cache stays quarantined for someone who owns only part", get("vltd_vault_items_v1") === null && get("vltd_stash:unattributed:vltd_vault_items_v1") !== null);

  // === A quarantine saved by the earlier version with a wrong id list (it counted public exhibitions) heals ===
  reset();
  set("vltd_stash:unattributed:vltd_vault_items_v1", itemsA); set("vltd_stash:unattributed:vltd_active_profile_id_v1", PA);
  set("vltd_stash:unattributed:vltd_collection_goals_v1:" + PA, "[goalA]");
  set("vltd_stash:unattributed:__profile_ids", JSON.stringify([PA, PUB]));
  set("vltd_local_owner_v1", A);
  owner.resolveLegacyOwner(A, [PA]);
  t("an earlier mis-parked quarantine is returned to its real owner", get("vltd_vault_items_v1") === itemsA && get("vltd_collection_goals_v1:" + PA) === "[goalA]" && get("vltd_stash:unattributed:__profile_ids") === null);

  // === Credentials: a Google token is removed on account change / sign-out, never parked, never restored ===
  reset();
  owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
  set("vltd_google_token_v1", "A-GOOGLE"); set("vltd_google_token_expires_v1", "999"); set("vltd_google_sheet_id_v1", "sheetA");
  set("vltd_mfa_trusted_device_v1", JSON.stringify({ [A]: "trusted-token-A" }));
  owner.reconcileLocalDataOwner(B);
  t("Google token is gone for the next person", get("vltd_google_token_v1") === null && get("vltd_google_token_expires_v1") === null);
  t("Google token is not parked anywhere", !Array.from(store.entries()).some(([k, v]) => /GOOGLE/.test(v) || k.includes("google_token")));
  owner.reconcileLocalDataOwner(null); owner.reconcileLocalDataOwner(A);
  t("Google token is not restored when the first person returns", get("vltd_google_token_v1") === null);
  t("the per-user two-step 'trusted device' record is left as the app keeps it (not parked, not copied)", get("vltd_mfa_trusted_device_v1") === JSON.stringify({ [A]: "trusted-token-A" }) && !Array.from(store.keys()).some((k) => k.startsWith("vltd_stash:") && k.includes("mfa")));
  t("sign-in sessions are never touched", (() => { set("vltd-auth", session(A)); owner.reconcileLocalDataOwner(B); owner.reconcileLocalDataOwner(null); return get("vltd-auth") === session(A); })());

  // === Browser store full: the old person's data must still leave the live keys ===
  reset();
  owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
  const big = JSON.stringify([{ id: "a1", profile_id: PA, pad: "x".repeat(4000) }]);
  set("vltd_vault_items_v1", big); set("vltd_active_profile_id_v1", PA);
  let size = 0; for (const [k, v] of store) size += k.length + v.length;
  quota = size + 50; // no room for a second copy
  owner.reconcileLocalDataOwner(B);
  t("full browser store: A's items are still moved out of B's view", get("vltd_vault_items_v1") === null && get("vltd_stash:" + A + ":vltd_vault_items_v1") === big);

  // === Storage unavailable or malformed: no crash, nothing leaks ===
  reset();
  storageBroken = true;
  let threw = false;
  try { owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]); owner.reconcileLocalDataOwner(null); } catch { threw = true; }
  t("unavailable storage does not throw", !threw);
  reset();
  set("vltd_vault_items_v1", "z64:not-valid-base64!!"); set("vltd_galleries", "{{{ not json"); set("vltd_active_profile_id_v1", PA);
  threw = false;
  try { owner.reconcileLocalDataOwner("user-n"); owner.resolveLegacyOwner("user-n", [PA]); } catch { threw = true; }
  t("malformed stored copies do not throw and name no foreign profile", !threw && get("vltd_local_owner_v1") === "user-n" && get("vltd_active_profile_id_v1") === PA);

  // === Real compressed vault copy: ownership is read from inside it ===
  reset();
  vls.writeVaultLocalJson(JSON.stringify([{ id: "a1", profile_id: PA }]));
  t("(setup) the vault copy is stored compressed", (get("vltd_vault_items_v1") || "").startsWith("z64:"));
  owner.reconcileLocalDataOwner("user-x"); owner.resolveLegacyOwner("user-x", []);
  owner.reconcileLocalDataOwner(null); owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
  t("a compressed quarantined copy returns to its owner", vls.readVaultLocalJson() === JSON.stringify([{ id: "a1", profile_id: PA }]));

  // === Memory copy kept while a write was failing must not outlive an account change ===
  reset();
  owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
  quota = 10; // nothing fits: the vault copy is held in memory only
  vls.writeVaultLocalJson(JSON.stringify([{ id: "a1", title: "A secret", profile_id: PA }]));
  t("(setup) the copy is held only in memory", vls.readVaultLocalJson() !== null && get("vltd_vault_items_v1") === null);
  quota = Infinity;
  set("vltd_vault_items_v1", itemsA);
  owner.reconcileLocalDataOwner(B);
  t("after an account change the in-memory copy of the previous person is forgotten", vls.readVaultLocalJson() === null);

  // === sessionGuard ===
  reset();
  t("no stored session -> nobody signed in", guard.storedSessionUserId() === null);
  set("vltd-auth", session(A)); t("stored session -> its user", guard.storedSessionUserId() === A);
  set("vltd-auth", JSON.stringify({ currentSession: { user: { id: B } } })); t("older stored shape is read too", guard.storedSessionUserId() === B);
  set("vltd-auth", "{{{"); t("malformed stored session -> nobody signed in", guard.storedSessionUserId() === null);
  set("vltd-auth", session(A));
  const same = guard.captureIdentity();
  t("identity unchanged -> still the same", same() === true);
  set("vltd_active_profile_id_v1", PB); t("active profile changed -> not the same", same() === false);
  const same2 = guard.captureIdentity(); set("vltd-auth", session(B)); t("different person signed in -> not the same", same2() === false);
  const same3 = guard.captureIdentity(); store.delete("vltd-auth"); t("signed out -> not the same", same3() === false);

  // === Defect: a goals request for A that finished after B signed in filed A's goals under B / uploaded them to B's profile ===
  reset();
  const pushes = [];
  let release;
  mocks.supabaseClient = {
    getSupabaseBrowserClient: () => ({
      from: () => ({
        select: () => ({ eq: () => new Promise((res) => { release = () => res({ data: [], error: null }); }) }),
        upsert: (row) => { pushes.push(row); return Promise.resolve({}); },
        delete: () => ({ eq: () => ({ eq: () => Promise.resolve({}) }) }),
      }),
    }),
  };
  mocks.legacyKeys = { mayAdoptLegacyKey: () => false };
  const goals = load("collectionGoals");
  set("vltd-auth", session(A)); set("vltd_active_profile_id_v1", PA);
  set("vltd_collection_goals_v1:" + PA, JSON.stringify([{ id: "g1", name: "A goal", targetCount: 3, createdAt: 1 }]));
  const pending = goals.syncGoalsFromSupabase();
  await new Promise((r) => setTimeout(r, 5));
  // B signs in on the device while A's request is still out: A's data is parked, B's profile becomes active
  set("vltd-auth", session(B)); owner.reconcileLocalDataOwner(B); set("vltd_active_profile_id_v1", PB);
  release();
  await pending;
  await new Promise((r) => setTimeout(r, 5));
  t("late answer for A uploads nothing to B's profile", pushes.length === 0, JSON.stringify(pushes));
  t("late answer for A saves nothing under B's profile", get("vltd_collection_goals_v1:" + PB) === null);
  // and the normal case still works
  reset(); pushes.length = 0;
  set("vltd-auth", session(A)); set("vltd_active_profile_id_v1", PA);
  set("vltd_collection_goals_v1:" + PA, JSON.stringify([{ id: "g1", name: "A goal", targetCount: 3, createdAt: 1 }]));
  const p2 = goals.syncGoalsFromSupabase(); await new Promise((r) => setTimeout(r, 5)); release(); await p2; await new Promise((r) => setTimeout(r, 5));
  t("(control) with nobody changing, an empty cloud is seeded from the device's own goals", pushes.length === 1 && pushes[0].profile_id === PA);

  // === Defect: processVaultSyncQueue fired "vault updated" after EVERY run and the open Vault page re-ran it on that event:
  //     a runaway loop (about 15 requests a second) that froze a signed-out tab and flooded the database ===
  reset();
  let pulls = 0, uploads = 0, localSig = "sig1", signatureOnPull = null;
  mocks.vaultModel = {
    getAllLocalItems: () => [{ id: "a1" }],
    saveItem: () => {}, saveItemsBatch: () => {}, noteItemUploaded: () => {},
    syncVaultItemsFromSupabase: async () => { pulls++; if (signatureOnPull) localSig = signatureOnPull; return []; },
  };
  mocks.vaultCloud = { isNetworkFailure: realIsNetworkFailure, hasSupabaseEnv: () => true, upsertVaultItemToSupabase: async () => { uploads++; }, uploadVaultImageToSupabase: async () => ({}) };
  mocks.vaultImageStore = { getImageBlobFromIndexedDb: async () => null };
  mocks.auth = { getStoredActiveProfileId: () => get("vltd_active_profile_id_v1") ?? "" };
  // vaultLocalStore is real, but its signature is what the queue compares: control it through storage
  const queue = load("vaultSyncQueue");
  const dispatched = () => events.filter((e) => e === "vltd:vault-updated").length;
  set("vltd_vault_items_v1", "[]");
  let r = await queue.processVaultSyncQueue();
  t("signed out: nothing is pulled, sent or announced", pulls === 0 && uploads === 0 && dispatched() === 0);
  set("vltd-auth", session(A));
  r = await queue.processVaultSyncQueue();
  t("signed in, nothing changed: the page is NOT told to refresh (loop broken)", pulls === 1 && dispatched() === 0, `pulls=${pulls} dispatched=${dispatched()}`);
  let before = dispatched();
  for (let i = 0; i < 50; i++) await queue.processVaultSyncQueue();
  t("fifty idle runs announce nothing", dispatched() === before);
  signatureOnPull = "z64:changed";
  mocks.vaultModel.syncVaultItemsFromSupabase = async () => { pulls++; set("vltd_vault_items_v1", "[{\"id\":\"new\"}]"); return []; };
  before = dispatched();
  await queue.processVaultSyncQueue();
  t("the pull brought in changes: the page IS told", dispatched() === before + 1);
  set("vltd_sync_queue_v1", JSON.stringify([{ id: "q1", type: "upsert_item", itemId: "a1", createdAt: 1 }]));
  mocks.vaultModel.syncVaultItemsFromSupabase = async () => { pulls++; return []; };
  before = dispatched();
  r = await queue.processVaultSyncQueue();
  t("something was uploaded: the page IS told once", r.processed === 1 && dispatched() === before + 1);
  // A different person signs in while an upload is running: the queue is not written back, nothing else is sent or announced
  set("vltd-auth", session(A)); owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
  set("vltd_sync_queue_v1", JSON.stringify([{ id: "q1", type: "upsert_item", itemId: "a1", createdAt: 1 }, { id: "q2", type: "upsert_item", itemId: "a1", createdAt: 2 }]));
  uploads = 0; before = dispatched();
  let afterSwitch = -1;
  mocks.vaultCloud.upsertVaultItemToSupabase = async () => { uploads++; set("vltd-auth", session(B)); owner.reconcileLocalDataOwner(B); afterSwitch = dispatched(); };
  const queueB = load("vaultSyncQueue");
  await queueB.processVaultSyncQueue();
  t("person changed mid-sync: no further uploads, and the queue run announces nothing of its own", uploads <= 1 && dispatched() === afterSwitch, `uploads=${uploads}`);
  t("person changed mid-sync: A's queue is not written back over the device's data", get("vltd_sync_queue_v1") === null || !/q1|q2/.test(get("vltd_sync_queue_v1")), get("vltd_sync_queue_v1"));

  // === Defect: a refused cloud save was silent. The person must be told "saved on this device only", it must be kept and
  //     retried, and the retry must not create a second copy ===
  {
    reset();
    const status = load("cloudSaveStatus");
    status.resetCloudSaveStatus();
    set("vltd-auth", session(A)); owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
    set("vltd_sync_queue_v1", JSON.stringify([{ id: "q9", type: "upsert_item", itemId: "a1", createdAt: 1 }]));
    const accepted = new Set(); let cloudUp = false; let calls = 0;
    mocks.vaultCloud.upsertVaultItemToSupabase = async (row) => { calls++; if (!cloudUp) throw new Error("cloud refused"); accepted.add(String(row.id)); };
    const q = load("vaultSyncQueue");
    const r1 = await q.processVaultSyncQueue();
    t("cloud refuses: the person is told it is saved on this device only (pending)", status.getCloudSavePhase() === "pending" && r1.remaining === 1, status.getCloudSavePhase());
    t("cloud refuses: the item is kept in the queue, nothing lost", JSON.parse(get("vltd_sync_queue_v1") || "[]").length === 1);
    cloudUp = true;
    await status.retryCloudSavesNow();
    t("retry after recovery: saved to the account, queue empty", status.getCloudSavePhase() === "saved" && JSON.parse(get("vltd_sync_queue_v1") || "[]").length === 0, status.getCloudSavePhase());
    await status.retryCloudSavesNow(); await status.retryCloudSavesNow();
    t("repeated retries create no second copy (one accepted row, no extra uploads)", accepted.size === 1 && calls === 2, "accepted=" + accepted.size + " calls=" + calls);
    set("vltd_sync_queue_v1", JSON.stringify([{ id: "q10", type: "upsert_item", itemId: "a1", createdAt: 2 }]));
    status.resetCloudSaveStatus(); calls = 0;
    Object.defineProperty(global, "navigator", { value: { onLine: false }, configurable: true });
    await q.processVaultSyncQueue();
    t("offline: reported as saved on this device (pending), no cloud call", status.getCloudSavePhase() === "pending" && calls === 0);
    Object.defineProperty(global, "navigator", { value: { onLine: true }, configurable: true });
    status.resetCloudSaveStatus();
    t("sign-out clears the status", status.getCloudSavePhase() === "idle");
    // never claim success while something is still waiting: an item save succeeding must not hide an exhibition that has not synced
    status.reportPending("exhibitions"); status.reportSaved("items");
    t("an item saved while an exhibition is still waiting: still reported as pending, never as saved", status.getCloudSavePhase() === "pending");
    status.reportSaving("items");
    t("saving in progress does not hide a pending save", status.getCloudSavePhase() === "pending");
    status.reportSaved("exhibitions");
    t("exhibition accepted but an item is still being sent: says saving, not saved", status.getCloudSavePhase() === "saving");
    status.reportSaved("items");
    t("only when nothing is waiting or in flight does it say saved", status.getCloudSavePhase() === "saved");
    status.resetCloudSaveStatus();
  }

  // === Defect (2026-10-13): signing out left the account's push subscription active on the device, and the next account could not take
  //     the device over (its save was refused) while the page still said "subscribed" ===
  {
    reset();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
    // simulated browser push: one device endpoint at a time, as a real browser keeps
    let deviceSub = null; let counter = 0; const unsubscribed = [];
    const makeSub = () => { counter += 1; const ep = "https://push.example/endpoint-" + counter; return { endpoint: ep, toJSON: () => ({ endpoint: ep, keys: { p256dh: "p" + counter, auth: "a" + counter } }), unsubscribe: async () => { unsubscribed.push(ep); if (deviceSub && deviceSub.endpoint === ep) deviceSub = null; return true; } }; };
    const pushManager = { getSubscription: async () => deviceSub, subscribe: async () => { deviceSub = makeSub(); return deviceSub; } };
    const reg = { pushManager };
    Object.defineProperty(global, "navigator", { value: { onLine: true, serviceWorker: { getRegistration: async () => reg, register: async () => reg, ready: Promise.resolve(reg) } }, configurable: true });
    global.window.PushManager = function () {};
    global.window.Notification = { permission: "granted", requestPermission: async () => "granted" };
    global.Notification = global.window.Notification;
    global.window.atob = (x) => Buffer.from(x.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("binary");
    global.atob = global.window.atob;

    // the database: one row per endpoint, owned by one profile; an account may only see/change its own rows
    let me = A; const rows = []; const profileOf = { [A]: PA, [B]: PB };
    const owns = (row) => row.profile_id === profileOf[me];
    mocks.supabaseClient = { getSupabaseBrowserClient: () => ({
      from: () => ({
        upsert: async (row) => { const i = rows.findIndex((r) => r.endpoint === row.endpoint); if (i >= 0) { if (!owns(rows[i])) return { error: { message: "row-level security" } }; rows[i] = { ...row }; return { error: null }; } if (row.profile_id !== profileOf[me]) return { error: { message: "row-level security" } }; rows.push({ ...row }); return { error: null }; },
        select: () => ({ eq: (_c, v) => ({ limit: async () => ({ data: rows.filter((r) => r.endpoint === v && owns(r)).map((r) => ({ id: r.endpoint })), error: null }) }) }),
        delete: () => ({ eq: async (_c, v) => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].endpoint === v && owns(rows[i])) rows.splice(i, 1); return { error: null }; } }),
      }),
    }) };
    const push = load("pushNotifications");

    me = A; set("vltd-auth", session(A));
    const okA = await push.subscribeToPush(PA);
    t("A turns notifications on: saved against A, device subscribed", okA && rows.length === 1 && rows[0].profile_id === PA && (await push.getPushSubscriptionState()) === "subscribed");

    // old behaviour reproduced: A walks away without turning it off, B signs in on the same device
    me = B; set("vltd-auth", session(B));
    t("B does NOT see A's subscription as its own (state is unsubscribed, not 'subscribed')", (await push.getPushSubscriptionState()) === "unsubscribed");
    const okB = await push.subscribeToPush(PB);
    t("B can take the device over: fresh subscription saved against B", okB && rows.some((r) => r.profile_id === PB) && deviceSub && rows.find((r) => r.profile_id === PB).endpoint === deviceSub.endpoint);
    t("A's old endpoint was ended in the browser (A's notifications no longer reach this device)", unsubscribed.includes("https://push.example/endpoint-1"));

    // sign-out path
    me = B;
    await push.releasePushOnSignOut();
    t("sign-out removes the account's row and the browser subscription", !rows.some((r) => r.profile_id === PB) && deviceSub === null);
    t("sign-out keeps the opt-in so the same account can be restored on its next sign-in", get("vltd_push_optin_v1") === "1");
    await push.restorePushIfOptedIn(PB);
    t("next sign-in of the same account restores notifications without asking again", rows.some((r) => r.profile_id === PB) && deviceSub !== null);
    // explicit turn-off forgets the opt-in
    await push.unsubscribeFromPush();
    t("turning notifications off yourself removes the opt-in and the row", get("vltd_push_optin_v1") === null && !rows.some((r) => r.profile_id === PB));
    // takeover of a device by another account drops the browser subscription
    me = A; await push.subscribeToPush(PA);
    await push.dropDevicePushSubscription();
    t("another account taking over drops the device's browser subscription", deviceSub === null);
  }

  // === Defect (2026-10-15 review of 33bd6ea/9b2184d): the onboarding draft key was bumped to _v3 but only _v2 was in
  //     USER_DATA_BASES, so the draft (name, username and business website) was never parked on sign-out and stayed in the
  //     browser for the next person; 9b2184d only stopped it being loaded into B's form, not left behind ===
  {
    reset();
    const draftA = JSON.stringify({ step: 3, display_name: "Alex", username: "alex", add_business: true, business_name: "Alex Co", owner_user_id: A });
    owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, []);
    set("vltd_onboarding_draft_v3", draftA);
    owner.reconcileLocalDataOwner(B); owner.resolveLegacyOwner(B, []);
    t("onboarding draft: B signing in after A does not find A's draft (name, business details) in the browser", get("vltd_onboarding_draft_v3") === null);
    t("onboarding draft: A's draft is parked, not deleted", get("vltd_stash:" + A + ":vltd_onboarding_draft_v3") === draftA);
    owner.reconcileLocalDataOwner(null);
    owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, []);
    t("onboarding draft: A signing back in gets the draft back", get("vltd_onboarding_draft_v3") === draftA);

    // 9b2184d: a draft belongs to the account that wrote it
    reset();
    const od = load("onboardingDraft");
    od.saveOnboardingDraft({ display_name: "Alex", username: "alex", owner_user_id: A, personal_profile_id: "p-A" });
    const forB = od.loadOnboardingDraft(B);
    t("onboarding draft: an account never loads another account's draft", forB.display_name === "" && forB.personal_profile_id === "");
    const forA = od.loadOnboardingDraft(A);
    t("onboarding draft: the owner still loads their own draft", forA.display_name === "Alex" && forA.personal_profile_id === "p-A");
    od.saveOnboardingDraft({ display_name: "Bea", owner_user_id: B });
    const mixed = od.loadOnboardingDraft(B);
    t("onboarding draft: B's first save starts clean and keeps nothing of A's", mixed.display_name === "Bea" && mixed.username === "" && mixed.personal_profile_id === "");
  }

  // === Defect (demonstrated 2026-10-14, live): one refused item stopped every item behind it from uploading, in every profile.
  //     A business item the cloud would accept sat behind a personal item it refused, "sync pending", for ever ===
  {
    reset();
    const status = load("cloudSaveStatus");
    status.resetCloudSaveStatus();
    set("vltd-auth", session(A)); owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
    mocks.vaultModel.getAllLocalItems = () => [{ id: "bad" }, { id: "good1" }, { id: "good2" }];
    const accepted = [];
    mocks.vaultCloud.upsertVaultItemToSupabase = async (row) => {
      if (String(row.id) === "bad") throw new Error("new row violates row-level security policy");
      accepted.push(String(row.id));
    };
    set("vltd_sync_queue_v1", JSON.stringify([
      { id: "q1", type: "upsert_item", itemId: "bad", createdAt: 1 },
      { id: "q2", type: "upsert_item", itemId: "good1", createdAt: 2 },
      { id: "q3", type: "upsert_item", itemId: "good2", createdAt: 3 },
    ]));
    const q = load("vaultSyncQueue");
    const r = await q.processVaultSyncQueue();
    t("refused item: the items behind it are still uploaded", accepted.join() === "good1,good2", accepted.join());
    t("refused item: only the refused one is still waiting", r.remaining === 1 && JSON.parse(get("vltd_sync_queue_v1") || "[]").map((e) => e.itemId).join() === "bad", get("vltd_sync_queue_v1"));
    t("refused item: the person is told something is still saved on this device only", status.getCloudSavePhase() === "pending", status.getCloudSavePhase());
    // and when the cloud takes it later: nothing duplicated, status clears
    mocks.vaultCloud.upsertVaultItemToSupabase = async (row) => { accepted.push(String(row.id)); };
    await status.retryCloudSavesNow();
    t("refused item accepted later: uploaded once, queue empty, saved", accepted.filter((id) => id === "bad").length === 1 && JSON.parse(get("vltd_sync_queue_v1") || "[]").length === 0 && status.getCloudSavePhase() === "saved");
    // a lost connection stops the run instead of failing every item one by one
    let calls = 0;
    mocks.vaultCloud.upsertVaultItemToSupabase = async () => { calls++; throw new TypeError("Failed to fetch"); };
    set("vltd_sync_queue_v1", JSON.stringify([
      { id: "q4", type: "upsert_item", itemId: "bad", createdAt: 4 },
      { id: "q5", type: "upsert_item", itemId: "good1", createdAt: 5 },
      { id: "q6", type: "upsert_item", itemId: "good2", createdAt: 6 },
    ]));
    const r2 = await q.processVaultSyncQueue();
    t("lost connection: the run stops early and keeps all three waiting", calls <= 2 && r2.remaining === 3 && JSON.parse(get("vltd_sync_queue_v1") || "[]").length === 3, `calls=${calls} remaining=${r2.remaining}`);
  }

  // === Defect (2026-10-16): an edit made while the same item was uploading, or just before the page was left, could be lost ===
  {
    reset();
    const status = load("cloudSaveStatus");
    status.resetCloudSaveStatus();
    set("vltd-auth", session(A)); owner.reconcileLocalDataOwner(A); owner.resolveLegacyOwner(A, [PA]);
    set("vltd_sync_queue_v1", "[]");
    mocks.vaultModel.getAllLocalItems = () => [{ id: "a1", title: "x" }];
    const q = load("vaultSyncQueue");
    const sent = [];
    // the person edits the same item again while its first upload is still in flight
    let editedDuringUpload = false;
    mocks.vaultCloud.upsertVaultItemToSupabase = async (row) => {
      sent.push(JSON.stringify(row));
      if (!editedDuringUpload) { editedDuringUpload = true; q.enqueueVaultItemSync("a1"); }
    };
    q.enqueueVaultItemSync("a1");
    const r = await q.processVaultSyncQueue();
    t("edit during an upload: the newer edit is uploaded too (two uploads, not one)", sent.length === 2, sent.length);
    t("edit during an upload: nothing is left waiting afterwards", r.remaining === 0 && JSON.parse(get("vltd_sync_queue_v1") || "[]").length === 0, get("vltd_sync_queue_v1"));
    // edited again while waiting (not yet uploading): still one waiting entry, no duplicates
    set("vltd_sync_queue_v1", "[]");
    q.enqueueVaultItemSync("a1"); q.enqueueVaultItemSync("a1"); q.enqueueVaultItemSync("a1");
    t("edited three times while waiting: one entry (no duplicate writes)", JSON.parse(get("vltd_sync_queue_v1")).length === 1);
    sent.length = 0; editedDuringUpload = true;
    await q.processVaultSyncQueue();
    t("edited three times while waiting: sent once", sent.length === 1, sent.length);
    // saveItemDurably: the edit is waiting on this device BEFORE the network is used
    set("vltd_sync_queue_v1", "[]");
    let waitingWhenSent = null;
    mocks.vaultCloud.upsertVaultItemToSupabase = async () => { waitingWhenSent = JSON.parse(get("vltd_sync_queue_v1") || "[]").length; };
    const d = await q.saveItemDurably({ id: "a1", title: "x" });
    t("durable save: the edit was recorded as waiting before the upload started", waitingWhenSent === 1, waitingWhenSent);
    t("durable save: not pending once the account has it", d.pending === false && JSON.parse(get("vltd_sync_queue_v1") || "[]").length === 0);
    // the connection is down: the edit stays and the answer says pending
    mocks.vaultCloud.upsertVaultItemToSupabase = async () => { throw new TypeError("Failed to fetch"); };
    const d2 = await q.saveItemDurably({ id: "a1", title: "x" });
    t("durable save with the cloud unreachable: kept and reported pending", d2.pending === true && JSON.parse(get("vltd_sync_queue_v1") || "[]").length === 1);
    t("durable save with the cloud unreachable: the person is told it is on this device only", status.getCloudSavePhase() === "pending", status.getCloudSavePhase());
  }

  console.log("\n" + pass + " passed, " + fail + " failed");
  fs.rmSync(out, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
