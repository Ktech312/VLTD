// Tests for the shared purchase-cost rule (blank stays blank, 0 stays 0, negatives refused).
//   npm run test:costs
const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-cost-"));
const src = fs.readFileSync(path.join(root, "src", "lib", "costInput.ts"), "utf8");
fs.writeFileSync(path.join(out, "costInput.js"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const { parseCostInput, isNegativeCostText, typedAmount, NEGATIVE_COST_MESSAGE } = require(path.join(out, "costInput.js"));

let pass = 0, fail = 0;
const t = (name, ok, detail) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail ?? "")); };

for (const blank of ["", "   ", undefined, null]) t(`blank (${JSON.stringify(blank)}) stays unknown`, parseCostInput(blank).value === undefined && !parseCostInput(blank).negative);
for (const zero of ["0", "0.00", " 0 ", "$0", 0]) t(`explicit zero (${JSON.stringify(zero)}) stays 0`, parseCostInput(zero).value === 0 && !parseCostInput(zero).negative, parseCostInput(zero));
t("positive 12.5", parseCostInput("12.5").value === 12.5);
t("currency and commas: $1,250.50", parseCostInput("$1,250.50").value === 1250.5);
for (const neg of ["-5", "-0.01", "$-5", "-$5", "(5)", "($5.00)", -5, " -12 "]) t(`negative (${JSON.stringify(neg)}) is refused`, parseCostInput(neg).negative === true && parseCostInput(neg).value === undefined && isNegativeCostText(neg), parseCostInput(neg));
t("-0 is not negative (it is zero)", !isNegativeCostText("-0") && parseCostInput("-0").value === 0 || parseCostInput("-0").value === -0, parseCostInput("-0"));
for (const junk of ["abc", "-", ".", "n/a"]) t(`text without a number (${JSON.stringify(junk)}) is not treated as negative or as 0`, parseCostInput(junk).value === undefined && !parseCostInput(junk).negative);
t("the message tells the person what to do instead", /blank/.test(NEGATIVE_COST_MESSAGE) && /0/.test(NEGATIVE_COST_MESSAGE) && /negative/.test(NEGATIVE_COST_MESSAGE));
t("typedAmount of NaN/Infinity is nothing", typedAmount(NaN) === undefined && typedAmount(Infinity) === undefined);


// ---- the importers that take a cost from text or from marketplace order files ----
const compile = (srcText) => ts.transpileModule(srcText, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const load = (code, mocks = {}) => { const m = { exports: {} }; new Function("module", "exports", "require", code)(m, m.exports, (n) => { if (n in mocks) return mocks[n]; throw new Error("unexpected require " + n); }); return m.exports; };
for (const [file, fn, keys] of [["ebayImport.ts", "parseEbayImportRow", { title: "Title", price: "Item price", ship: "Shipping and handling", tax: "Tax" }], ["whatnotImport.ts", "parseWhatnotImportRow", { title: "Item Name", price: "Price", ship: "Shipping", tax: "Tax" }]]) {
  const src = fs.readFileSync(path.join(root, "src", "lib", "importParsers", file), "utf8");
  const mod = load(compile(src), { "@/lib/id": { newId: () => "id-1" } });
  const parse = mod[fn];
  const row = (price, ship, tax) => ({ [keys.title]: "Order item", [keys.price]: price, [keys.ship]: ship, [keys.tax]: tax });
  const neg = parse(row("-5", "2", "1"));
  t(file + ": a negative price in the file is not imported as a cost (left blank)", neg.purchasePrice === undefined, neg.purchasePrice);
  t(file + ": the item says why (import note)", /negative amount in the file was not imported/.test(neg.notes || ""), neg.notes);
  t(file + ": the other amounts on that row are kept", neg.purchaseShipping === 2 && neg.purchaseTax === 1, neg);
  const negShip = parse(row("10", "-3", ""));
  t(file + ": a negative shipping amount is not imported either", negShip.purchasePrice === 10 && negShip.purchaseShipping === undefined && /not imported/.test(negShip.notes || ""), negShip);
  const zero = parse(row("0", "0", "0"));
  t(file + ": explicit 0 amounts stay 0 and add no note", zero.purchasePrice === 0 && zero.purchaseShipping === 0 && zero.purchaseTax === 0 && !/not imported/.test(zero.notes || ""), zero);
  const blank = parse(row("", "", ""));
  t(file + ": blank amounts stay unknown", blank.purchasePrice === undefined && blank.purchaseShipping === undefined && blank.purchaseTax === undefined, blank);
  const namer = mod[fn === "parseEbayImportRow" ? "negativeEbayAmounts" : "negativeWhatnotAmounts"];
  t(file + ": the review can name which amounts are negative (price, shipping, tax)", JSON.stringify(namer(row("-5", "-3", "-1")).map((x) => x.label)) === JSON.stringify(["price", "shipping", "tax"]) && namer(row("-5", "2", "1")).length === 1 && namer(row("-5", "2", "1"))[0].shown === "-5", namer(row("-5", "-3", "-1")));
  t(file + ": blank, 0 and positive amounts are not reported as negative", namer(row("", "", "")).length === 0 && namer(row("0", "0", "0")).length === 0 && namer(row("12.5", "1", "1")).length === 0);
  const pos = parse(row("$12.50", "1.25", "0.9"));
  t(file + ": positive amounts are unchanged", pos.purchasePrice === 12.5 && pos.purchaseShipping === 1.25 && pos.purchaseTax === 0.9, pos);
}
{
  const src = fs.readFileSync(path.join(root, "src", "app", "vault", "import", "TextImportClient.tsx"), "utf8");
  const from = src.indexOf("function parseMoney");
  const to = src.indexOf("\n}\n", src.indexOf("function parseRows")) + 3;
  const mod = load(compile(src.slice(from, to) + "\nmodule.exports = { parseRows };"));
  const out = mod.parseRows(["Neg Card | -5 | n | 1", "Zero Card | 0 | n | 1", "Blank Card | | n | 1", "Pos Card | 12.5 | n | 2", "Title only"].join("\n"));
  const by = (title) => out.validRows.find((r) => r.title === title);
  t("text import: a negative cost row is skipped with a plain reason", !by("Neg Card") && out.ignoredRows.some((r) => /Negative purchase price/.test(r.reason) && /leave it blank or use 0/.test(r.reason)), out.ignoredRows);
  t("text import: explicit 0 stays 0, blank stays unknown, positive unchanged", by("Zero Card") && by("Zero Card").purchasePrice === 0 && by("Blank Card") && by("Blank Card").purchasePrice === undefined && by("Pos Card") && by("Pos Card").purchasePrice === 12.5 && by("Pos Card").quantity === 2, out.validRows);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
