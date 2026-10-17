// One answer for an item's category, the marketplaces that fit it, and the eBay rate that goes with it (src/lib/taxonomy.ts, marketplaces.ts, sellerFees.ts).
//   node scripts/test-sell-tools.cjs
const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-sell-"));
for (const name of ["taxonomy", "marketplaces", "sellerFees"]) {
  const src = fs.readFileSync(path.join(root, "src", "lib", name + ".ts"), "utf8").replace(/"@\/lib\//g, '"./');
  fs.writeFileSync(path.join(out, name + ".js"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const { resolveCategoryLabel } = require(path.join(out, "taxonomy.js"));
const { marketplacesFor, marketplaceAdvice } = require(path.join(out, "marketplaces.js"));
const { FEE_RULES, ebayRate, estimateSaleFees } = require(path.join(out, "sellerFees.js"));

let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, JSON.stringify(detail ?? "")); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- category: header, summary and editor all ask this one function ---
check("only the stored code 'comics' (no label) reads Comics", resolveCategoryLabel({ universe: "POP_CULTURE", category: "comics" }) === "Comics");
check("code in capitals reads the same", resolveCategoryLabel({ universe: "POP_CULTURE", category: "COMICS" }) === "Comics");
check("a code with underscores finds its category (SPORTS_CARDS)", resolveCategoryLabel({ universe: "SPORTS", category: "SPORTS_CARDS" }) === "Sports Cards");
check("a saved label wins over the code", resolveCategoryLabel({ universe: "SPORTS", category: "comics", categoryLabel: "Memorabilia" }) === "Memorabilia");
check("a label in the wrong case is tidied to the real category name", resolveCategoryLabel({ universe: "POP_CULTURE", categoryLabel: "toys & figures" }) === "Toys & Figures");
check("a code from another universe is still found", resolveCategoryLabel({ universe: "MISC", category: "comics" }) === "Comics");
check("a custom category keeps its own name", resolveCategoryLabel({ universe: "MISC", category: "CUSTOM", customCategoryLabel: "Matchbox Tins" }) === "Matchbox Tins");
check("an unknown code is made readable", resolveCategoryLabel({ universe: "MISC", category: "WEIRD_THING" }) === "Weird Thing");
check("nothing recorded reads Collector’s Choice, as it always did", resolveCategoryLabel({ universe: "POP_CULTURE" }) === "Collector’s Choice");

// --- marketplaces ---
const place = (universe, category, subcategory) => ({ universe, category, subcategory });
check("a comic: eBay, Mercari, Whatnot, Fanatics Collect (no Discogs)", eq(marketplacesFor(place("POP_CULTURE", "Comics")), ["ebay", "mercari", "whatnot", "pwcc"]));
check("a sports card: Fanatics Collect yes, Discogs no", eq(marketplacesFor(place("SPORTS", "Sports Cards", "Baseball")), ["ebay", "mercari", "whatnot", "pwcc"]));
check("sports apparel: no Fanatics Collect", eq(marketplacesFor(place("SPORTS", "Apparel")), ["ebay", "mercari", "whatnot"]));
check("a TCG card: Fanatics Collect yes; TCG accessories: no", marketplacesFor(place("TCG", "TCG / CCG")).includes("pwcc") && !marketplacesFor(place("TCG", "Accessories")).includes("pwcc"));
check("vinyl / CDs: Discogs yes, Fanatics Collect no", eq(marketplacesFor(place("MUSIC", "Audio Formats", "Vinyl Records")), ["ebay", "mercari", "whatnot", "discogs"]));
check("a guitar or a gig poster: no Discogs", !marketplacesFor(place("MUSIC", "Instruments & Gear")).includes("discogs") && !marketplacesFor(place("MUSIC", "Print & Ephemera")).includes("discogs"));
check("a toy, a car part, a painting: only the general marketplaces", eq(marketplacesFor(place("POP_CULTURE", "Toys & Figures")), ["ebay", "mercari", "whatnot"]) && eq(marketplacesFor(place("AUTOMOTIVE", "Car Parts")), ["ebay", "mercari", "whatnot"]) && eq(marketplacesFor(place("ART", "Painting")), ["ebay", "mercari", "whatnot"]));
check("Discogs is suggested first only for music releases", marketplaceAdvice(place("MUSIC", "Audio Formats")).suggested === "discogs" && marketplaceAdvice(place("POP_CULTURE", "Comics")).suggested === "ebay");

// --- eBay rates read from eBay's own fee page (October 2026) ---
check("comics, cards, CCG, coins: 13.25%", ["Comics", "Sports Cards", "TCG / CCG", "Non-Sport Collectible", "Coins & Currency"].every((c) => ebayRate(c) === 0.1325));
check("bullion is not in the 13.25% group", ebayRate("Coins & Currency", "Bullion") === 0.136);
check("books, magazines, movies, non-vinyl music: 15.3%", ebayRate("Books") === 0.153 && ebayRate("Movies / TV / Film", "DVD") === 0.153 && ebayRate("Audio Formats", "CDs") === 0.153);
check("vinyl records are not in the 15.3% group", ebayRate("Audio Formats", "Vinyl Records") === 0.136);
check("everything else: 13.6%", ebayRate("Toys & Figures") === 0.136 && ebayRate("Instruments & Gear") === 0.136 && ebayRate(undefined) === 0.136);
check("eBay on $100 for a comic: 13.25 + 0.40 = 13.65", Math.abs(FEE_RULES.ebay(100, "Comics").total - 13.65) < 1e-9);
check("eBay on $100 for a guitar: 13.6 + 0.40 = 14.00", Math.abs(FEE_RULES.ebay(100, "Instruments & Gear").total - 14) < 1e-9);
check("eBay above $7,500: 2.35% on the rest (comic at $10,000 = 7500 x 13.25% + 2500 x 2.35% + 0.40)", Math.abs(FEE_RULES.ebay(10000, "Comics").total - (7500 * 0.1325 + 2500 * 0.0235 + 0.4)) < 1e-9);
check("eBay per order: $0.30 up to $10, $0.40 over", Math.abs(FEE_RULES.ebay(10, "Comics").total - (1.325 + 0.3)) < 1e-9 && Math.abs(FEE_RULES.ebay(10.01, "Comics").total - (10.01 * 0.1325 + 0.4)) < 1e-9);
check("Discogs on $100: 9% + 2.9% + $0.30 = 12.20", Math.abs(FEE_RULES.discogs(100).total - 12.2) < 1e-9);
check("Fanatics Collect on $100: 6%", Math.abs(FEE_RULES.pwcc(100).total - 6) < 1e-9);
check("a sale recorded on eBay is estimated with the item's own category", estimateSaleFees("eBay", 100, "Comics", undefined) === 13.65 && estimateSaleFees("eBay", 100, "Toys & Figures") === 14);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
