// The Insurance rules in one place (src/lib/insuranceDocs.ts): who is counted, what Cost means, what an estimate is, blank versus zero.
//   node scripts/test-insurance-docs.cjs
const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-ins-"));
for (const name of ["vaultStats", "insuranceDocs"]) {
  const src = fs.readFileSync(path.join(root, "src", "lib", name + ".ts"), "utf8").replace(/"@\/lib\//g, '"./');
  fs.writeFileSync(path.join(out, name + ".js"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const D = require(path.join(out, "insuranceDocs.js"));
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail ?? ""); } };

const it = (id, extra) => ({ id, title: id, status: "COLLECTION", universe: "POP_CULTURE", category: "comics", ...extra });
const items = [
  it("allin", { purchasePrice: 100, purchaseTax: 8, purchaseShipping: 5, purchaseFees: 2, currentValue: 150 }),
  it("zerocost", { purchasePrice: 0, currentValue: 25 }),
  it("unknowncost", { currentValue: 60 }),
  it("noestimate", { purchasePrice: 40 }),
  it("zerovalue", { purchasePrice: 10, currentValue: 0 }),
  it("sold", { status: "SOLD", soldPrice: 90, purchasePrice: 30, currentValue: 70 }),
  it("soldat", { soldAt: Date.now(), purchasePrice: 5 }),
  it("supply", { universe: "MISC", category: "Supplies & Display", categoryLabel: "Supplies & Display", purchasePrice: 12 }),
  it("wish", { status: "WISHLIST", purchasePrice: 5 }),
];

// ---- who is counted
let s = D.insuranceScope(items, new Set());
check("owned items are eligible (5): sold, supply and wishlist are not", s.eligible.length === 5 && s.eligible.every((i) => ["allin", "zerocost", "unknowncost", "noestimate", "zerovalue"].includes(i.id)), s.eligible.map((i) => i.id).join(","));
check("reasons are counted: 2 sold (status and sold date/price), 1 supply, 1 wishlist, 0 excluded", s.counts.sold === 2 && s.counts.supplies === 1 && s.counts.wishlist === 1 && s.counts.excludedByYou === 0, JSON.stringify(s.counts));
s = D.insuranceScope(items, new Set(["noestimate"]));
check("an exclusion leaves the eligible list (so it can be re-included) but not the counted list", s.eligible.length === 5 && s.included.length === 4 && !s.included.some((i) => i.id === "noestimate") && s.counts.excludedByYou === 1);
check("the not-counted sentence names every reason and says 'on this device'", D.notCountedLine(s) === "Not counted: 2 sold, 1 supply item (boxes, cases), 1 wishlist item, 1 excluded by you on this device.", D.notCountedLine(s));
check("nothing excluded: no sentence", D.notCountedLine(D.insuranceScope([items[0]], new Set())) === null);
check("device-only note exists", /this device only/.test(D.EXCLUSIONS_ARE_DEVICE_ONLY) && /do not follow your account/.test(D.EXCLUSIONS_ARE_DEVICE_ONLY));

// ---- cost: all-in, blank vs explicit zero
check("cost is price + tax + shipping + fees (100+8+5+2 = 115)", D.insuranceCost(items[0]) === 115);
check("an explicit $0 cost is $0, not blank", D.insuranceCost(items[1]) === 0 && D.fmtCost(0) === "$0");
check("nothing recorded is blank (null), shown as a dash", D.insuranceCost(items[2]) === null && D.fmtCost(null) === "-");
check("a price only counts as the cost", D.insuranceCost(items[3]) === 40);

// ---- estimate: explicit only, never the purchase cost
check("an entered value is the estimate (150)", D.insuranceEstimate(items[0]) === 150);
check("an explicit $0 value is an estimate of $0", D.insuranceEstimate(items[4]) === 0 && D.fmtEstimate(0) === "$0");
check("no value entered: no estimate, even though a cost exists (cost 40 is NOT shown as value)", D.insuranceEstimate(items[3]) === null && D.fmtEstimate(null) === "No estimate");
check("no value and no cost: no estimate", D.insuranceEstimate({ id: "x", title: "x" }) === null);

// ---- totals
const t = D.insuranceTotals(D.insuranceScope(items, new Set()).included);
check("totals count the 5 owned items", t.count === 5);
check("total cost = 115 + 0 + 40 + 10 (the unknown-cost item adds nothing and is counted separately)", t.cost === 165 && t.costRecorded === 4 && t.costNotRecorded === 1, JSON.stringify(t));
check("estimated value = 150 + 25 + 60 + 0 = 235 over 4 valued items; 1 item has no estimate", t.estimate === 235 && t.estimated === 4 && t.noEstimate === 1, JSON.stringify(t));
check("the cost of the item with no estimate is reported separately and NOT added to the estimate", t.costOfUnestimated === 40 && t.estimate === 235);
check("the sentence states what is recorded and estimated", /Total cost \$165 \(4 of 5 with a recorded cost\)/.test(D.totalsSentence(t)) && /Estimated value \$235 \(4 of 5 have an estimate\)/.test(D.totalsSentence(t)), D.totalsSentence(t));
check("the no-estimate note says cost is not counted as value", /1 item has no estimated value/.test(D.noEstimateNote(t)) && /not counted as value/.test(D.noEstimateNote(t)), D.noEstimateNote(t));
check("no note when every item has an estimate", D.noEstimateNote(D.insuranceTotals([items[0], items[1]])) === null);

// ---- static guards: every Insurance document uses the shared rules; print hides the site bars by marker, not by selector guesswork
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const DOCS = ["src/app/insurance/page.tsx", "src/app/insurance/packet/page.tsx", "src/app/insurance/packet/print/page.tsx", "src/app/insurance/item/page.tsx", "src/app/portfolio/insurance/page.tsx", "src/app/reports/insurance/page.tsx"];
for (const f of DOCS) {
  const src = read(f);
  check(f + " uses the shared Insurance rules", src.includes("@/lib/insuranceDocs"));
  check(f + " is marked as a print document", src.includes("vltd-print-document"));
  check(f + " no longer shows purchase price as a stated value", !src.includes("insuranceValue(") && !src.includes("PURCHASE_BASED_NOTE"));
}
const pdf = read("src/lib/insurancePdf.ts");
check("the Vault PDF uses the shared cost and estimate rules", pdf.includes("@/lib/insuranceDocs") && !pdf.includes("insuranceValue(") && !pdf.includes("PURCHASE_BASED_NOTE"));
check("the PDF dialog applies the shared eligibility rules to a collection export", read("src/components/InsurancePdfButton.tsx").includes("insuranceScope("));
check("the broken print selector that matched <html> is gone", !read("src/app/insurance/packet/print/page.tsx").includes('[style*="--topnav"]'));
check("the link-presence print block is gone from insurance-pass.css", !/@media print\s*\{\s*body:not\(:has\(\.vltd-ins-light\)\):has\(a\[href/.test(read("src/app/insurance-pass.css")));
for (const f of ["src/components/TopNav.tsx", "src/components/BottomNav.tsx", "src/components/SyncStatusPill.tsx", "src/components/PWAInstallBanner.tsx", "src/components/BugReporter.tsx"]) check(f + " is marked data-site-chrome", read(f).includes("data-site-chrome"));
const css = read("src/app/globals.css");
check("print CSS hides site chrome and releases the clipped scroll box for print documents", css.includes("[data-site-chrome]") && css.includes(".vltd-content-wrap") && css.includes("vltd-print-document"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
