// The agreed value rule, tested on the real functions:  npx tsx supabase/validation/test-value-rule.ts
import { computeVaultStats, hasExplicitValue, summarizeGain, totalsValue, valueBasis, gainStatus, itemGain } from "../../src/lib/vaultStats";
let pass = 0, fail = 0;
const t = (n: string, ok: boolean, d?: unknown) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "")); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const it = (o: any) => ({ id: String(Math.random()), title: "x", status: "COLLECTION", universe: "MISC", ...o });
const explicit = it({ currentValue: 50, purchasePrice: 20 });
const costOnly = it({ purchasePrice: 30, purchaseTax: 2, purchaseShipping: 3 });
const neither = it({});
const zeroValue = it({ currentValue: 0, purchasePrice: 10 });
const zeroCostOnly = it({ purchasePrice: 0 });
const taxOnly = it({ purchaseShipping: 4 });

t("explicit valuation is used", valueBasis(explicit).basis === "explicit" && valueBasis(explicit).amount === 50);
t("no valuation but a recorded total cost -> At purchase cost (price + tax + shipping + fees)", valueBasis(costOnly).basis === "purchase" && valueBasis(costOnly).amount === 35, valueBasis(costOnly));
t("neither -> Missing value (amount 0, not a ghost)", valueBasis(neither).basis === "missing" && totalsValue(neither).isGhost === false);
t("an explicit zero valuation stays valid (and is not replaced by the cost)", valueBasis(zeroValue).basis === "explicit" && valueBasis(zeroValue).amount === 0 && hasExplicitValue(zeroValue));
t("a recorded $0 cost counts as a recorded cost (At purchase cost $0), not as missing", valueBasis(zeroCostOnly).basis === "purchase" && valueBasis(zeroCostOnly).amount === 0);
t("a cost made of shipping only is still a recorded cost", valueBasis(taxOnly).basis === "purchase" && valueBasis(taxOnly).amount === 4);

const s = computeVaultStats([explicit, costOnly, neither, zeroValue, zeroCostOnly], "fill");
t("known total = explicit 50 + at-cost 35 + explicit zero 0 + recorded-zero cost 0 = 85", s.totalValue === 85, s.totalValue);
t("the missing item is EXCLUDED and counted (missingCount 1)", s.missingCount === 1, s.missingCount);
t("at-purchase-cost count is 2 (cost-only and the recorded-$0 cost), priced count 2", s.ghostCount === 2 && s.pricedCount === 2, [s.ghostCount, s.pricedCount]);
t("itemCount stays 5 (nothing silently dropped)", s.itemCount === 5);
const p = computeVaultStats([explicit, costOnly, neither, zeroValue], "priced");
t("'priced only' mode counts explicit valuations only (50 + 0)", p.totalValue === 50, p.totalValue);

t("missing information creates NO loss: missing and cost-only items are excluded from the unrealized change", gainStatus(neither) === "no-value" && gainStatus(costOnly) === "no-value" && itemGain(neither) === null && itemGain(costOnly) === null);
const g = summarizeGain([explicit, costOnly, neither]);
t("unrealized change measures only the explicitly valued item (+30), not the two unvalued ones", g.gain === 30 && g.eligibleCount === 1, g);
t("an explicit $0 valuation on an item with a cost is a real, stated loss (-10), not missing information", gainStatus(zeroValue) === "eligible" && itemGain(zeroValue)?.gain === -10, itemGain(zeroValue));
t("'Needs valuation' (no valuation) covers both at-cost and missing; 'Missing value' is only the neither case", ["purchase", "missing"].includes(valueBasis(costOnly).basis) && ["purchase", "missing"].includes(valueBasis(neither).basis) && valueBasis(costOnly).basis !== valueBasis(neither).basis);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
