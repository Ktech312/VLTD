// Loading never saves and saving never deletes-and-rewrites an exhibition's links (audit follow-up to RC-01).
//   node scripts/test-gallery-item-sync.cjs
const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail ?? ""); } };

// ---- the link-row plan (pure)
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-links-"));
fs.writeFileSync(path.join(out, "galleryItemSync.js"), ts.transpileModule(fs.readFileSync(path.join(root, "src/lib/galleryItemSync.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const { planGalleryItemSync } = require(path.join(out, "galleryItemSync.js"));
const row = (id, a, p) => ({ id, artifact_id: a, position: p });
const want = (...ids) => ids.map((a, i) => ({ artifact_id: a, position: i }));
const apply = (existing, plan) => { // run the plan in the order the sync runs it; report the smallest number of links that ever existed for wanted artifacts
  let rows = existing.map((r) => ({ ...r })); let min = rows.length;
  rows = rows.concat(plan.toInsert.map((r, i) => ({ id: "n" + i, ...r }))); min = Math.min(min, rows.length);
  for (const u of plan.toUpdate) rows.find((r) => r.id === u.id).position = u.position;
  rows = rows.filter((r) => !plan.toDelete.includes(r.id));
  return { rows, min };
};

let p = planGalleryItemSync([row(1, "a", 0), row(2, "b", 1), row(3, "c", 2)], want("a", "b", "c"));
check("identical links: nothing to do", p.toInsert.length + p.toUpdate.length + p.toDelete.length === 0);
p = planGalleryItemSync([row(1, "a", 1), row(2, "b", 2), row(3, "c", 3)], want("a", "b", "c"));
check("positions that only differ (1-based vs 0-based): updates only, nothing deleted or inserted", p.toInsert.length === 0 && p.toDelete.length === 0 && p.toUpdate.length === 3, JSON.stringify(p));
p = planGalleryItemSync([row(1, "a", 0), row(2, "b", 1), row(3, "c", 2)], want("c", "a", "b"));
check("a reorder changes positions only", p.toInsert.length === 0 && p.toDelete.length === 0 && p.toUpdate.length === 3);
p = planGalleryItemSync([row(1, "a", 0), row(2, "b", 1)], want("a", "b", "c"));
check("an added item inserts exactly that link", p.toInsert.length === 1 && p.toInsert[0].artifact_id === "c" && p.toDelete.length === 0 && p.toUpdate.length === 0);
p = planGalleryItemSync([row(1, "a", 0), row(2, "b", 1), row(3, "c", 2)], want("a", "c"));
check("a removed item deletes exactly that row (and repositions the rest)", p.toDelete.length === 1 && p.toDelete[0] === 2 && p.toInsert.length === 0 && p.toUpdate.length === 1 && p.toUpdate[0].id === 3);
p = planGalleryItemSync([row(1, "a", 0), row(2, "a", 1), row(3, "b", 2)], want("a", "b"));
check("a duplicate row for a kept item is removed, one link stays", p.toDelete.length === 1 && p.toInsert.length === 0);
p = planGalleryItemSync([row(1, "a", 0), row(2, "b", 1)], []);
check("an exhibition that is intentionally emptied deletes its links (explicit edits only)", p.toDelete.length === 2);
const existing = [row(1, "a", 3), row(2, "b", 4), row(3, "x", 5)]; p = planGalleryItemSync(existing, want("a", "b", "c", "d"));
const done = apply(existing, p);
check("applied in order the exhibition never has fewer links than it started with before the removals", done.min >= existing.length, JSON.stringify(done.min));
check("after applying, exactly the wanted artifacts are linked, in order", JSON.stringify(done.rows.sort((x, y) => x.position - y.position).map((r) => r.artifact_id)) === JSON.stringify(["a", "b", "c", "d"]));

// ---- source guards: where the destructive things may and may not happen
const model = fs.readFileSync(path.join(root, "src/lib/galleryModel.ts"), "utf8");
const a = model.indexOf("async function syncGalleryItemsToSupabase("); const b = model.indexOf("function getGallerySyncSignature(");
const syncFn = model.slice(a, b);
check("the link sync never deletes every row of an exhibition and re-inserts them", !/\.delete\(\)\s*\.eq\("gallery_id"/.test(syncFn) && !/Failed restoring previous gallery_items rows/.test(syncFn), "delete-all pattern found");
check("the link sync inserts before it deletes", syncFn.indexOf(".insert(") > 0 && syncFn.indexOf(".insert(") < syncFn.indexOf(".delete()"));

const page = fs.readFileSync(path.join(root, "src/app/museum/[galleryId]/page.tsx"), "utf8");
const loadEffect = page.slice(page.indexOf("useEffect(() => {\n    if (!id) return;\n\n"), page.indexOf("void refreshGalleriesFromSupabase(true);\n\n    function onGalleryChange"));
check("opening an exhibition does not create a share token", !/ensureGalleryPublicToken\(id\)/.test(loadEffect), "ensureGalleryPublicToken(id) is in the load effect");
check("opening an exhibition does not patch (and so autosave) the draft to refresh snapshots", !/snapshotsRefreshedRef/.test(page));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
