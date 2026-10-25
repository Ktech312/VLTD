// Records the Wishlist clip scan as evidence rows: the BEFORE run (a real defect: Following cards 486 px wide on a 390 px phone, a long want title 6 px past a 320 px screen) stays FAIL,
// the AFTER run (after commits 1555e61 and 9823fad) PASSes. Nothing is edited or superseded: the failure is a real defect, fixed.
const path = require("path");
const T = require(path.join(__dirname, "..", "..", "scripts", "audit-s-add-lib.cjs"));
const r = T.R("RB72");
const ev = (n) => require(path.join(__dirname, "..", "evidence", `rb72c-${n}.json`));
for (const run of ["before", "after"]) {
  const j = ev(run);
  for (const [k, v] of Object.entries(j.results)) {
    const [w, view] = k.split(":");
    r.check(v.count === 0, { page: "/watchlist", control: `${run === "before" ? "BEFORE the fix" : "AFTER the fix"}: nothing on the ${view} view is wider than a ${w}px phone screen`, expected: "0 elements past the screen edge", actual: v.count ? `${v.count} elements, e.g. ${JSON.stringify(v.sample[0])}` : "0", evidence: "", impact: "wishlist phone layout", repro: v.count ? "Open Watchlist, Following, on a phone with a rule that has a long name or format note." : "" });
  }
}
process.exit(0);
