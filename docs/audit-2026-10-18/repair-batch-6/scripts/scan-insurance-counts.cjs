// Reads the numbers GIN-092, GIN-155 and VLT-353 compare, from each page that shows them. Read-only; production, isolated QA owner.
//   AUDIT_MANIFEST=<manifest> node scan-insurance-counts.cjs
const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A;
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  const grab = async (route, res, wait = 9000) => {
    await S.visit(route); await sleep(wait);
    const t = await body(S);
    const out = {};
    for (const [k, re] of Object.entries(res)) { const m = t.match(re); out[k] = m ? m[0].slice(0, 220) : null; }
    console.log(route, JSON.stringify(out, null, 1));
  };
  await grab("/insurance", { readiness: /Documentation readiness:[^.]*\./i, notCounted: /not counted[^.]*\./i, included: /Included \d+ of \d+[^•]*/i });
  await grab("/vault?review=needs_review", { needsReview: /Needs review:? ?\d+ ?items?/i, any: /\d+ items? (need|missing)[^.]*/i });
  await grab("/reports/weekly", { insuranceReport: /Insurance report \(\d+\)/i, snippet: /Insurance[^.]{0,120}/i });
  await grab("/portfolio", { stale: /Stale Prices[^A-Za-z]{0,6}\d+[^.]{0,80}/i, staleAlt: /\d+ items? (need|needs) a price check/i });
  await grab("/vault", { vaultStale: /\d+ items? haven.t had a price check[^.]*/i });
  await grab("/dashboard", { homeStale: /\d+ valued items? have not had a price check[^.]*/i });
  await S.close();
  process.exit(0);
})();
