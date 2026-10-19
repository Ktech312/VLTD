import type { VaultItem } from "@/lib/vaultModel";

// ── Single source of truth for "what is my vault worth / how many items" ──
//
// These numbers were previously computed independently on the Vault, the
// Dashboard, and Insights, with different rules — so the same collection
// reported 134 items / $19,482 on one screen and 139 items / $20,822 on
// another. The difference was sold items: the Vault excluded them, the others
// counted them as if you still owned them.
//
// Rule: a vault total describes what you CURRENTLY OWN. Sold items are
// excluded from counts and value. Anything that wants sold items (sales
// history, realised gains) asks for them explicitly.

/** Sold detection, matching the Vault's long-standing rule. */
export function isSoldItem(item: VaultItem): boolean {
  return item.status === "SOLD" || Boolean(item.soldAt) || item.soldPrice !== undefined;
}

/** Category label for non-collectible inventory (boxes, cases, sleeves). */
export const SUPPLIES_CATEGORY = "Supplies & Display";

/**
 * Non-collectible inventory: owned to store or show the collection, not part
 * of it. These stay visible in the Vault but are left out of value totals,
 * insurance and public pages. Works on any item-shaped object.
 */
export function isSupplyItem(item: { universe?: unknown; categoryLabel?: unknown; category?: unknown }): boolean {
  if (String(item.universe ?? "").toUpperCase() !== "MISC") return false;
  const label = String(item.categoryLabel ?? item.category ?? "").trim();
  return label === SUPPLIES_CATEGORY;
}

/** The collection proper: everything that is not a supply. */
export function collectibleItems<T extends { universe?: unknown; categoryLabel?: unknown; category?: unknown }>(
  items: T[]
): T[] {
  return items.filter((item) => !isSupplyItem(item));
}

/** Items you currently own (everything except sold, wishlist and supply items). */
export function activeItems(items: VaultItem[]): VaultItem[] {
  return items.filter((item) => !isSoldItem(item) && !isSupplyItem(item) && item.status !== "WISHLIST");
}

/**
 * What one item is worth today, as the Curator entered or priced it:
 * comparable median, then estimated value, then current value, then last
 * comp -- the first one above zero. 0 = not priced yet. This is the only
 * "real value" rule; portfolioMetrics.itemCurrentValue delegates here.
 */
export function effectiveMarketValue(item: VaultItem): number {
  for (const v of [item.valueMedian, item.estimatedValue, item.currentValue, item.lastCompValue]) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

/** An explicit valuation: a value above zero from any source, or a valuation of exactly $0 that someone typed (zero is a valid value). */
export function hasExplicitValue(item: VaultItem): boolean {
  if (effectiveMarketValue(item) > 0) return true;
  return typeof item.currentValue === "number" && item.currentValue === 0;
}

/** A purchase cost was recorded (price, tax, shipping or fees), including a recorded $0. Not recorded = nothing entered. */
export function hasRecordedCost(item: VaultItem): boolean {
  return [item.purchasePrice, item.purchaseTax, item.purchaseShipping, item.purchaseFees].some((v) => typeof v === "number" && Number.isFinite(v));
}

/**
 * THE VALUE RULE (one place, used by every total and label):
 *   explicit    an explicit valuation -> use it (an explicit $0 is valid)
 *   purchase    no valuation, but a recorded total purchase cost -> counted "At purchase cost" (shown, never saved into a valuation field)
 *   missing     neither -> "Missing value": counted as nothing and EXCLUDED from the known total, and the excluded count is disclosed
 * "Needs valuation" (no explicit valuation: purchase or missing) is a different statement from "Missing value" (no valuation AND no cost).
 * Missing information never produces a financial loss: a missing value is left out of every gain, it is not read as $0.
 */
export type ValueBasis = "explicit" | "purchase" | "missing";
export function valueBasis(item: VaultItem): { basis: ValueBasis; amount: number } {
  if (hasExplicitValue(item)) return { basis: "explicit", amount: effectiveMarketValue(item) };
  if (hasRecordedCost(item)) return { basis: "purchase", amount: totalCost(item) };
  return { basis: "missing", amount: 0 };
}

/**
 * Value used in totals (see the rule above). Values are never auto-filled: a purchase-cost amount is a "ghost" (grey, never saved).
 * Without it, 1,000 un-priced items read as a $100K loss.
 */
export function totalsValue(item: VaultItem): { amount: number; isGhost: boolean; basis: ValueBasis } {
  const v = valueBasis(item);
  return { amount: v.amount, isGhost: v.basis === "purchase", basis: v.basis };
}

/** "fill" = un-priced items count at purchase price (default). "priced" = only items with a real value. */
export type ValueMode = "fill" | "priced";

export const VALUE_MODE_LABEL: Record<ValueMode, string> = {
  fill: "Using purchase price for unpriced items",
  priced: "Priced items only",
};

/**
 * Insurance / appraisal value. Same as totals, but the caller must mark
 * purchase-based amounts (asterisk + "Based on purchase price" footnote) so a
 * packet never presents an unchecked number as a market value.
 */
export function insuranceValue(item: VaultItem): { amount: number; purchaseBased: boolean } {
  const v = totalsValue(item);
  return { amount: v.amount, purchaseBased: v.isGhost && v.amount > 0 };
}

export const PURCHASE_BASED_NOTE = "* Based on purchase price. This item has not been priced yet.";

/** All-in cost of one item: price plus tax, shipping and fees. */
export function totalCost(item: VaultItem): number {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

// ---- Unrealized change: ONE rule, used by every page that shows a gain or a return ----------------------------------------------
// An item is measured only when it has BOTH a value someone entered or looked up AND a recorded cost. Everything else is left out
// of the figure and counted, with the reason, so a page can say what it did not measure:
//   no-value   no value yet (never counted as a total loss of what was paid)
//   no-cost    a value, but no cost recorded (the whole value would otherwise look like profit)
//   zero-cost  a value, and the price was entered as $0 (a known zero is not an unknown, but a return on $0 has no percentage, so
//              it is reported on its own line and not folded into the measured cost)
export type GainStatus = "eligible" | "no-value" | "no-cost" | "zero-cost";

export function gainStatus(item: VaultItem): GainStatus {
  if (!hasExplicitValue(item)) return "no-value";
  if (totalCost(item) > 0) return "eligible";
  return typeof item.purchasePrice === "number" && Number.isFinite(item.purchasePrice) ? "zero-cost" : "no-cost";
}

/** The unrealized change of one item, or null when it is not measurable (see gainStatus). */
export function itemGain(item: VaultItem): { gain: number; pct: number; cost: number } | null {
  if (gainStatus(item) !== "eligible") return null;
  const cost = totalCost(item);
  const gain = effectiveMarketValue(item) - cost;
  return { gain, pct: (gain / cost) * 100, cost };
}

export type GainSummary = {
  /** Value minus cost over the measured items. */
  gain: number;
  /** As a percentage of the measured items' cost; null when nothing was measured. */
  gainPct: number | null;
  /** The cost of the measured items. */
  costBasis: number;
  /** How many items were measured, and how many were looked at. */
  eligibleCount: number;
  totalCount: number;
  /** Items left out, by reason. */
  noValueCount: number;
  noCostCount: number;
  zeroCostCount: number;
};

export function summarizeGain(items: VaultItem[]): GainSummary {
  let gain = 0;
  let costBasis = 0;
  let eligibleCount = 0;
  let noValueCount = 0;
  let noCostCount = 0;
  let zeroCostCount = 0;
  for (const item of items) {
    const status = gainStatus(item);
    if (status === "eligible") {
      const cost = totalCost(item);
      gain += effectiveMarketValue(item) - cost;
      costBasis += cost;
      eligibleCount += 1;
    } else if (status === "no-value") noValueCount += 1;
    else if (status === "no-cost") noCostCount += 1;
    else zeroCostCount += 1;
  }
  return { gain, gainPct: costBasis > 0 ? (gain / costBasis) * 100 : null, costBasis, eligibleCount, totalCount: items.length, noValueCount, noCostCount, zeroCostCount };
}

/** What a figure did not measure, in plain words ("2 without a cost, 3 without a value"); empty when everything was measured. */
export function describeGainExclusions(summary: Pick<GainSummary, "noValueCount" | "noCostCount" | "zeroCostCount">): string {
  const parts: string[] = [];
  if (summary.noCostCount > 0) parts.push(`${summary.noCostCount} without a recorded cost`);
  if (summary.zeroCostCount > 0) parts.push(`${summary.zeroCostCount} bought for $0`);
  if (summary.noValueCount > 0) parts.push(`${summary.noValueCount} without a value`);
  return parts.join(", ");
}

export type ValueSummary = {
  /** Items counted. */
  itemCount: number;
  /** All-in cost of every counted item ("Invested"). */
  totalCost: number;
  /** Items with a real value entered. */
  pricedCount: number;
  /** Items counted "At purchase cost" because they have no valuation but a recorded cost. */
  ghostCount: number;
  /** Items with neither a valuation nor a recorded cost: "Missing value", left out of the total and disclosed. */
  missingCount: number;
  /** Total value for the chosen mode. */
  totalValue: number;
  /** Unrealized change: value minus cost over the items that have BOTH a real value and a known cost. Never depends on the mode. */
  totalGain: number;
  /** Gain as % of the cost base. null = nothing to measure against (hide it). */
  gainPct: number | null;
  /** The cost of those eligible items (what gainPct is measured against). */
  costBase: number;
  /** How many items the gain is measured over ("on 6 items"). */
  gainItemCount: number;
  /** Items the gain left out, by reason (see gainStatus). */
  gainExcluded: { noValue: number; noCost: number; zeroCost: number };
};

/**
 * Totals for an already-chosen set of items (callers decide sold/supplies).
 *
 * The mode only changes the TOTAL VALUE:
 *   fill (default): every item counts; un-priced ones at purchase price.
 *   priced: only items with a real value.
 * The unrealized change (gain, %, cost base, item count) is the same in both modes: only items that have a real value AND a
 * purchase price are measured. An un-priced item has no gain to report, and an item entered as $0 paid would otherwise turn
 * one comic into a +9,000% "return".
 */
export function summarizeValues(items: VaultItem[], mode: ValueMode = "fill"): ValueSummary {
  let totalCostAll = 0;
  let pricedCount = 0;
  let purchaseCount = 0;
  let missingCount = 0;
  let filledValue = 0;
  let pricedValue = 0;

  for (const item of items) {
    totalCostAll += totalCost(item);
    const v = valueBasis(item);
    if (v.basis === "explicit") {
      pricedCount += 1;
      pricedValue += v.amount;
      filledValue += v.amount;
    } else if (v.basis === "purchase") {
      purchaseCount += 1;
      filledValue += v.amount;
    } else {
      missingCount += 1;
    }
  }

  const g = summarizeGain(items);
  return {
    itemCount: items.length,
    totalCost: totalCostAll,
    pricedCount,
    ghostCount: purchaseCount,
    missingCount,
    totalValue: mode === "priced" ? pricedValue : filledValue,
    totalGain: g.gain,
    gainPct: g.gainPct,
    costBase: g.costBasis,
    gainItemCount: g.eligibleCount,
    gainExcluded: { noValue: g.noValueCount, noCost: g.noCostCount, zeroCost: g.zeroCostCount },
  };
}

export type VaultStats = ValueSummary & {
  /** Sold / wishlist / supply items left out of the totals. */
  soldCount: number;
};

/**
 * Totals for what you currently own. Pass the full list — sold, wishlist and
 * supply items are excluded for you, so every screen agrees.
 */
export function computeVaultStats(items: VaultItem[], mode: ValueMode = "fill"): VaultStats {
  const owned = activeItems(items);
  return { ...summarizeValues(owned, mode), soldCount: items.length - owned.length };
}

// Remembered per device: which way the Curator likes to see totals.
const VALUE_MODE_KEY = "vltd_value_mode_v1";

export function readValueMode(): ValueMode {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(VALUE_MODE_KEY) === "priced" ? "priced" : "fill";
  } catch {
    return "fill";
  }
}

export function writeValueMode(mode: ValueMode) {
  try {
    window.localStorage.setItem(VALUE_MODE_KEY, mode);
    window.dispatchEvent(new Event("vltd:value-mode"));
  } catch {
    /* preference only */
  }
}
