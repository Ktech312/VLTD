// Insurance exclusions that follow the account (src/lib/insuranceExclusions.ts): device-first, account-confirmed, copied up once, never lost.
// Runs the real module against an in-memory "account" that can be made to fail, in a simulated browser.
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const ts = require(path.resolve(__dirname, "..", "node_modules", "typescript"));

const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-exclusions-"));
for (const name of ["insuranceExclusions", "sessionGuard", "insuranceDocs", "vaultStats"]) {
  const src = fs.readFileSync(path.join(root, "src", "lib", name + ".ts"), "utf8");
  fs.writeFileSync(path.join(out, name + ".js"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
}

// ---- simulated browser
let store = new Map();
const events = [];
global.Event = class { constructor(n) { this.type = n; } };
global.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  },
  dispatchEvent: (e) => { events.push(e.type); return true; },
  addEventListener: () => {},
};
Object.defineProperty(global, "localStorage", { get: () => global.window.localStorage, configurable: true });

// ---- the "account"
const account = { rows: [], fail: null, calls: [] };
const err = (kind) => (kind === "missing" ? { code: "PGRST205", message: "Could not find the table 'public.insurance_exclusions' in the schema cache" }
  : kind === "refused" ? { code: "42501", message: "new row violates row-level security policy" }
  : { message: "TypeError: Failed to fetch" });
const fake = {
  from(table) {
    if (table !== "insurance_exclusions") throw new Error("unexpected table " + table);
    return {
      select() { return { eq: async (_c, pid) => { account.calls.push("select"); return account.fail ? { data: null, error: err(account.fail) } : { data: account.rows.filter((r) => r.profile_id === pid).map((r) => ({ item_id: r.item_id })), error: null }; } }; },
      upsert: async (rows) => { account.calls.push("upsert"); if (account.fail) return { error: err(account.fail) }; for (const r of rows) if (!account.rows.some((x) => x.profile_id === r.profile_id && x.item_id === r.item_id)) account.rows.push({ ...r }); return { error: null }; },
      delete() { return { eq: (_c, pid) => ({ in: async (_k, ids) => { account.calls.push("delete"); if (account.fail) return { error: err(account.fail) }; account.rows = account.rows.filter((r) => !(r.profile_id === pid && ids.includes(r.item_id))); return { error: null }; } }) }; },
    };
  },
};
const itemsByProfile = { P: ["a1", "b1", "c1"], Q: ["q1", "q2"] };
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === "@/lib/supabaseClient") return { getSupabaseBrowserClient: () => fake };
  if (request === "@/lib/vaultModel") return { loadItems: (o) => (itemsByProfile[o && o.profileId] || []).map((id) => ({ id })) };
  if (request === "@/lib/sessionGuard") return origLoad.call(this, path.join(out, "sessionGuard.js"), parent, ...rest);
  return origLoad.call(this, request, parent, ...rest);
};

let pass = 0, fail = 0;
const t = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail === undefined ? "" : JSON.stringify(detail)); } };
const setOf = (s) => Array.from(s).sort().join(",");
const signIn = (uid, pid) => { store.set("vltd-auth", JSON.stringify({ user: { id: uid } })); store.set("vltd_active_profile_id_v1", pid); };

(async () => {
  const fresh = () => {
    store = new Map(); account.rows = []; account.fail = null; account.calls = []; events.length = 0;
    // the module keeps its mode and "table missing" memory for the page's life: load a fresh copy
    delete require.cache[path.join(out, "insuranceExclusions.js")];
    return require(path.join(out, "insuranceExclusions.js"));
  };

  // ---- 1. the table does not exist yet: exclusions stay on the device and the pages say so
  let X = fresh(); signIn("u1", "P");
  account.fail = "missing";
  let r = await X.setInsuranceExcludedIds(new Set(["a1"]));
  t("no table: the change is kept on the device at once", setOf(X.readInsuranceExcludedIds()) === "a1", setOf(X.readInsuranceExcludedIds()));
  t("no table: mode is device and nothing is pending", r.mode === "device" && r.pending === 0, r);
  r = await X.syncInsuranceExclusions();
  t("no table: sync keeps the device list and says device", setOf(r.ids) === "a1" && r.mode === "device", r);
  t("no table: the note says device only", /this device only/.test(X.exclusionsNoteFor(r.mode, r.pending)) && X.excludedByYouWhere(r.mode) === "device");

  // ---- 2. first time with the table: the old browser-wide list is adopted per profile and copied up
  X = fresh(); signIn("u1", "P");
  store.set(X.LEGACY_EXCLUDED_KEY, JSON.stringify(["a1", "q1", "zzz"])); // q1 is profile Q's item, zzz is unknown
  t("the old list gives a profile only the ids of its own items", setOf(X.readInsuranceExcludedIds()) === "a1", setOf(X.readInsuranceExcludedIds()));
  r = await X.syncInsuranceExclusions();
  t("first sync copies the device-only exclusion up", account.rows.length === 1 && account.rows[0].profile_id === "P" && account.rows[0].item_id === "a1", account.rows);
  t("mode is account, nothing waiting, no note", r.mode === "account" && r.pending === 0 && X.exclusionsNoteFor(r.mode, r.pending) === "" && X.excludedByYouWhere(r.mode) === "account", r);
  t("the legacy browser-wide list is left untouched", JSON.parse(store.get(X.LEGACY_EXCLUDED_KEY)).length === 3);

  // ---- 2b. the page opens before the profile's items are on the device: the old list is kept waiting, then adopted and copied up
  X = fresh(); signIn("u1", "P");
  const savedItems = itemsByProfile.P; itemsByProfile.P = [];
  store.set(X.LEGACY_EXCLUDED_KEY, JSON.stringify(["a1"]));
  r = await X.syncInsuranceExclusions();
  t("items not on the device yet: nothing is uploaded and no empty list of its own is written", account.rows.length === 0 && store.get("vltd_insurance_excluded_v2:P") === undefined && X.legacyAdoptionPending(), { rows: account.rows, own: store.get("vltd_insurance_excluded_v2:P") });
  itemsByProfile.P = savedItems;
  t("once the items are there the old list still counts as unadopted (the cue to sync again), not as pending", X.legacyAdoptionPending() === false && X.legacyListUnadopted() === true);
  r = await X.syncInsuranceExclusions();
  t("the next sync adopts the old list and copies it up", setOf(r.ids) === "a1" && account.rows.length === 1 && account.rows[0].item_id === "a1", { ids: setOf(r.ids), rows: account.rows });
  t("after adoption nothing is left to adopt", X.legacyListUnadopted() === false);

  // ---- 3. another device excluded an item: it shows up here
  account.rows.push({ profile_id: "P", item_id: "b1" });
  account.rows.push({ profile_id: "Q", item_id: "q2" });
  r = await X.syncInsuranceExclusions();
  t("another device's exclusion arrives (and only this profile's)", setOf(r.ids) === "a1,b1", setOf(r.ids));

  // ---- 4. another device re-included an item this device had synced: it is not brought back
  account.rows = account.rows.filter((x) => x.item_id !== "a1");
  r = await X.syncInsuranceExclusions();
  t("an item re-included on another device is dropped here too, not re-uploaded", setOf(r.ids) === "b1" && !account.rows.some((x) => x.item_id === "a1"), { ids: setOf(r.ids), rows: account.rows });

  // ---- 5. changes made here reach the account and are confirmed
  r = await X.setInsuranceExcludedIds(new Set(["b1", "c1"]));
  t("excluding an item uploads it and is confirmed", account.rows.some((x) => x.profile_id === "P" && x.item_id === "c1") && r.pending === 0 && r.mode === "account", r);
  r = await X.setInsuranceExcludedIds(new Set(["c1"]));
  t("re-including an item removes it from the account", !account.rows.some((x) => x.profile_id === "P" && x.item_id === "b1") && r.pending === 0, account.rows);
  t("the other profile's rows were never touched", account.rows.some((x) => x.profile_id === "Q" && x.item_id === "q2"));

  // ---- 6. the account cannot be reached: kept, reported as waiting, retried
  account.fail = "network";
  r = await X.setInsuranceExcludedIds(new Set(["c1", "a1"]));
  t("unreachable: the device list changes at once", setOf(X.readInsuranceExcludedIds()) === "a1,c1", setOf(X.readInsuranceExcludedIds()));
  t("unreachable: it is reported as waiting (never as saved) and the note says so", r.pending === 1 && /have not reached your account/.test(X.exclusionsNoteFor(r.mode, r.pending)), r);
  r = await X.setInsuranceExcludedIds(new Set(["a1"]));
  t("unreachable: re-including c1 is remembered as waiting to delete", r.pending >= 1 && setOf(X.readInsuranceExcludedIds()) === "a1", r);
  r = await X.syncInsuranceExclusions();
  t("while unreachable a sync shows the device list and does not resurrect c1", setOf(r.ids) === "a1" && r.pending >= 1, { ids: setOf(r.ids), pending: r.pending });
  account.fail = null;
  r = await X.syncInsuranceExclusions();
  t("when the account answers again, the waiting changes are sent", r.pending === 0 && account.rows.some((x) => x.item_id === "a1") && !account.rows.some((x) => x.item_id === "c1" && x.profile_id === "P"), { pending: r.pending, rows: account.rows });
  t("and the list matches on both sides", setOf(r.ids) === "a1" && setOf(account.rows.filter((x) => x.profile_id === "P").map((x) => x.item_id)) === "a1", setOf(r.ids));

  // ---- 7. the account refuses (not allowed): device only, nothing retried for ever
  X = fresh(); signIn("u1", "P");
  account.fail = "refused";
  r = await X.setInsuranceExcludedIds(new Set(["a1"]));
  t("refused: the device keeps it and the mode is device with nothing pending", setOf(X.readInsuranceExcludedIds()) === "a1" && r.mode === "device" && r.pending === 0, r);

  // ---- 8. profiles stay apart
  X = fresh(); signIn("u1", "P");
  await X.setInsuranceExcludedIds(new Set(["a1"]));
  signIn("u1", "Q");
  t("another profile on the same device starts with its own (empty) list", setOf(X.readInsuranceExcludedIds()) === "", setOf(X.readInsuranceExcludedIds()));
  await X.setInsuranceExcludedIds(new Set(["q1"]));
  signIn("u1", "P");
  t("the first profile's list is still its own", setOf(X.readInsuranceExcludedIds()) === "a1", setOf(X.readInsuranceExcludedIds()));
  t("each profile's rows are filed under that profile", account.rows.some((x) => x.profile_id === "P" && x.item_id === "a1") && account.rows.some((x) => x.profile_id === "Q" && x.item_id === "q1"), account.rows);

  // ---- 9. nobody signed in: device only, no calls to the account
  X = fresh(); store.set("vltd_active_profile_id_v1", "P");
  account.calls.length = 0;
  r = await X.syncInsuranceExclusions();
  t("signed out: no request is made and the mode is device", account.calls.length === 0 && r.mode === "device", { calls: account.calls, r });

  // ---- 10. the wording of the not-counted line
  const D = require(path.join(out, "insuranceDocs.js"));
  const s = { counts: { sold: 0, supplies: 0, wishlist: 0, excludedByYou: 2 } };
  t("the not-counted line says 'on this device' only when it is device-only", D.notCountedLine(s, "device") === "Not counted: 2 excluded by you on this device." && D.notCountedLine(s, "account") === "Not counted: 2 excluded by you.", [D.notCountedLine(s, "device"), D.notCountedLine(s, "account")]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
