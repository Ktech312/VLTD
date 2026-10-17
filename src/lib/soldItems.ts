// Sold items and realized-sales maths, shared by the Sold page (/vault/sold) and Home so the two always agree.
import { getStoredActiveProfileId } from "@/lib/auth";
import { estimateSaleFees } from "@/lib/sellerFees";
import { resolveCategoryLabel } from "@/lib/taxonomy";
import { getPrimaryImageUrl, loadItems, type VaultItem } from "@/lib/vaultModel";

export const SALES_KEY = "vltd_sales_history";

export type SoldItem = {
  id: string;
  title: string;
  subtitle?: string;
  number?: string;
  grade?: string;
  universe?: string;
  category?: string;
  categoryLabel?: string;
  customCategoryLabel?: string;
  subcategoryLabel?: string;
  imageFrontUrl?: string;
  purchasePrice?: number;
  purchaseTax?: number;
  purchaseShipping?: number;
  purchaseFees?: number;
  soldPrice: number;
  soldAt: number;
  itemId?: string;
  soldPlatform?: string;
  /** Older local sale records (For Sale page) kept the platform under this name. */
  salePlatform?: string;
};

export type SoldStats = {
  count: number;
  realizedRevenue: number;
  /** Purchase cost of the sales whose cost is known. */
  totalCost: number;
  /** Profit of the sales whose cost is known (a sale with no recorded cost is left out, not counted as pure profit). */
  totalProfit: number;
  /** How many sales have a recorded cost (an explicit 0 counts). */
  profitCount: number;
  /** How many sales have no recorded cost, so their profit is unknown. */
  unknownCostCount: number;
};

/** True when a purchase price was recorded (an explicit 0 counts). A sale without one has an unknown profit, not a profit equal to its price. */
export function hasKnownCost(i: SoldItem) {
  return i.purchasePrice !== undefined && i.purchasePrice !== null && Number.isFinite(Number(i.purchasePrice));
}

export function cost(i: SoldItem) {
  return (
    Number(i.purchasePrice ?? 0) +
    Number(i.purchaseTax ?? 0) +
    Number(i.purchaseShipping ?? 0) +
    Number(i.purchaseFees ?? 0)
  );
}

/** Estimated seller fees for where it sold; 0 when the platform is unknown. */
export function saleFees(i: SoldItem) {
  return estimateSaleFees(i.soldPlatform, Number(i.soldPrice ?? 0), resolveCategoryLabel(i), i.subcategoryLabel);
}

/** Profit after purchase costs and estimated seller fees. */
export function profitOf(i: SoldItem) {
  return Number(i.soldPrice ?? 0) - cost(i) - saleFees(i);
}

export function readSales(): SoldItem[] {
  if (typeof window === "undefined") return [];
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
    if (!Array.isArray(data)) return [];
    // This older shared list holds sales from every profile: keep only the active profile's.
    const activeProfileId = getStoredActiveProfileId();
    return (data as (SoldItem & { profile_id?: string })[]).filter(
      (sale) => !activeProfileId || !sale.profile_id || sale.profile_id === activeProfileId
    );
  } catch {
    return [];
  }
}

export function writeSales(items: SoldItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SALES_KEY, JSON.stringify(items));
  } catch {
    // Sales history is a compatibility cache. Cloud item state remains primary.
  }
}

export function removeSaleRecord(itemId: string) {
  writeSales(
    readSales().filter((sale) => String(sale.id) !== String(itemId) && String(sale.itemId ?? "") !== String(itemId))
  );
}

function soldItemFromVaultItem(item: VaultItem): SoldItem | null {
  if (item.status !== "SOLD" && !item.soldAt && item.soldPrice === undefined) return null;

  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    number: item.number,
    grade: item.grade,
    universe: item.universe,
    category: item.category,
    categoryLabel: item.categoryLabel,
    customCategoryLabel: item.customCategoryLabel,
    subcategoryLabel: item.subcategoryLabel,
    imageFrontUrl: getPrimaryImageUrl(item) || item.imageFrontUrl,
    purchasePrice: item.purchasePrice,
    purchaseTax: item.purchaseTax,
    purchaseShipping: item.purchaseShipping,
    purchaseFees: item.purchaseFees,
    soldPrice: Number(item.soldPrice ?? 0),
    soldAt: Number(item.soldAt ?? Date.now()),
    soldPlatform: item.soldPlatform,
  };
}

export function buildSoldItems(items: VaultItem[] = loadItems()) {
  const byId = new Map<string, SoldItem>();

  for (const item of items) {
    const sold = soldItemFromVaultItem(item);
    if (sold) byId.set(String(sold.id), sold);
  }

  for (const sale of readSales()) {
    const existing = byId.get(String(sale.id));
    if (!existing) byId.set(String(sale.id), { ...sale, soldPlatform: sale.soldPlatform ?? sale.salePlatform });
    // Platform typed before it was saved on the item lives only in this older list.
    else if (!existing.soldPlatform && sale.salePlatform) existing.soldPlatform = sale.salePlatform;
  }

  return Array.from(byId.values()).sort((a, b) => Number(b.soldAt) - Number(a.soldAt));
}

export function soldStats(items: SoldItem[]): SoldStats {
  return items.reduce(
    (stats, item) => {
      stats.count += 1;
      stats.realizedRevenue += Number(item.soldPrice ?? 0);
      if (hasKnownCost(item)) {
        stats.totalCost += cost(item);
        stats.totalProfit += profitOf(item);
        stats.profitCount += 1;
      } else {
        stats.unknownCostCount += 1;
      }
      return stats;
    },
    { count: 0, realizedRevenue: 0, totalCost: 0, totalProfit: 0, profitCount: 0, unknownCostCount: 0 }
  );
}


