// Buyer-facing text is built from PUBLIC fields only (audit RC-02): never the private notes, never what was paid.
// Every marketplace builder and every copy mode, with unmistakable sentinels for the private values.
//   node scripts/test-listing-privacy.cjs
const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-listing-"));
for (const name of ["taxonomy", "listingGenerator", "generateItemCopy"]) {
  const src = fs.readFileSync(path.join(root, "src", "lib", name + ".ts"), "utf8").replace(/"@\/lib\//g, '"./');
  fs.writeFileSync(path.join(out, name + ".js"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const L = require(path.join(out, "listingGenerator.js"));
const { generateItemCopy } = require(path.join(out, "generateItemCopy.js"));

let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail ?? ""); } };

const PRIVATE_NOTE = "PRIVATE-NOTE-SENTINEL-do-not-publish-7f3a";
const PUBLIC_DESC = "PUBLIC-DESCRIPTION-SENTINEL-91bc";
const PAID = 4321.09;
const base = { id: "synthetic-1", title: "Synthetic Test Comic", universe: "POP_CULTURE", category: "comics", status: "FOR_SALE", notes: `${PRIVATE_NOTE} bought from a private seller, art by Alex Ross`, purchasePrice: PAID, purchaseTax: 11.11, purchaseShipping: 22.22, askingPrice: 99, grade: "CGC 9.4", certNumber: "CERT-1" };
const withDesc = { ...base, description: PUBLIC_DESC };
const leaksPrivate = (text) => text.includes(PRIVATE_NOTE) || /bought from a private seller/.test(text) || /4,?321/.test(text) || /Recorded cost basis/i.test(text) || /11\.11|22\.22/.test(text);

const builders = { ebay: L.generateEbayListing, etsy: L.generateEtsyListing, icona: L.generateIconaListing, whatnot: L.generateWhatnotListing, discogs: L.generateDiscogsListing, mercari: L.generateMercariListing, facebook: L.generateFacebookListing, pwcc: L.generatePwccListing };
for (const [name, fn] of Object.entries(builders)) {
  const a = fn(L.itemToListingInput(withDesc));
  const b = fn(L.itemToListingInput(base));
  const text = (o) => [o.title, o.description, o.socialCaption, o.checklist.join(" "), o.warnings.join(" ")].join("\n");
  check(`${name}: with a public description, no private note and no cost anywhere in the output`, !leaksPrivate(text(a)), text(a).slice(0, 200));
  check(`${name}: the public description is used`, a.description.includes(PUBLIC_DESC));
  check(`${name}: with NO public description the output is still free of the private note and cost`, !leaksPrivate(text(b)), text(b).slice(0, 200));
  check(`${name}: with no public description it falls back to the neutral sentence`, /Collector-owned item from a cataloged VLTD vault/.test(b.description));
  check(`${name}: with no public description the readiness warning is labelled "Public description needed."`, b.warnings.includes("Public description needed."), JSON.stringify(b.warnings));
  check(`${name}: with a public description there is no description warning`, !a.warnings.some((w) => /description/i.test(w)), JSON.stringify(a.warnings));
}
const input = L.itemToListingInput(base);
check("the listing input carries no private notes and no purchase price", !("notes" in input) && !("purchasePrice" in input), Object.keys(input).join(","));

for (const mode of ["listing", "description", "social"]) {
  const t = generateItemCopy(base, mode).text;
  check(`generate (${mode}): no private note and no cost`, !leaksPrivate(t), t.slice(0, 200));
}
// artist-name inference must not read private notes ("art by Alex Ross" is only in the private note)
const artistFromNote = generateItemCopy({ ...base, title: "Synthetic Test Comic", subject: "" }, "description").text + generateItemCopy({ ...base }, "listing").text;
check("artist-name inference ignores private notes", !/Alex Ross/.test(artistFromNote), artistFromNote.slice(0, 200));
const artistFromTitle = generateItemCopy({ ...base, title: "Synthetic Comic art by Alex Ross", notes: "" }, "description").text + generateItemCopy({ ...base, title: "Synthetic Comic art by Alex Ross", notes: "" }, "listing").text;
check("artist-name inference still reads the public title", /Alex Ross/.test(artistFromTitle), artistFromTitle.slice(0, 200));
// the private data is untouched (nothing here writes to the item)
check("the item's private note is still stored on the item object", base.notes.includes(PRIVATE_NOTE));

// the places that decide whether an item is "ready to list" must not count or display private notes either
for (const f of ["src/components/ListingReadinessPanel.tsx", "src/app/vault/for-sale/page.tsx", "src/lib/listingGenerator.ts", "src/lib/generateItemCopy.ts"]) {
  const src = fs.readFileSync(path.join(root, f), "utf8").replace(/\/\/.*$/gm, "");
  check(f + " does not read item.notes", !/\bitem\.notes\b|input\.notes\b/.test(src), "reads private notes");
}
check('the readiness checklist says "Public description needed."', /Public description needed\./.test(fs.readFileSync(path.join(root, "src/components/ListingReadinessPanel.tsx"), "utf8")));

// the public description must survive loading: the item normalizer once never copied it, so every load dropped it from the local copy
const vm = fs.readFileSync(path.join(root, "src/lib/vaultModel.ts"), "utf8");
check("the item normalizer keeps the public description", /notes: raw\.notes \?\? undefined,\s*(\/\/[^\n]*\n\s*)*description: typeof raw\.description === "string"/.test(vm), "description line missing next to notes in normalizeItem");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
