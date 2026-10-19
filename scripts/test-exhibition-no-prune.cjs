// Guard: loading an exhibition must never delete what it holds.
// The exhibition editor used to "self-heal" on load by removing every item id it could not find in the locally loaded vault, which emptied an
// exhibition opened under the wrong active profile (audit RC-01). Item ids may only leave exhibitions through the confirmed delete workflow
// (src/lib/vaultActions.ts), the explicit move-to-profile action (VaultListView) or an explicit edit in the editor.
//   node scripts/test-exhibition-no-prune.cjs
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
let failed = 0;
const check = (name, ok, detail) => { console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : " :: " + detail)); if (!ok) failed++; };

const page = fs.readFileSync(path.join(root, "src/app/museum/[galleryId]/page.tsx"), "utf8");
for (const needle of ["removeItemIdsFromAllGalleriesConfirmed", "pruneGalleryItemIds", "deadIds", "crossIds", "removeItemIdsFromAllGalleries"]) {
  check(`exhibition page does not use ${needle}`, !page.includes(needle), "found in src/app/museum/[galleryId]/page.tsx");
}
check("exhibition page lists items that could not be loaded (unavailable) instead of hiding them", page.includes('data-testid="unavailable-items"'), "marker missing");

// every caller of the pruning function, anywhere in src
const walk = (d, acc = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p); } return acc; };
const callers = walk(path.join(root, "src")).filter((f) => /removeItemIdsFromAllGalleriesConfirmed/.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(root, f).replace(/\\/g, "/")).sort();
const allowed = ["src/lib/galleryModel.ts", "src/lib/vaultActions.ts"];
check("only the confirmed delete workflow, the confirmed profile move and the definition use the pruning function", JSON.stringify(callers) === JSON.stringify(allowed), "callers: " + callers.join(", "));

const model = fs.readFileSync(path.join(root, "src/lib/galleryModel.ts"), "utf8");
check("the pruning function is documented as delete/move only", /Only call this after an item has been confirmed deleted or has been explicitly moved/.test(model), "comment missing in galleryModel.ts");
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
