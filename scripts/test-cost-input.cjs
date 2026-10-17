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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
