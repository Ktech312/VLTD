// Corrections for the navigation production checks (RB65 partial run, RB66 first run). All of these were mistakes in the CHECK, not in the app; the passing re-run is RB66 run2.
const path = require("path"); const fs = require("fs");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const rows = fs.readFileSync(path.join(__dirname, "..", "..", "rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const find = (re, control) => rows.filter((r) => re.test(r.id) && r.result === "FAIL" && (r.control || "").includes(control)).map((r) => r.id);
const done = [];
const ids = (re, control) => { const f = find(re, control); return f; };
const a = [...ids(/^RB65-/, "find an item"), ...ids(/^RB66-/, "find an item")];
if (a.length) { X.corr(a, "the check pressed Enter without the character that a real key press carries, so the header search form never received it; with a real key press (text) the header search opens the Vault filtered to the item. Passes in RB66 run2.", "RB66 run2"); done.push(...a); }
const b = [...ids(/^RB65-/, "sell one"), ...ids(/^RB66-/, "sell one")];
if (b.length) { X.corr(b, "the check looked for a Sell button on the Vault's default Wall view, which has none. The Sell button is on the Gallery view cards, and the For Sale page has Mark sold; both were then checked (each opens the sale-price question; cancelled, nothing sold). Passes in RB66 run2. Disclosed separately: the default Wall view has no sell control.", "RB66 run2"); done.push(...b); }
const c = ids(/^RB66-/, "phone bottom bar");
if (c.length) { X.corr(c, "the check read every link inside the phone navigation element, and that element also holds the floating Quick Add and Add Item links; only the five tabs were meant. Passes in RB66 run2 with those two excluded.", "RB66 run2"); done.push(...c); }
const d = ids(/^RB66-/, "browser Back");
if (d.length) { X.corr(d, "failed once: Back from Events landed on Home instead of Insights. The check clicked Insights 2.5 seconds after Home loaded; with a 3 second wait for the page to finish loading it passes (Home to Insights to Events, Back, Back, in order). The cause was not isolated further; a repeat of this on a slow connection is worth a look.", "RB66 run2"); done.push(...d); }
console.log("superseding", done.join(", ") || "nothing");
process.exit(0);
