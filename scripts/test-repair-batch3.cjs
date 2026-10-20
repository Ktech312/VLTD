// Repair batch 3 (D-01..D-10): the pure rules, plus static guards that the pages use the existing persistence paths.
//   node scripts/test-repair-batch3.cjs
const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-rb5-"));
for (const name of ["goalRules", "importUndo", "bulkIntake", "captureDraft", "hallSave"]) {
  if (name === "hallSave") continue; // storage + network: covered by the production run and the static checks below
  const src = fs.readFileSync(path.join(root, "src", "lib", name + ".ts"), "utf8").replace(/"@\/lib\//g, '"./');
  fs.writeFileSync(path.join(out, name + ".js"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const G = require(path.join(out, "goalRules.js"));
const U = require(path.join(out, "importUndo.js"));
const B = require(path.join(out, "bulkIntake.js"));
const C = require(path.join(out, "captureDraft.js"));
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail ?? ""); } };
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// ---- D-05 goal target: whole numbers from 1 to the database limit, nothing rounded
const v = (x) => G.validateGoalTarget(x);
check("102 is accepted", v("102").ok && v("102").value === 102);
check("the database maximum 2147483647 is accepted", v("2147483647").ok && v("2147483647").value === 2147483647);
check("2147483648 is refused with the limit in the message", !v("2147483648").ok && /2,147,483,647/.test(v("2147483648").message));
check("99999999999 (the audited value) is refused", !v("99999999999").ok);
check("2.5 is refused, not rounded", !v("2.5").ok);
check("0 and negatives are refused", !v("0").ok && !v("-3").ok);
check("blank is refused", !v("").ok && !v("   ").ok);
check("1e3, letters and signs are refused", !v("1e3").ok && !v("abc").ok && !v("+5").ok && !v("12 3").ok);
check("a thousands comma is accepted (1,000)", v("1,000").ok && v("1,000").value === 1000);
check("1,5 is refused (ambiguous), not read as 15", !v("1,5").ok);
check("a number type value is accepted", v(7).ok && v(7).value === 7 && !v(7.5).ok);

// ---- D-03/D-04 merge after reading the account
const g = (id, createdAt, extra) => ({ id, createdAt, name: id, ...extra });
const mg = (...a) => G.mergeCloudGoals(...a).goals;
const m1 = mg([g("a", 3), g("b", 2)], [g("a", 3), g("b", 2), g("new", 9)], new Set(["new"]), new Set());
check("a goal still waiting to upload survives a read of the account", m1.some((x) => x.id === "new") && m1.length === 3);
check("newest first", m1[0].id === "new");
const m2 = mg([g("a", 3), g("b", 2)], [g("a", 3)], new Set(), new Set(["b"]));
check("a goal deleted here does not come back from the account before the account confirmed the delete", !m2.some((x) => x.id === "b") && m2.length === 1);
const m3 = mg([g("a", 3, { name: "old" })], [g("a", 3, { name: "edited here" })], new Set(["a"]), new Set());
check("an edit waiting to upload is not overwritten by the account's older copy", m3[0].name === "edited here");
const m4 = mg([g("a", 3, { name: "cloud" })], [g("a", 3, { name: "local" })], new Set(), new Set());
check("an edit that is not waiting follows the account", m4[0].name === "cloud");
// device-only goals (ownership = the profile they are stored under) are kept next to the account's goals
const cl = [g("c1", 8), g("c2", 7), g("c3", 6)];
const mo = G.mergeCloudGoals(cl, [...cl, g("dev1", 5), g("dev2", 4)], new Set(), new Set(), new Set(["c1", "c2", "c3"]));
check("device-only goals are kept next to the account's existing goals (not suppressed)", mo.goals.length === 5 && ["dev1", "dev2"].every((id) => mo.goals.some((x) => x.id === id)) && mo.deviceOnly.join() === "dev1,dev2");
const md = G.mergeCloudGoals(cl, [...cl, g("gone", 5)], new Set(), new Set(), new Set(["c1", "gone"]));
check("a goal this device saw in the account that the account no longer holds was deleted elsewhere: not brought back", !md.goals.some((x) => x.id === "gone") && md.deletedElsewhere.join() === "gone" && md.deviceOnly.length === 0);
const me = G.mergeCloudGoals([], [g("a", 3), g("b", 2)], new Set(), new Set(), new Set(["a", "b"]));
check("an EMPTY answer from the account drops nothing (it may be a lapsed session): both kept and owed to the account", me.goals.length === 2 && me.deviceOnly.length === 2 && me.deletedElsewhere.length === 0);
const mt = G.mergeCloudGoals(cl, [...cl, g("dev1", 5)], new Set(), new Set(["c2", "dev1"]), new Set());
check("goals deleted here (waiting for the account) stay hidden, device-only or not", !mt.goals.some((x) => x.id === "c2" || x.id === "dev1") && mt.goals.length === 2);
const mp = G.mergeCloudGoals(cl, [...cl, g("new", 9)], new Set(["new"]), new Set(), new Set(["c1", "c2", "c3"]));
check("a pending goal is kept and is not counted as device-only", mp.goals.some((x) => x.id === "new") && mp.deviceOnly.length === 0);
const mx = G.mergeCloudGoals(cl, [...cl, ...cl, g("dev1", 5), g("dev1", 5)], new Set(), new Set(), new Set(["c1", "c2", "c3"]));
check("no duplicates however often the same goals are read", mx.goals.length === 4 && new Set(mx.goals.map((x) => x.id)).size === 4);
check("the device-wide list of an older version is adopted only for the recorded owner", G.mayAdoptDeviceWideGoals("u1", "u1") === true && G.mayAdoptDeviceWideGoals("u1", "u2") === false && G.mayAdoptDeviceWideGoals(null, "u1") === false && G.mayAdoptDeviceWideGoals("u1", null) === false);

// ---- D-06 undo plan: exact ids, edited / moved / in-use records flagged
const item = (id, extra) => ({ id, title: "T " + id, purchasePrice: 10, status: "COLLECTION", profile_id: "P1", ...extra });
const imported = [item("a"), item("b"), item("c")];
const entry = { itemIds: ["a", "b", "c", "gone"], profileId: "P1", fingerprints: Object.fromEntries(imported.map((i) => [i.id, U.importFingerprint(i)])) };
const now = [item("a"), item("b", { purchasePrice: 99 }), item("c", { profile_id: "P2" }), item("zzz", { title: "T a" })];
const plan = U.planImportUndo(entry, now, { a: 2 });
check("undo acts on the exact ids only (a same-title record that was not imported is not touched)", plan.present.map((p) => p.id).join() === "a,b,c" && !plan.present.some((p) => p.id === "zzz"));
check("an id already gone is reported as gone", plan.missingIds.join() === "gone");
check("an edited record is flagged", plan.flagged.find((f) => f.id === "b")?.reasons.includes("edited since the import"));
check("a moved record is flagged", plan.flagged.find((f) => f.id === "c")?.reasons.includes("moved to another profile"));
check("a record in an exhibition is flagged", plan.flagged.find((f) => f.id === "a")?.reasons.some((r) => /2 exhibitions/.test(r)));
const clean = U.planImportUndo({ ...entry, itemIds: ["a"] }, [item("a")], {});
check("an untouched record is not flagged", clean.flagged.length === 0 && !clean.unverifiable);
check("an import recorded before change tracking is marked unverifiable", U.planImportUndo({ itemIds: ["a"] }, [item("a")], {}).unverifiable === true);
check("a cloud-added field is not an edit", U.planImportUndo(entry, [item("a", { itemCode: "260101-0001-000001", createdAt: 5 }), item("b"), item("c")], {}).flagged.length === 0);
const fp = (x) => U.importFingerprint(x);
check("a price saved as a number and read back as text is not an edit", fp(item("a", { purchasePrice: 5 })) === fp(item("a", { purchasePrice: "5.00" })));
check("a blank cost read back as null is not an edit", fp(item("a", { purchasePrice: undefined })) === fp(item("a", { purchasePrice: null })));
check("a missing status and COLLECTION are the same", fp(item("a", { status: undefined })) === fp(item("a", { status: "COLLECTION" })));
check("categories filled in on load are not edits", fp(item("a")) === fp(item("a", { category: "comics", categoryLabel: "Comics", universe: "POP_CULTURE" })));
check("a changed title, note, price or status IS an edit", [{ title: "New" }, { notes: "n" }, { purchasePrice: 11 }, { status: "SOLD" }].every((c) => fp(item("a")) !== fp(item("a", c))));
const msg = (o) => U.undoResultMessage({ sourceLabel: "x.csv", removed: 0, total: 0, stillThere: 0, keptChanged: 0, alreadyGone: 0, ...o });
check("a full undo says so", msg({ removed: 3, total: 3 }) === "Undid 3 of 3 items from x.csv.");
check("a partial undo does not claim everything was undone", /Removed 2 of 3/.test(msg({ removed: 2, total: 3, stillThere: 1 })) && /still there/.test(msg({ removed: 2, total: 3, stillThere: 1 })) && !/^Undid/.test(msg({ removed: 2, total: 3, stillThere: 1 })));
check("kept changed items are reported", /1 you had changed was kept/.test(msg({ removed: 2, total: 3, keptChanged: 1 })));

// ---- D-08 bulk intake
const files = (n, type = "image/jpeg") => Array.from({ length: n }, (_, i) => ({ name: `p${i + 1}.jpg`, type }));
const p62 = B.planBulkIntake(files(62), 0, 60);
check("62 photos: 60 taken, 2 named as not taken", p62.accepted.length === 60 && p62.overLimit.map((f) => f.name).join() === "p61.jpg,p62.jpg");
check("the notice names the left-out files and the limit", /60/.test(B.intakeNotice(p62, 60)) && /p61\.jpg, p62\.jpg/.test(B.intakeNotice(p62, 60)));
const second = B.planBulkIntake(files(30), 40, 60);
check("the limit counts photos already queued (40 + 30: 20 taken, 10 left out)", second.accepted.length === 20 && second.overLimit.length === 10);
const mixed = B.planBulkIntake([...files(2), { name: "notes.pdf", type: "application/pdf" }], 0, 60);
check("a file that is not a photo is named, not dropped silently", mixed.accepted.length === 2 && /notes\.pdf/.test(B.intakeNotice(mixed, 60)));
check("no notice when everything is taken", B.intakeNotice(B.planBulkIntake(files(5), 0, 60), 60) === "");

// ---- D-09/D-10 capture draft rules
check("drafts are scoped by account and profile", C.captureDraftScope("u1", "p1") !== C.captureDraftScope("u2", "p1") && C.captureDraftScope("u1", "p1") !== C.captureDraftScope("u1", "p2"));
check("a signed-out browser gets its own scope", C.captureDraftScope(null, null) === "anon:none");
const base = { title: "", brand: "Topps", confidence: 0 };
check("an untouched form (only carried-over locked values) is not a draft", !C.draftHasContent({ title: "", brand: "Topps", confidence: 0 }, base, 0));
check("a typed name makes a draft", C.draftHasContent({ title: "Card", brand: "Topps", confidence: 0 }, base, 0));
check("a photo alone makes a draft", C.draftHasContent({ title: "", brand: "Topps", confidence: 0 }, base, 1));
check("a changed confidence alone is not a draft", !C.draftHasContent({ title: "", brand: "Topps", confidence: 80 }, base, 0));

// ---- static guards: existing persistence paths, no duplicate record on repeated clicks
const ai = read("src/app/ai/review/page.tsx");
check("D-01 approving uses the shared durable save", /saveItemDurably\(vaultItem\)/.test(ai) && !/\bsaveItem\(vaultItem\)/.test(ai));
check("D-01 the item id comes from the draft (one item per draft, however many clicks)", /id: `ai_\$\{draft\.id\}`/.test(ai));
check("D-01 repeated clicks are ignored while saving", /if \(saving \|\| !draft/.test(ai));
check("D-01 says sync pending instead of claiming account-saved", /Sync pending/.test(ai));
const hs = read("src/lib/hallSave.ts");
check("D-02 the hall is stored with saveGalleries before items are set", hs.indexOf("saveGalleries(") > 0 && hs.indexOf("saveGalleries(") < hs.indexOf("setGalleryItemIds(id"));
check("D-02 the hall is read back before it is opened", /loadAllGalleries\(\)\.find\(\(g\) => g\.id === id\)/.test(hs));
check("D-02 a retry reuses the same hall id", /reuseId/.test(hs) && /hallIdRef/.test(read("src/app/vault/halls/page.tsx")));
check("D-02 the page never opens a hall that failed", /if \(!result\.ok\)[\s\S]{0,200}return;[\s\S]*router\.push/.test(read("src/app/vault/halls/page.tsx")));
const gl = read("src/lib/collectionGoals.ts");
check("D-03/04 goal writes read the account's answer (select + error)", /upsert\(goalRow\(goal, pid\), \{ onConflict: "id" \}\)\.select\("id"\)/.test(gl) && /delete\(\)\.eq\("id", id\)\.eq\("profile_id", pid\)\.select\("id"\)/.test(gl));
check("D-03/04 no fire-and-forget pushes remain", !/void pushGoal\(|void deleteGoalRow\(/.test(gl));
check("D-04 a deleted goal is remembered until the account confirms", /LS_DELETED/.test(gl) && /mergeCloudGoals\(/.test(gl));
const sheet = read("src/components/AddGoalSheet.tsx");
check("D-05 the sheet validates before saving and keeps the form on failure", /validateGoalTarget\(targetCount\)/.test(sheet) && /setError\(target\.message\)/.test(sheet));
check("D-03 the sheet says Saved only after the goal is stored", /const result = await onSave\(/.test(sheet) && sheet.indexOf("await onSave(") < sheet.indexOf("flashSaved();"));
check("D-03 one goal id per sheet (repeated clicks write one goal)", /goalId = useRef/.test(sheet));
const imp = read("src/lib/spreadsheetImport.ts");
check("D-06 undo deletes through the confirmed everywhere-delete", /deleteVaultItemsEverywhere\(toRemove\)/.test(imp));
check("D-06 undo no longer filters the whole vault by id and saves locally", !/saveItems\(nextItems\)/.test(imp));
check("D-06 import history is limited to the account and profile that made it", /entry\.userId && user && entry\.userId !== user/.test(imp) && /entry\.profileId && profile && entry\.profileId !== profile/.test(imp));
const ui = read("src/app/vault/import/SpreadsheetImportClient.tsx");
check("D-07 the page loads the account's items (checked) and says when it could not", /syncVaultItemsFromSupabaseChecked\(\)/.test(ui) && /account-check-failed/.test(ui));
check("D-07 skip-existing re-checks the account right before importing and uses the refreshed list", /duplicateCheckIncomplete = !\(await checkAccount\(\)\)/.test(ui) && /getItemsToImport\(readVaultForActiveProfile\(\)/.test(ui));
check("D-07 the documented title rule is unchanged (duplicateKeyOf still the key)", /duplicateKeyOf\(item\)/.test(ui) && /replace\(\/\\s\+\/g, " "\)\.trim\(\)/.test(imp));
check("D-07/ADD-272 the match tiles say Not checked (not 0) until the account has been read", /tile-vault-matches/.test(ui) && /tile-likely-matches/.test(ui) && /"Not checked"/.test(ui));
const bulk = read("src/app/vault/bulk/page.tsx");
check("D-08 bulk intake uses the planner and names what was left out", /planBulkIntake\(files, draftCountRef\.current, MAX_FILES\)/.test(bulk) && /intake-note/.test(bulk));
const cap = read("src/app/capture/page.tsx");
check("D-09/10 capture restores a draft scoped to account and profile", /captureDraftScope\(storedSessionUserId\(\), getStoredActiveProfileId\(\)\)/.test(cap) && /loadCaptureDraft/.test(cap));
check("D-09/10 the draft is cleared only after saving or on explicit discard", /await clearCaptureDraft\(draftScopeRef\.current\);\s*router\.push\("\/vault"\)/.test(cap) && /capture-draft-discard/.test(cap));
check("D-09/10 restoring a draft does not call the AI", !/identify/i.test(cap.slice(cap.indexOf("Draft: an unsaved item survives"), cap.indexOf("AI flow triggered by photo capture"))));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
