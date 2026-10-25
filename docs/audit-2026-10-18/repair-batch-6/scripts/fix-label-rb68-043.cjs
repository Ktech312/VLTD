// Corrects the evidence label of the cross-account want-id bug (owner's instruction, 2026-10-24).
// RB68-043 (the original FAIL) is NOT touched. The row that was written about it, ITM-785, called it a test mistake, which was wrong: it was a real app defect (fixed in d97cf1c).
// ITM-785 is my own row from earlier today; it is rewritten in place (its first wording is kept inside it) so that the report no longer treats RB68-043 as superseded and the defect counts.
// ITM-786..788 (rows that failed because the check reused one fixed want id in two QA accounts) get a pointer to the real defect.
const fs = require("fs"); const path = require("path");
const F = path.join(__dirname, "..", "..", "rows.jsonl");
for (let attempt = 0; attempt < 5; attempt++) {
  const before = fs.statSync(F).size;
  const lines = fs.readFileSync(F, "utf8").split("\n");
  let n = 0;
  const out = lines.map((l) => {
    if (!l.trim()) return l;
    let o; try { o = JSON.parse(l); } catch { return l; }
    if (o.id === "ITM-785" && o.control.startsWith("CORRECTION")) {
      const first = o.actual;
      o.control = "REAL APP DEFECT, FIXED: cross-account want id (original failure RB68-043)";
      o.expected = "A want added by a Following rule is saved to the account of whoever follows, whichever other accounts already follow the same series";
      o.actual = "REAL APP DEFECT (not a test mistake). The id of a want added by a Following rule ('pull_' plus the release name), and of a watched item turned into a want ('want_watch_' plus the item id), was the same for every account, and want ids (and the Vault ids made from them) are one list for the whole database. QA account wsh2 had already saved that release, so the same release for wsh3 could not be saved: RB68-043 failed with no wants in the account. Two real people following the same comic series would have hit the same wall. FIXED in commit d97cf1c (ids carry a short per-profile part). ORIGINAL FAILURE KEPT: RB68-043 is unchanged. REGRESSION CHECKS: RB68-078 to RB68-116 (39 of 39 on production, fresh QA account wsh4, including the comic rule's wants reaching the account with their identity) and the unit test 'two accounts following the same series never ask for the same want or Vault id' in scripts/test-wants.ts (28 of 28). [Label corrected 2026-10-24: this row first described the failure as a test mistake and superseded RB68-043; that was wrong. First wording began: " + first.slice(0, 110) + "...]";
      o.result = "FAIL"; o.impact = "wishlist"; o.repro = "Two accounts follow the same comic series; the second account's rule-added wants are rejected because the id already belongs to the first account.";
      n++; return JSON.stringify(o);
    }
    if (["ITM-786", "ITM-787", "ITM-788"].includes(o.id) && /CORRECTION: RB68-0(73|75|77)/.test(o.control) && !o.actual.includes("ITM-785")) {
      o.actual += " (Same cross-account id property as the real app defect recorded in ITM-785, set up here by the check reusing one want id in two QA accounts; the app defect itself is ITM-785, not this row.)";
      n++; return JSON.stringify(o);
    }
    return l;
  });
  if (fs.statSync(F).size !== before) { console.log("file changed while rewriting, retry"); continue; }
  fs.writeFileSync(F, out.join("\n")); console.log("rewrote", n, "rows"); break;
}
