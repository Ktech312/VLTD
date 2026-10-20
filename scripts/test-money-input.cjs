// Tests for the strict money-input rule (RC-17) and the one sale rule (RC-18).
//   npm run test:money
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const compile = (file) => ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const load = (code, mocks = {}) => { const m = { exports: {} }; new Function("module", "exports", "require", code)(m, m.exports, (n) => { if (n in mocks) return mocks[n]; throw new Error("unexpected require " + n); }); return m.exports; };

const money = load(compile("src/lib/moneyInput.ts"));
const sellerFees = load(compile("src/lib/sellerFees.ts"));
const sold = load(compile("src/lib/soldItems.ts"), {
  "@/lib/auth": { getStoredActiveProfileId: () => "p" },
  "@/lib/sellerFees": sellerFees,
  "@/lib/taxonomy": { resolveCategoryLabel: () => undefined },
  "@/lib/vaultModel": { getPrimaryImageUrl: () => "", loadItems: () => [] },
});

let pass = 0, fail = 0;
const t = (name, ok, detail) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail ?? "")); };
const p = (v, o) => money.parseMoneyInput(v, o);

// ---- blank vs explicit zero
for (const blank of ["", "   ", undefined, null]) t(`blank (${JSON.stringify(blank)}) stays blank, never 0`, p(blank).ok && p(blank).blank === true && p(blank).value === undefined, p(blank));
for (const zero of ["0", "0.00", " 0 ", "$0", "-0", 0]) t(`explicit zero (${JSON.stringify(zero)}) stays 0`, p(zero).ok && p(zero).blank === false && p(zero).value === 0 && !Object.is(p(zero).value, -0), p(zero));

// ---- supported formats
const good = [["12.5", 12.5], ["25", 25], ["25.", 25], [".5", 0.5], ["$1,250.50", 1250.5], ["1,250", 1250], ["£99", 99], ["€ 7", 7], ["1,000,000", 1000000], [" 42 ", 42], [19.99, 19.99]];
for (const [raw, want] of good) t(`supported ${JSON.stringify(raw)} = ${want}`, p(raw).ok && p(raw).value === want, p(raw));

// ---- refused: letters, exponents, ambiguous and malformed
for (const raw of ["abc", "12abc", "1e3", "1E3", "1,5", "1,50", "12,34,56", "1.2.3", "1 000", "5-3", "--5", "$", ".", "-", "n/a", "NaN", "Infinity", "12.345", "0x10", "1,2345.00"]) {
  const r = p(raw, { label: "Cost" });
  t(`refused ${JSON.stringify(raw)} with a message`, r.ok === false && /Cost/.test(r.message) && r.message.length > 10, r);
}
t("1e3 is never read as 13", !(p("1e3").ok && p("1e3").value === 13));
t("1,5 is never read as 15", !(p("1,5").ok && p("1,5").value === 15));
t("letters are never turned into 0 or blank", !p("abc").ok);

// ---- negatives
for (const raw of ["-5", "-0.01", "$-5", "-$5", "(5)", "($5.00)", -5, " -12 "]) {
  const r = p(raw, { label: "Price" });
  t(`negative ${JSON.stringify(raw)} refused`, r.ok === false && /negative/.test(r.message), r);
}
t("a negative is allowed only when asked", p("-5", { allowNegative: true }).ok && p("-5", { allowNegative: true }).value === -5);
t("absurdly large is refused", !p("99999999999").ok && !p(1e12).ok);

// ---- item-level save guard (the save, not only the box)
const prev = { purchasePrice: 5, currentValue: -3 };
t("changed negative amount blocks the save", !!money.itemMoneyProblem(prev, { purchasePrice: -1 }));
t("changed NaN blocks the save", !!money.itemMoneyProblem(prev, { purchasePrice: NaN }));
t("changed string blocks the save", !!money.itemMoneyProblem(prev, { askingPrice: "12" }));
t("a valid change and an explicit 0 pass", money.itemMoneyProblem(prev, { purchasePrice: 0, askingPrice: 10 }) === undefined);
t("an old odd value that did not change does not block an unrelated edit", money.itemMoneyProblem(prev, { purchasePrice: 5, currentValue: -3, title: "x" }) === undefined);
t("blank (undefined) is fine", money.itemMoneyProblem(prev, { purchasePrice: undefined }) === undefined);

// ---- Quick Add drafts
t("Quick Add: explicit 0 cost and value are valid", money.draftMoneyProblem({ purchasePrice: "0", currentValue: "0" }) === undefined);
t("Quick Add: letters in cost are refused", /Cost/.test(money.draftMoneyProblem({ purchasePrice: "abc" }) || ""));
t("Quick Add: negative value is refused", /Value/.test(money.draftMoneyProblem({ currentValue: "-4" }) || ""));

// ---- auction prices
const A = money.validateAuctionPrices;
t("auction: blank start defaults to $1", A({ startingBid: "", reservePrice: "", buyItNow: "" }).startingBid === 1);
t("auction: start below $1 refused", A({ startingBid: "0", reservePrice: "", buyItNow: "" }).ok === false);
t("auction: negative start / reserve / BIN refused", !A({ startingBid: "-5", reservePrice: "", buyItNow: "" }).ok && !A({ startingBid: "5", reservePrice: "-1", buyItNow: "" }).ok && !A({ startingBid: "5", reservePrice: "", buyItNow: "-1" }).ok);
t("auction: letters / exponents refused", !A({ startingBid: "1e3", reservePrice: "", buyItNow: "" }).ok && !A({ startingBid: "5", reservePrice: "x", buyItNow: "" }).ok);
t("auction: BIN below reserve refused", !A({ startingBid: "5", reservePrice: "100", buyItNow: "50" }).ok);
t("auction: BIN below starting bid refused", !A({ startingBid: "20", reservePrice: "", buyItNow: "10" }).ok);
const okAuction = A({ startingBid: "10", reservePrice: "50", buyItNow: "100" });
t("auction: valid prices pass unchanged", okAuction.ok && okAuction.startingBid === 10 && okAuction.reservePrice === 50 && okAuction.buyItNowPrice === 100, okAuction);

// ---- the one sale rule
const O = sold.saleOutcome;
const base = { id: "a", title: "T", soldAt: 1 };
const noCost = O({ ...base, soldPrice: 80 });
t("unknown cost: profit is unknown (null), not the sale price", noCost.profit === null && noCost.cost === null && noCost.margin === null, noCost);
t("unknown cost is not a -100% loss either", noCost.margin === null);
const zeroCost = O({ ...base, soldPrice: 80, purchasePrice: 0 });
t("explicit $0 cost is KNOWN: profit = revenue", zeroCost.cost === 0 && zeroCost.profit === 80, zeroCost);
t("explicit $0 cost has no percentage margin", zeroCost.margin === null);
const withCost = O({ ...base, soldPrice: 100, purchasePrice: 40, purchaseShipping: 10 });
t("all-in cost: price + tax + shipping + fees", withCost.cost === 50 && withCost.profit === 50 && Math.round(withCost.margin) === 100, withCost);
const taxOnly = O({ ...base, soldPrice: 100, purchaseTax: 5 });
t("a recorded tax alone counts as a recorded cost", taxOnly.cost === 5 && taxOnly.profit === 95, taxOnly);
const zeroSale = O({ ...base, soldPrice: 0, purchasePrice: 20 });
t("an explicit $0 sale is a real $0 (loss of the cost)", zeroSale.revenue === 0 && zeroSale.profit === -20, zeroSale);
const ebay = O({ ...base, soldPrice: 100, purchasePrice: 20, soldPlatform: "eBay" });
t("estimated seller fees come off the profit on a known platform", ebay.fees > 0 && Math.abs(ebay.profit - (100 - 20 - ebay.fees)) < 1e-9, ebay);
const stats = sold.soldStats([{ ...base, id: "1", soldPrice: 100, purchasePrice: 40 }, { ...base, id: "2", soldPrice: 50 }]);
t("totals leave the unknown-cost sale out of profit and say so", stats.profitCount === 1 && stats.unknownCostCount === 1 && stats.totalProfit === 60 && stats.realizedRevenue === 150, stats);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
