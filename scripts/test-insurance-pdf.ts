// The single-item / Vault Insurance PDF: a sold item is a historical record (never counted as currently insured) and comparable sales say what each row is.
import assert from "node:assert/strict";
import { buildInsurancePdfHtml } from "../src/lib/insurancePdf";
import type { VaultItem } from "../src/lib/vaultModel";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) { try { fn(); passed++; console.log("PASS ", name); } catch (e) { failed++; console.log("FAIL ", name, (e as Error).message.slice(0, 300)); } }

const owned = { id: "o1", title: "Owned Card", universe: "SPORTS", status: "COLLECTION", purchasePrice: 120, currentValue: 180, createdAt: 1, comparables: [
  { source: "eBay", salePrice: 175, saleDate: "2026-10-02", condition: "PSA 8", kind: "sold" },
  { source: "Heritage", salePrice: 190, saleDate: "2026-09-18", condition: "PSA 8" },
  { source: "COMC", salePrice: 230, condition: "PSA 8", kind: "listed" },
] } as unknown as VaultItem;
const sold = { id: "s1", title: "Sold Card", universe: "SPORTS", status: "SOLD", soldPrice: 90, purchasePrice: 40, createdAt: 1 } as unknown as VaultItem;
const cover = (html: string) => html.slice(0, html.indexOf("page-break") > 0 ? html.indexOf('<div class="item-block') : html.length);
const countedValue = (html: string) => /Items Counted<\/div><div class="cover-stat-value">([^<]*)</.exec(html)?.[1];

test("a sold item alone: zero items counted, no cost or value totals, a sentence says it is not counted as insured", () => {
  const html = buildInsurancePdfHtml([sold], { includeComparables: true });
  assert.equal(countedValue(html), "0");
  assert.ok(/Nothing currently insured/.test(html));
  assert.ok(/sold item in this document is a historical record and is not counted as currently insured/.test(html));
  assert.ok(!/with a recorded cost<\/div>/.test(cover(html)), "no 'N of N with a recorded cost' for a sold-only document");
  assert.ok(/Sold: historical record, not part of the current inventory/.test(html), "the item itself is still printed and marked Sold");
});
test("an owned item alone is counted normally", () => {
  const html = buildInsurancePdfHtml([owned], {});
  assert.equal(countedValue(html), "1");
  assert.ok(/\$120/.test(cover(html)) && /\$180/.test(cover(html)));
  assert.ok(!/not counted as currently insured/.test(html));
});
test("a sold item next to an owned one: only the owned one is counted, the sold one is still printed", () => {
  const html = buildInsurancePdfHtml([owned, sold], {});
  assert.equal(countedValue(html), "1");
  assert.ok(/\$120/.test(cover(html)) && !/\$160/.test(cover(html)), "total cost is the owned item's $120, not $120 + $40");
  assert.ok(/Sold Card/.test(html) && /1 sold item in this document/.test(html));
});
test("comparable sales: sold rows say Sold, an asking price says For sale (asking price), a row with no kind is a sale", () => {
  const html = buildInsurancePdfHtml([owned], { includeComparables: true });
  assert.ok(/<th>Type<\/th>/.test(html));
  assert.ok(/eBay<\/td>\s*<td>\$175<\/td>\s*<td>Sold<\/td>/.test(html));
  assert.ok(/Heritage<\/td>\s*<td>\$190<\/td>\s*<td>Sold<\/td>/.test(html));
  assert.ok(/COMC<\/td>\s*<td>\$230<\/td>\s*<td>For sale \(asking price\)<\/td>/.test(html));
});
test("comparable sales are left out when switched off", () => {
  assert.ok(!/Comparable Sales<\/div>/.test(buildInsurancePdfHtml([owned], { includeComparables: false })));
});
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
