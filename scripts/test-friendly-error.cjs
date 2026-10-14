// Regression test: a lost connection must read as plain words, never the browser's own "Failed to fetch".
//   npm run test:errors
const fs = require("fs"), os = require("os"), path = require("path"), ts = require("typescript");
const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-err-"));
fs.writeFileSync(path.join(out, "f.js"), ts.transpileModule(fs.readFileSync(path.join(root, "src", "lib", "friendlyError.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const { friendlyErrorMessage: f, looksLikeConnectionProblem: l } = require(path.join(out, "f.js"));
let pass = 0, fail = 0;
const t = (n, ok, d) => { if (ok) { pass++; console.log("PASS", n); } else { fail++; console.log("FAIL", n, d ?? ""); } };
Object.defineProperty(global, "navigator", { value: { onLine: true }, configurable: true });
t("Failed to fetch becomes a plain sentence", /couldn't reach VLTD/.test(f(new TypeError("Failed to fetch"), "x")), f(new TypeError("Failed to fetch"), "x"));
t("Safari's wording is covered", /couldn't reach VLTD/.test(f(new TypeError("Load failed"), "x")));
t("a timeout says it may not have gone through", /too long/.test(f(new Error("Profile creation timed out"), "x")));
t("the sentence says the typed data is still there", /still here/.test(f(new TypeError("Failed to fetch"), "x")));
t("a server's own plain message is kept", f(new Error("Use at least 8 characters for your password."), "x") === "Use at least 8 characters for your password.");
t("nothing known falls back", f(undefined, "Login failed.") === "Login failed.");
Object.defineProperty(global, "navigator", { value: { onLine: false }, configurable: true });
t("offline says so", /offline/.test(f(new Error("anything"), "x")));
t("looksLikeConnectionProblem", l("Failed to fetch") && !l("Invalid login credentials"));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
