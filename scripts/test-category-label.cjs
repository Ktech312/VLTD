// Regression test: a stored category code must never be shown as the category name.
//   npm run test:category
// Defect (demonstrated 2026-10-14, live): items added after the first in the Add Item form showed "COLLECTORS_CHOICE".
const fs = require("fs"), os = require("os"), path = require("path"), ts = require("typescript");
const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-cat-"));
fs.writeFileSync(path.join(out, "c.js"), ts.transpileModule(fs.readFileSync(path.join(root, "src", "lib", "categoryLabels.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const { resolveCategoryLabel: r } = require(path.join(out, "c.js"));
let pass = 0, fail = 0;
const t = (n, ok, d) => { if (ok) { pass++; console.log("PASS", n); } else { fail++; console.log("FAIL", n, d ?? ""); } };
const opts = ["Collectors Choice", "Sports Cards", "Trading Card Games"];
t("a name the form holds wins", r(opts, "Sports Cards", "COLLECTORS_CHOICE") === "Sports Cards");
t("a kept code becomes the matching name", r(opts, "", "COLLECTORS_CHOICE") === "Collectors Choice");
t("a kept code with another spelling still matches", r(opts, undefined, "sports_cards") === "Sports Cards");
t("an unknown code is not shown as a name", r(opts, "", "SOMETHING_ELSE") === "");
t("a typed name that is not an option is kept", r(opts, "", "My Own Shelf") === "My Own Shelf");
t("nothing known gives an empty answer", r(opts, "", "") === "" && r(opts, null, null) === "");
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
