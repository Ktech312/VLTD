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

/** Items you currently own (everything except sold). */
export function activeItems(items: VaultItem[]): VaultItem[] {
  return items.filter((item) => !isSoldItem(item));
}

/** What one item is worth today. Estimated value wins, then current value. */
export function effectiveMarketValue(item: VaultItem): number {
  if (typeof item.estimatedValue === "number" && Number.isFinite(item.estimatedValue)) {
    return item.estimatedValue;
  }
  if (typeof item.currentValue === "number" && Number.isFinite(item.currentValue)) {
    return item.currentValue;
  }
  return 0;
}

/** All-in cost of one item: price plus tax, shipping and fees. */
export function totalCost(item: VaultItem): number {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

export type VaultStats = {
  /** Items currently owned (sold excluded). */
  itemCount: number;
  /** Market value of items currently owned. */
  totalValue: number;
  /** All-in cost of items currently owned. */
  totalCost: number;
  /** totalValue - totalCost. */
  totalGain: number;
  /** Gain as a percentage of cost. 0 when nothing was spent. */
  gainPct: number;
  /** Sold items, reported separately rather than folded into the totals. */
  soldCount: number;
};

/**
 * Compute vault totals from a raw item list. Pass the full list — this
 * excludes sold items for you, so every screen agrees.
 */
export function computeVaultStats(items: VaultItem[]): VaultStats {
  const owned = activeItems(items);
  const totalValue = owned.reduce((sum, item) => sum + effectiveMarketValue(item), 0);
  const cost = owned.reduce((sum, item) => sum + totalCost(item), 0);
  const totalGain = totalValue - cost;

  return {
    itemCount: owned.length,
    totalValue,
    totalCost: cost,
    totalGain,
    gainPct: cost > 0 ? (totalGain / cost) * 100 : 0,
    soldCount: items.length - owned.length,
  };
}
