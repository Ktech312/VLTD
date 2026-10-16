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

/**
 * Value used in totals. Values are never auto-filled, so an item nobody has
 * priced yet counts at what was paid for it (a "ghost" value: shown in grey,
 * never saved). Without this, 1,000 un-priced items read as a $100K loss.
 */
export function totalsValue(item: VaultItem): { amount: number; isGhost: boolean } {
  const real = effectiveMarketValue(item);
  if (real > 0) return { amount: real, isGhost: false };
  return { amount: totalCost(item), isGhost: true };
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

export type ValueSummary = {
  /** Items counted. */
  itemCount: number;
  /** All-in cost of every counted item ("Invested"). */
  totalCost: number;
  /** Items with a real value entered. */
  pricedCount: number;
  /** Items counted at purchase price because they aren't priced yet. */
  ghostCount: number;
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
  let filledValue = 0;
  let pricedValue = 0;
  let pricedWithCostValue = 0;
  let pricedWithCostCost = 0;
  let pricedWithCostCount = 0;

  for (const item of items) {
    const cost = totalCost(item);
    const real = effectiveMarketValue(item);
    totalCostAll += cost;
    if (real > 0) {
      pricedCount += 1;
      pricedValue += real;
      filledValue += real;
      if (cost > 0) {
        pricedWithCostValue += real;
        pricedWithCostCost += cost;
        pricedWithCostCount += 1;
      }
    } else {
      filledValue += cost;
    }
  }

  const base = {
    itemCount: items.length,
    totalCost: totalCostAll,
    pricedCount,
    ghostCount: items.length - pricedCount,
  };

  const gain = pricedWithCostValue - pricedWithCostCost;
  return {
    ...base,
    totalValue: mode === "priced" ? pricedValue : filledValue,
    totalGain: gain,
    gainPct: pricedWithCostCost > 0 ? (gain / pricedWithCostCost) * 100 : null,
    costBase: pricedWithCostCost,
    gainItemCount: pricedWithCostCount,
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
