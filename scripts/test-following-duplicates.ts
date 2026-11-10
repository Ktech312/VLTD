// Following with a catalog that lists the same release twice, or two entries that share one source identity (simulated catalog data, no provider calls).
//   npx tsx scripts/test-following-duplicates.ts
import assert from "node:assert/strict";
(async () => {
  const core = await import("../src/lib/wantsCore"); type W = import("../src/lib/wishlistModel").WishlistItem; type R = import("../src/lib/wantsCore").CatalogRelease; type PR = import("../src/lib/wantsCore").PullRule;
  const now = Date.UTC(2026, 9, 24, 12); let pass = 0, fail = 0;
  const test = (n: string, f: () => void) => { try { f(); pass++; console.log("PASS ", n); } catch (e) { fail++; console.log("FAIL ", n, "\n      ", String((e as Error).message).split("\n")[0]); } };
  const rule: PR = { id: "r1", kind: "comic_series", name: "Night Courier", publisher: "Example Comics", yearBegan: 2026, source: "metron", sourceKey: "metron:series:77", quantity: 1, variantPolicy: "standard", state: "following", createdAt: now };
  const rel = (n: string, over: Partial<R> = {}): R => ({ identity: `metron:issue:${n}`, seriesKey: "metron:series:77", title: `Night Courier #${n}`, number: n, date: "2026-11-12", variant: false, edition: "Standard cover", externalId: n, ...over });
  const want = (over: Partial<W>): W => ({ id: "w", title: "Thing", createdAt: now, status: "want", ...over });
  test("the catalog listing one release twice (same identity) adds one want, with the first date", () => {
    const p = core.planRuleRefresh(rule, [rel("4"), rel("4", { date: "2026-12-31" })], [], now);
    assert.equal(p.add.length, 1); assert.equal(p.add[0].releaseDate, "2026-11-12"); assert.equal(p.matched, 1);
  });
  test("two existing wants with the same source identity: the refresh adds nothing and does not duplicate either", () => {
    const a = want({ id: "a", sourceIdentity: "metron:issue:4", releaseDate: "2026-11-12" }); const b = want({ id: "b", sourceIdentity: "metron:issue:4", releaseDate: "2026-11-12" });
    const p = core.planRuleRefresh(rule, [rel("4")], [a, b], now); assert.equal(p.add.length, 0);
  });
  test("a standard cover and its variant are different identities: the standard is added, the variant is only suggested, never merged", () => {
    const p = core.planRuleRefresh(rule, [rel("4"), rel("4A", { variant: true, edition: "Variant A" }), rel("4A", { variant: true, edition: "Variant A" })], [], now);
    assert.deepEqual(p.add.map((w) => w.sourceIdentity), ["metron:issue:4"]); assert.deepEqual(p.suggestions.map((s) => s.identity), ["metron:issue:4A"]);
  });
  test("a removed or skipped want with the same identity as a catalog release is not brought back by a duplicate listing (at most its date is refreshed)", () => {
    const skipped = want({ id: "s", sourceIdentity: "metron:issue:4", status: "skipped" });
    const p = core.planRuleRefresh(rule, [rel("4"), rel("4")], [skipped], now); assert.equal(p.add.length, 0); assert.ok(p.update.every((u) => Object.keys(u.patch).every((k) => k === "releaseDate" || k === "updatedAt")), "a skipped want only ever gets a date refresh, never a status change");
  });
  console.log(`\n${pass} of ${pass + fail} passed`); process.exit(fail ? 1 : 0);
})();
