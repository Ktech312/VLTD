// A profile move waits for the account: items leave their profile and their exhibitions only after the cloud confirmed (audit follow-up to RC-01).
//   node scripts/test-move-profile.cjs
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail ?? ""); } };

const view = fs.readFileSync(path.join(root, "src/app/vault/VaultListView.tsx"), "utf8");
const mv = view.slice(view.indexOf("async function handleMoveToProfile("), view.indexOf("function handleClearFilters("));
check("the profile move waits for the account (awaits the confirmed move)", /await moveItemsToProfileConfirmed\(/.test(mv));
check("the profile move does not prune exhibitions, mark pending moves or edit items itself", !/removeItemIdsFromAllGalleries|markPendingMoves|commitVaultItemEdits/.test(mv));

const act = fs.readFileSync(path.join(root, "src/lib/vaultActions.ts"), "utf8");
const mf = act.slice(act.indexOf("export async function moveItemsToProfileConfirmed("));
const iUpdate = mf.indexOf(".update("), iEarly = mf.indexOf("if (confirmed.length === 0) return result;"), iPrune = mf.indexOf("removeItemIdsFromAllGalleriesConfirmed(");
check("exhibitions are pruned only after the account confirmed (after the update and after the nothing-confirmed return)", iUpdate > 0 && iEarly > iUpdate && iPrune > iEarly, JSON.stringify({ iUpdate, iEarly, iPrune }));
check("a lost answer is read back before an item is called failed or moved", /select\("id, profile_id"\)/.test(mf));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
