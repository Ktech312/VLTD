// Regression tests for deleting vault items: a refused cloud delete must never be reported as a finished one.
// Runs the real src/lib/vaultActions.ts (transpiled on the fly) against a fake Supabase client: no network.
//
//   npm run test:delete
//
// Defect (demonstrated 2026-10-14, live, QA account): when an account is no longer a member of the item's profile, the
// cloud answers a delete with "0 rows" AND hides the row from a lookup, so "not there" was read as "already gone", the
// item vanished locally and the delete was reported as done while the cloud row remained.

const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-delete-"));
const src = fs.readFileSync(process.env.VAULT_ACTIONS_SRC || path.join(root, "src", "lib", "vaultActions.ts"), "utf8");
fs.writeFileSync(
  path.join(out, "vaultActions.js"),
  ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
);

// ---- fakes ----
let local = [];
let cloud = []; // rows the account can see AND delete
let memberOf = new Set(); // profile ids the account is a member of
let lookupError = false;
let prunedFromGalleries = [];
const fakeSupabase = {
  auth: { getUser: async () => ({ data: { user: { id: "me" } } }) },
  from(table) {
    const state = { table, op: "select", id: null, profile: null, user: null };
    const chain = {
      delete() { state.op = "delete"; return chain; },
      select() { return chain; },
      eq(col, val) { if (col === "id") state.id = val; if (col === "profile_id") state.profile = val; if (col === "user_id") state.user = val; return chain; },
      limit() { return chain; },
      then(resolve) {
        if (state.table === "profile_members") {
          const ok = state.user === "me" && memberOf.has(state.profile);
          return resolve({ data: ok ? [{ role: "owner" }] : [], error: null });
        }
        if (state.op === "delete") {
          const hit = cloud.filter((r) => r.id === state.id);
          cloud = cloud.filter((r) => r.id !== state.id);
          return resolve({ data: hit.map((r) => ({ id: r.id })), error: null });
        }
        if (lookupError) return resolve({ data: null, error: { message: "network" } });
        return resolve({ data: cloud.filter((r) => r.id === state.id).map((r) => ({ id: r.id })), error: null });
      },
    };
    return chain;
  },
};

const mocks = {
  vaultModel: {
    loadItems: () => local.slice(),
    saveItems: (items) => { local = items.slice(); },
    saveItem: (item) => { local = [...local.filter((i) => i.id !== item.id), item]; },
  },
  vaultEvents: { emitVaultUpdate: () => {} },
  supabaseClient: { getSupabaseBrowserClient: () => fakeSupabase },
  vaultCloud: { hasSupabaseEnv: () => true, VAULT_ITEMS_TABLE: "vault_items" },
  galleryModel: { removeItemIdsFromAllGalleriesConfirmed: async (ids) => { prunedFromGalleries.push(...ids); } },
};
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  const m = request.match(/^(?:\.\/|@\/lib\/)([A-Za-z0-9_]+)$/);
  if (m && mocks[m[1]]) return mocks[m[1]];
  return origLoad.call(this, request, parent, ...rest);
};
const actions = require(path.join(out, "vaultActions.js"));

let pass = 0, fail = 0;
const t = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail ?? ""); } };
function setup({ items, cloudRows, members, lookupFails = false }) {
  local = items.map((i) => ({ ...i }));
  cloud = cloudRows.map((id) => ({ id }));
  memberOf = new Set(members);
  lookupError = lookupFails;
  prunedFromGalleries = [];
}
const item = (id, profile = "P1") => ({ id, title: "Item " + id, profile_id: profile });

(async () => {
  // single delete
  setup({ items: [item("a")], cloudRows: ["a"], members: ["P1"] });
  let r = await actions.deleteVaultItemEverywhere("a");
  t("single: a normal delete succeeds and removes the item everywhere", r.ok && local.length === 0 && cloud.length === 0 && prunedFromGalleries.includes("a"));

  setup({ items: [item("a")], cloudRows: ["a"], members: [] });
  // membership is gone: the row is hidden from reads and the delete removes nothing -- but our fake has the row deletable;
  // model the real database: a non-member can neither see nor delete it.
  cloud = []; const hidden = ["a"];
  r = await actions.deleteVaultItemEverywhere("a");
  t("single: a refused delete (no membership) is reported as a failure", r.ok === false, JSON.stringify(r));
  t("single: the refused item is kept on this device", local.length === 1 && local[0].id === "a");
  t("single: a refused delete does not prune exhibitions", prunedFromGalleries.length === 0 && hidden.length === 1);

  setup({ items: [item("d")], cloudRows: [], members: ["P1"] });
  r = await actions.deleteVaultItemEverywhere("d");
  t("single: a device-only item (never uploaded) can still be deleted", r.ok && local.length === 0);

  setup({ items: [item("e")], cloudRows: [], members: ["P1"], lookupFails: true });
  r = await actions.deleteVaultItemEverywhere("e");
  t("single: a failed lookup is a failure, the item is kept", r.ok === false && local.length === 1);

  // mass delete
  setup({ items: [item("a"), item("b"), item("d")], cloudRows: ["a", "b"], members: ["P1"] });
  r = await actions.deleteVaultItemsEverywhere(["a", "b", "d"]);
  t("mass: all deletable items go, including a device-only one", r.ok && local.length === 0);

  setup({ items: [item("x", "P2"), item("y", "P2")], cloudRows: [], members: [] });
  r = await actions.deleteVaultItemsEverywhere(["x", "y"]);
  t("mass: refused deletes (no membership) are all reported and kept", r.ok === false && local.length === 2, JSON.stringify(r));

  setup({ items: [item("a", "P1"), item("x", "P2")], cloudRows: ["a"], members: ["P1"] });
  r = await actions.deleteVaultItemsEverywhere(["a", "x"]);
  t("mass: a mixed batch deletes what it may and keeps what was refused", r.ok === false && local.map((i) => i.id).join() === "x" && prunedFromGalleries.join() === "a", JSON.stringify({ r, local, pruned: prunedFromGalleries }));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
