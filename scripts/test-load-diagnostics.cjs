// Unit test for src/lib/loadDiagnostics.ts: the per-tab load record keeps only step names, timings and short codes. No browser needed.
//   npm run test:loaddiag
const fs = require("fs"), os = require("os"), path = require("path"), ts = require("typescript");
const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-load-"));
fs.writeFileSync(path.join(out, "f.js"), ts.transpileModule(fs.readFileSync(path.join(root, "src", "lib", "loadDiagnostics.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
let pass = 0, fail = 0;
const t = (n, ok, d) => { if (ok) { pass++; console.log("PASS", n); } else { fail++; console.log("FAIL", n, d ?? ""); } };
let store = {}; let broken = false;
global.window = { sessionStorage: { getItem: (k) => { if (broken) throw new Error("blocked"); return k in store ? store[k] : null; }, setItem: (k, v) => { if (broken) throw new Error("full"); store[k] = String(v); } } };
global.performance = { now: () => 1234.6 };
const { markLoadStage, readLoadDiagnostics, describeLoadFailure, cleanNote } = require(path.join(out, "f.js"));

markLoadStage("guard:account-check", true, "signed in in 312 ms");
let r = readLoadDiagnostics();
t("a step is recorded with its name, result and timing", r.length === 1 && r[0].stage === "guard:account-check" && r[0].ok === true && r[0].ms === 1235 && /signed in/.test(r[0].note), r);
t("describeLoadFailure is empty when nothing failed", describeLoadFailure() === "");
markLoadStage("vault:cloud-pull", false, "failed or timed out");
t("a failed step is named in the one-line description", describeLoadFailure() === "vault:cloud-pull (failed or timed out)", describeLoadFailure());
for (let i = 0; i < 100; i++) markLoadStage("s" + i, i % 2 === 0, "n" + i);
r = readLoadDiagnostics();
t("the record keeps only the last 60 entries", r.length === 60 && r[59].stage === "s99" && r[0].stage === "s40", [r.length, r[0].stage]);
t("only the last 4 failures are described", describeLoadFailure().split("; ").length === 4, describeLoadFailure());
t("a link in a note is cut down to its path (no host, no query, no token)", cleanNote("could not load https://abc.supabase.co/rest/v1/vault_items?select=title&apikey=SECRET123") === "could not load /rest/v1/vault_items", cleanNote("could not load https://abc.supabase.co/rest/v1/vault_items?select=title&apikey=SECRET123"));
t("an e-mail address is replaced", cleanNote("failed for ehren@example.com today") === "failed for [email] today", cleanNote("failed for ehren@example.com today"));
t("an account or profile id is replaced", cleanNote("profile 3cbff34b-7029-4b66-b330-a229dd8c2bed missing") === "profile [id] missing", cleanNote("profile 3cbff34b-7029-4b66-b330-a229dd8c2bed missing"));
t("a long note is cut to 90 characters", cleanNote("x".repeat(500)).length === 90);
markLoadStage("t", false, "see https://x.test/a?token=SECRET and a@b.co");
t("a stored note never contains the secret, host or e-mail", !/SECRET|x\.test|a@b\.co/.test(JSON.stringify(readLoadDiagnostics())), JSON.stringify(readLoadDiagnostics().slice(-1)));
broken = true;
let threw = false; try { markLoadStage("z", true, ""); readLoadDiagnostics(); describeLoadFailure(); } catch { threw = true; }
t("blocked or full storage never breaks the page (nothing throws)", threw === false);
store = {}; broken = false; global.window = undefined;
let threw2 = false; try { markLoadStage("z", true, ""); } catch { threw2 = true; }
t("outside a browser it does nothing and does not throw", threw2 === false && readLoadDiagnostics().length === 0);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
