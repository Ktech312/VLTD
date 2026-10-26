// Category-specific Details: every taxonomy entry has a sensible field list, no stored value can be lost or reinterpreted.
//   npm run test:details
const fs = require("fs"), os = require("os"), path = require("path"), ts = require("typescript");
const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-details-"));
const compile = (rel, name) => fs.writeFileSync(path.join(out, name), ts.transpileModule(fs.readFileSync(path.join(root, "src", "lib", rel), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
compile("taxonomy.ts", "taxonomy.js");
compile("detailFieldMatrix.generated.ts", "detailFieldMatrix.generated.js");
compile("detailFields.ts", "detailFields.js");
const D = require(path.join(out, "detailFields.js"));
const { TAXONOMY } = require(path.join(out, "taxonomy.js"));

let pass = 0, fail = 0;
const t = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail ?? ""); } };

// Keys that really exist on VaultItem (read from the type itself).
const model = fs.readFileSync(path.join(root, "src", "lib", "vaultModel.ts"), "utf8");
const typeBlock = model.slice(model.indexOf("export type VaultItem = {"), model.indexOf("type LoadItemsOptions"));
const itemKeys = new Set([...typeBlock.matchAll(/^\s{2}([A-Za-z0-9_]+)\??:/gm)].map((m) => m[1]));
const specialistKeys = [...typeBlock.slice(typeBlock.indexOf("// TCG-specific"), typeBlock.indexOf("// Video clip")).matchAll(/^\s{2}([A-Za-z0-9_]+)\??:/gm)].map((m) => m[1]);

// ── Coverage and shape ────────────────────────────────────────────────────────────────────────────────────────────────────
let entries = 0, badShape = [], noPrimary = [], tooMany = [], unknownKeys = new Set(), dupes = [], wrongSource = [], badBool = [], badChoice = [];
const reachable = new Set();
for (const [universe, cats] of Object.entries(TAXONOMY)) {
  for (const [category, subs] of Object.entries(cats)) {
    for (const sub of subs) {
      entries++;
      const p = D.resolveDetailProfile(universe, category, sub);
      if (p.source !== "subcategory") wrongSource.push(`${universe}/${category}/${sub}`);
      if (!p.primary.length) noPrimary.push(`${universe}/${category}/${sub}`);
      if (p.primary.length > 6) tooMany.push(`${universe}/${category}/${sub}`);
      const seen = new Set();
      for (const f of p.all) {
        reachable.add(f.target);
        if (seen.has(f.target)) dupes.push(`${universe}/${category}/${sub}: ${f.target}`);
        seen.add(f.target);
        if (f.key && !itemKeys.has(f.key)) unknownKeys.add(f.key);
        if (f.boolean && f.control !== "yesno") badBool.push(f.target);
        if (f.control === "choice" && !(f.options && f.options.length)) badChoice.push(f.target);
        if (!f.label || !f.target) badShape.push(`${universe}/${category}/${sub}`);
      }
    }
  }
}
t(`all ${entries} taxonomy entries have their own profile`, entries === 382 && wrongSource.length === 0, wrongSource.slice(0, 5));
t("every profile has at least one main field", noPrimary.length === 0, noPrimary.slice(0, 5));
t("no profile has more than six main fields", tooMany.length === 0, tooMany.slice(0, 5));
t("no profile lists one stored value twice", dupes.length === 0, dupes.slice(0, 5));
t("every field that uses an item field names one that exists", unknownKeys.size === 0, [...unknownKeys]);
t("yes / no item fields use the yes / no control", badBool.length === 0, badBool.slice(0, 5));
t("every choice field has choices", badChoice.length === 0, badChoice.slice(0, 5));
t("labels and targets are never empty", badShape.length === 0);
const missing = specialistKeys.filter((k) => !reachable.has(k) && !["isFirstEdition", "printRun", "videoClip"].includes(k));
t(`every existing specialist item field (${specialistKeys.length}) has a home in some category`, missing.length === 0, missing);

// ── Resolving ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const sample = (u, c, s) => D.resolveDetailProfile(u, c, s);
t("a category with no subcategory gets the category's shared fields", sample("TCG", "TCG / CCG", "").source === "category" && sample("TCG", "TCG / CCG", "").primary.length > 0);
t("a subcategory the taxonomy does not list falls back to the category", sample("SPORTS", "Sports Cards", "Pickleball").source === "category");
t("an old category name (Toys) finds Toys & Figures", sample("POP_CULTURE", "Toys", "").category === "Toys & Figures");
t("an old category name (Bags) finds Bags & Luggage", sample("JEWELRY_APPAREL", "Bags", "").category === "Bags & Luggage");
t("typographic apostrophe and code spellings find Collectors Choice", sample("MISC", "Collector’s Choice", "").category === "Collectors Choice" && sample("MISC", "COLLECTORS_CHOICE", "").category === "Collectors Choice");
t("a category used by one universe is found even with the wrong universe", sample("MISC", "Sports Cards", "Basketball").universe === "SPORTS");
t("nothing matching gives the general set", sample("", "", "").source === "generic" && sample("MISC", "My Own Shelf", "").source === "generic");
t("the general set keeps the fields the old card always showed", ["subtitle", "number", "grade", "serialNumber", "certNumber", "subject", "year", "brand"].every((k) => sample("", "", "").all.some((f) => f.target === k)));
const labels = (u, c, s) => sample(u, c, s).all.map((f) => f.label.toLowerCase());
t("watches show watch fields", labels("JEWELRY_APPAREL", "Watches", "Automatic").some((l) => /reference/.test(l)) && labels("JEWELRY_APPAREL", "Watches", "Automatic").some((l) => /movement/.test(l)));
t("vinyl shows pressing details but sports cards do not", sample("MUSIC", "Audio Formats", "Vinyl Records").all.some((f) => f.target === "vinylLabel") && !sample("SPORTS", "Sports Cards", "Basketball").all.some((f) => f.target === "vinylLabel"));
t("the old Add Item toy block now appears for Toys & Figures", sample("POP_CULTURE", "Toys & Figures", "Funko Pops").all.some((f) => f.target === "toyBrand"));
t("art universe items get the art size fields in inches", ["artHeight", "artWidth"].every((k) => sample("ART", "Painting", "Original Art").all.some((f) => f.target === k && /\(in\)/.test(f.label))));
t("condition offers condition words, not a source", (sample("JEWELRY_APPAREL", "Footwear", "Sneakers").all.find((f) => f.target === "condition")?.options ?? []).includes("Near Mint"));

// ── Values ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const field = (u, c, s, target) => sample(u, c, s).all.find((f) => f.target === target);
const watchBox = field("JEWELRY_APPAREL", "Watches", "Automatic", "watchBox");
const spec = sample("JEWELRY_APPAREL", "Footwear", "Sneakers").all.find((f) => f.specId);
const integer = sample("MUSIC", "Audio Formats", "Vinyl Records").all.find((f) => f.control === "integer");
const base = { id: "1", title: "Test", specs: { material: "Brass", keep_me: "x" } };
t("a yes / no item field reads true, false and empty", D.readDetail({ ...base, watchBox: true }, watchBox) === "yes" && D.readDetail({ ...base, watchBox: false }, watchBox) === "no" && D.readDetail(base, watchBox) === "");
t("choosing Yes / No / Unknown writes true / false / nothing", D.detailPatch(base, watchBox, "yes").watchBox === true && D.detailPatch(base, watchBox, "no").watchBox === false && "watchBox" in D.detailPatch(base, watchBox, "") && D.detailPatch(base, watchBox, "").watchBox === undefined);
t("unknown is never saved as No", D.detailPatch(base, watchBox, "").watchBox !== false);
const patched = D.detailPatch(base, spec, "Mesh upper");
t("a spec edit keeps every other spec", patched.specs[spec.specId] === "Mesh upper" && patched.specs.material === "Brass" && patched.specs.keep_me === "x");
const cleared = D.detailPatch({ ...base, specs: { [spec.specId]: "a" } }, spec, "   ");
t("clearing the last spec leaves an empty set, not nothing", cleared.specs && Object.keys(cleared.specs).length === 0);
t("whole-number fields only keep digits", D.detailPatch(base, integer, "12 discs").specs[integer.specId] === "12");
t("text keeps leading zeros and punctuation", D.detailPatch(base, field("MUSIC", "Audio Formats", "Vinyl Records", "vinylMatrix"), " 00-A/1 ").vinylMatrix === "00-A/1");
const several = D.applyDetailEdits(base, [{ field: spec, value: "one" }, { field: sample("JEWELRY_APPAREL", "Footwear", "Sneakers").all.find((f) => f.specId && f !== spec), value: "two" }]);
t("several spec edits at once all land", Object.keys(several.specs).length === 4, several.specs);

// ── Changing category never loses a value ──────────────────────────────────────────────────────────────────────────────
const watchItem = { id: "2", title: "Watch", universe: "JEWELRY_APPAREL", categoryLabel: "Watches", subcategoryLabel: "Automatic", watchBox: true, watchBrand: "Seiko", year: "1998", specs: { caliber: "7S26", old_unlisted_field: "kept" } };
const moved = { ...watchItem, universe: "MISC", categoryLabel: "Coins & Currency", subcategoryLabel: "Coins" };
const movedProfile = D.resolveItemDetailProfile(moved);
const others = D.otherSavedDetails(moved, movedProfile).map((f) => f.target);
t("values for fields the new category does not list still show", others.includes("watchBox") && others.includes("watchBrand"), others);
t("a stored spec the app no longer lists still shows", others.includes("s:old_unlisted_field"), others);
t("a shared value (year) stays in the main list after the move", movedProfile.all.some((f) => f.target === "year"));
t("nothing is removed from the item by looking at another category", moved.watchBox === true && moved.specs.caliber === "7S26");
const back = D.resolveItemDetailProfile(watchItem);
t("moving back shows them as normal fields again", back.all.some((f) => f.target === "watchBox") && D.otherSavedDetails(watchItem, back).length === 1);
// a value in a field that is "More details" in its own category is still shown
const filledMore = D.resolveItemDetailProfile({ ...watchItem });
t("every profile separates main and more fields cleanly", filledMore.primary.length + filledMore.additional.length === filledMore.all.length);
// untouched older item: nothing else is added
const old = { id: "3", title: "Older item", universe: "SPORTS", categoryLabel: "Sports Cards", subcategoryLabel: "Basketball", subtitle: "1996 Topps", number: "138", grade: "PSA 9", certNumber: "00123456", serialNumber: "0042" };
const oldOthers = D.otherSavedDetails(old, D.resolveItemDetailProfile(old));
t("an older item's existing values all have visible rows", oldOthers.length === 0 || oldOthers.every((f) => ["serialNumber"].includes(f.target)), oldOthers.map((f) => f.target));

// ── Brand typed on Add Item shows under a Brand label (toys have their own Brand row), without losing or moving data ─────────
{
  const toy = { id: "b1", title: "Retro Robots Series 2 Action Figure", universe: "POP_CULTURE", categoryLabel: "Toys & Figures", subcategoryLabel: "Action Figures", brand: "Retro Robots" };
  const profile = D.resolveItemDetailProfile(toy);
  const brandRow = profile.all.find((f) => f.label === "Brand");
  t("a toy has its own Brand row", !!brandRow, profile.all.map((f) => f.label));
  t("the Brand typed on Add Item is shown on that Brand row", brandRow && D.displayDetail(toy, brandRow) === "Retro Robots", brandRow && D.displayDetail(toy, brandRow));
  const others = D.otherSavedDetails(toy, profile);
  t("it is not listed a second time under Publisher / maker", !others.some((f) => f.target === "brand"), others.map((f) => f.label));
  t("and no other category's Brand row (watch, handbag) lists it as an 'other saved detail'", !others.some((f) => /Brand/.test(f.label)), others.map((f) => f.label));
  t("a toy's Other saved details have no brand entry at all", others.every((f) => !/brand|maker|publisher/i.test(f.label)), others.map((f) => f.label));
  t("the stored brand column is untouched by showing it", toy.brand === "Retro Robots");
  const typed = { ...toy, toyBrand: "Own Brand" };
  t("a category Brand that was typed on the item wins over the general brand", D.displayDetail(typed, brandRow) === "Own Brand");
  t("editing the Brand row writes the category Brand and keeps the general brand", JSON.stringify(D.detailPatch(toy, brandRow, "Newer Name")) === JSON.stringify({ toyBrand: "Newer Name" }));
  const cleared = D.detailPatch(toy, brandRow, "");
  t("clearing the Brand row clears what it was showing (so it does not come straight back)", cleared.toyBrand === undefined && "brand" in cleared && cleared.brand === undefined);
  // a category with no Brand row of its own keeps the value visible, with a label that says what it is
  const card = { id: "b2", title: "A card", universe: "SPORTS", categoryLabel: "Sports Cards", subcategoryLabel: "Basketball", brand: "Hardwood Heroes" };
  const cardProfile = D.resolveItemDetailProfile(card);
  const cardShown = cardProfile.all.some((f) => f.key === "brand" && D.displayDetail(card, f) === "Hardwood Heroes");
  const cardOthers = D.otherSavedDetails(card, cardProfile);
  const cardOther = cardOthers.find((f) => f.target === "brand");
  t("a category without its own Brand row still shows the brand, never labelled only 'Publisher / maker'", cardShown || (cardOther && /Brand/.test(cardOther.label) && D.displayDetail(card, cardOther) === "Hardwood Heroes"), cardOthers.map((f) => f.label));
  // a legitimate Publisher / maker on a category that lists it is not touched
  const withMaker = { id: "b3", title: "A card", universe: "SPORTS", categoryLabel: "Sports Cards", subcategoryLabel: "Basketball", brand: "Topps" };
  const makerField = D.resolveItemDetailProfile(withMaker).all.find((f) => f.key === "brand");
  t("a category that lists Publisher / maker as a field keeps that label and value", !makerField || (makerField.label !== "Brand" && D.displayDetail(withMaker, makerField) === "Topps"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
