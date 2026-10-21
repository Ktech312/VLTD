// ONE set of rules for every Insurance document: the inventory, the policy packet (screen and print), the per-item sheet, the reports and the Vault PDF.
//
//   WHO IS COUNTED   items you currently own: not sold, not a supply (boxes, cases), not a wishlist entry, and not excluded by you.
//   COST             total acquisition cost = purchase price + tax + shipping + fees (the same all-in cost Home shows). Nothing recorded stays blank ("-"),
//                    an explicit $0 is a real $0.
//   ESTIMATED VALUE  only a value somebody entered or looked up (an explicit $0 is valid). An item with none shows "No estimate": its purchase cost is
//                    NEVER presented as an estimated or insured value.
//   EXCLUSIONS       your own "leave this out" choices follow the account (src/lib/insuranceExclusions.ts); when the account cannot hold them yet the documents say they are on this device only.
//
// Pure functions so the rules are tested once and cannot drift between pages.
import type { VaultItem } from "./vaultModel";
import { effectiveMarketValue, hasExplicitValue, hasRecordedCost, isSoldItem, isSupplyItem, totalCost } from "./vaultStats";

export type InsuranceScope<T extends VaultItem = VaultItem> = {
  /** Owned items that follow the rules (what the inventory lists, including ones you excluded so you can include them again). */
  eligible: T[];
  /** What every total, the packet and the PDFs use: eligible minus your exclusions. */
  included: T[];
  counts: { sold: number; supplies: number; wishlist: number; excludedByYou: number };
};

export function insuranceScope<T extends VaultItem>(items: T[], excluded: Set<string>): InsuranceScope<T> {
  const counts = { sold: 0, supplies: 0, wishlist: 0, excludedByYou: 0 };
  const eligible: T[] = [];
  for (const item of items) {
    if (isSupplyItem(item)) { counts.supplies++; continue; }
    if (isSoldItem(item)) { counts.sold++; continue; }
    if (item.status === "WISHLIST") { counts.wishlist++; continue; }
    eligible.push(item);
  }
  const included = eligible.filter((item) => !excluded.has(String(item.id)));
  counts.excludedByYou = eligible.length - included.length;
  return { eligible, included, counts };
}

/** The one sentence that says what is NOT counted and why. null when everything is counted. */
export function notCountedLine(scope: { counts: InsuranceScope["counts"] }, where: "device" | "account" = "device"): string | null {
  const c = scope.counts;
  const parts: string[] = [];
  if (c.sold > 0) parts.push(`${c.sold} sold`);
  if (c.supplies > 0) parts.push(`${c.supplies} supply item${c.supplies === 1 ? "" : "s"} (boxes, cases)`);
  if (c.wishlist > 0) parts.push(`${c.wishlist} wishlist item${c.wishlist === 1 ? "" : "s"}`);
  if (c.excludedByYou > 0) parts.push(`${c.excludedByYou} excluded by you${where === "device" ? " on this device" : ""}`);
  return parts.length ? `Not counted: ${parts.join(", ")}.` : null;
}

export const EXCLUSIONS_ARE_DEVICE_ONLY = "Exclusions are saved on this device only. They do not follow your account.";
export const COST_NOTE = "Cost = purchase price + tax + shipping + fees. A dash means no cost was recorded.";
export const COST_LABEL = "Cost (all-in)";
export const ESTIMATE_LABEL = "Estimated value";

/** Total acquisition cost, or null when nothing was recorded (blank is not $0; an explicit $0 is $0). */
export function insuranceCost(item: VaultItem): number | null {
  return hasRecordedCost(item) ? totalCost(item) : null;
}

/** A value somebody entered or looked up (explicit $0 included), or null: "No estimate". Never the purchase cost. */
export function insuranceEstimate(item: VaultItem): number | null {
  return hasExplicitValue(item) ? effectiveMarketValue(item) : null;
}

export type InsuranceTotals = {
  count: number;
  cost: number;
  costRecorded: number;
  costNotRecorded: number;
  estimate: number;
  estimated: number;
  noEstimate: number;
  /** Acquisition cost of the items that have no estimate (shown for reference, never added to the estimate). */
  costOfUnestimated: number;
};

export function insuranceTotals(items: VaultItem[]): InsuranceTotals {
  const t: InsuranceTotals = { count: items.length, cost: 0, costRecorded: 0, costNotRecorded: 0, estimate: 0, estimated: 0, noEstimate: 0, costOfUnestimated: 0 };
  for (const item of items) {
    const cost = insuranceCost(item);
    if (cost === null) t.costNotRecorded++;
    else { t.cost += cost; t.costRecorded++; }
    const est = insuranceEstimate(item);
    if (est === null) { t.noEstimate++; t.costOfUnestimated += cost ?? 0; }
    else { t.estimate += est; t.estimated++; }
  }
  return t;
}

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Number.isFinite(n) ? n : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
export const fmtCost = (n: number | null) => (n === null ? "-" : money(n));
export const fmtEstimate = (n: number | null) => (n === null ? "No estimate" : money(n));

/** "Total acquisition cost $X (N items; M with no cost recorded) • Estimated value $Y (K valued; J with no estimate)". */
export function totalsSentence(t: InsuranceTotals): string {
  const cost = `Total cost ${money(t.cost)} (${t.costRecorded} of ${t.count} with a recorded cost)`;
  const est = `Estimated value ${money(t.estimate)} (${t.estimated} of ${t.count} have an estimate)`;
  return `${cost} • ${est}`;
}

/** Shown under a document when some items have no estimate: their cost is not counted as value. */
export function noEstimateNote(t: InsuranceTotals): string | null {
  return t.noEstimate > 0
    ? `${t.noEstimate} item${t.noEstimate === 1 ? " has" : "s have"} no estimated value. Their acquisition cost (${money(t.costOfUnestimated)}) is shown in the Cost column for reference and is not counted as value.`
    : null;
}
