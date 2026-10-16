import type {
  ExhibitionLayoutType,
  Gallery,
} from "@/lib/galleryModel";
import type { VaultItem } from "@/lib/vaultModel";
import { activeItems, effectiveMarketValue, summarizeValues, totalCost as vaultTotalCost, totalsValue, type ValueMode } from "@/lib/vaultStats";

export type ValueSegment = {
  label: string;
  value: number;
  cost: number;
  count: number;
  /** Unrealized change in this segment: value minus cost over the items that have BOTH a real value and a known cost. */
  gain: number;
  /** The cost of those same items (what the segment's percentage change is measured against). */
  gainCost: number;
};

export type CollectionMetrics = {
  totalItems: number;
  totalCost: number;
  totalValue: number;
  delta: number;
  roi: number;
  universes: number;
  categories: number;
  topValueSegments: ValueSegment[];
  topSourceSegments: ValueSegment[];
  topItems: VaultItem[];
  recentItems: VaultItem[];
  maxSegmentValue: number;
  intelligence: {
    topPerformer?: VaultItem;
    biggestUnderwater?: VaultItem;
    highestValue?: VaultItem;
  };
};

export type GalleryMetrics = {
  totalItems: number;
  totalCost: number;
  totalValue: number;
  delta: number;
  roi: number;
  notesCount: number;
  notesCoverage: number;
  views: number;
  uniqueViewers: number;
  inviteCount: number;
  shareReady: boolean;
  topItems: VaultItem[];
  topSegments: ValueSegment[];
  maxSegmentValue: number;
  layoutType: ExhibitionLayoutType;
  sectionCount: number;
  featuredWorkCount: number;
  sectionAssignedCount: number;
  sectionCoverage: number;
};

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function optionalRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

// One rule for cost and value, shared with lib/vaultStats.ts (these used to
// check value fields in a different order, so two screens could disagree).
export function itemTotalCost(item: VaultItem) {
  return safeNumber(vaultTotalCost(item));
}

/** Real (entered/priced) value; 0 = not priced yet. */
export function itemCurrentValue(item: VaultItem) {
  return effectiveMarketValue(item);
}

/** Gain on a priced item. Un-priced items have no gain or loss yet (not a loss of everything paid). */
export function itemProfit(item: VaultItem) {
  const value = itemCurrentValue(item);
  return value > 0 ? value - itemTotalCost(item) : 0;
}

function makeSegments(
  items: VaultItem[],
  keyGetter: (item: VaultItem) => string,
  limit = 5,
  valueOf: (item: VaultItem) => number = itemCurrentValue
): ValueSegment[] {
  const map = new Map<string, ValueSegment>();

  for (const item of items) {
    const key = safeString(keyGetter(item)) || "Uncategorized";
    const existing = map.get(key) ?? {
      label: key,
      value: 0,
      cost: 0,
      count: 0,
      gain: 0,
      gainCost: 0,
    };

    existing.value += valueOf(item);
    existing.cost += itemTotalCost(item);
    existing.count += 1;
    const realValue = itemCurrentValue(item);
    const knownCost = itemTotalCost(item);
    if (realValue > 0 && knownCost > 0) {
      existing.gain += realValue - knownCost;
      existing.gainCost += knownCost;
    }

    map.set(key, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    })
    .slice(0, limit);
}

export function getCollectionMetrics(items: VaultItem[], mode: ValueMode = "fill"): CollectionMetrics {
  // Collection metrics describe what you currently own, so sold items are
  // excluded — otherwise Insights and the Dashboard report a bigger vault
  // than the Vault page does. See lib/vaultStats.ts for the shared rule.
  const safeItems = activeItems(safeArray(items));

  // Totals and ROI come from the shared summary so Curator Strength, Insights
  // and Home always show the same numbers. In "fill" mode un-priced items
  // count at purchase price, so they read as flat instead of a total loss.
  const summary = summarizeValues(safeItems, mode);
  const totalItems = safeItems.length;
  const totalCost = summary.totalCost;
  const totalValue = summary.totalValue;
  const delta = summary.totalGain;
  const roi = summary.gainPct ?? 0;
  const segmentValue = mode === "fill" ? (item: VaultItem) => totalsValue(item).amount : itemCurrentValue;

  const universes = new Set(
    safeItems.map((item) => safeString(item.universe)).filter(Boolean)
  ).size;

  const categories = new Set(
    safeItems
      .map((item) =>
        safeString(item.categoryLabel ?? item.category ?? item.subcategoryLabel ?? "")
      )
      .filter(Boolean)
  ).size;

  // Keep every category. Callers group the tail into "Other" themselves, and
  // the default limit of 5 silently dropped the rest — which made the Insights
  // breakdown total less than the vault total it sat next to.
  const topValueSegments = makeSegments(
    safeItems,
    (item) => String(item.categoryLabel ?? item.category ?? item.universe ?? "Uncategorized"),
    Number.MAX_SAFE_INTEGER,
    segmentValue
  );

  const topSourceSegments = makeSegments(
    safeItems,
    (item) => String(item.purchaseSource ?? "Unknown Source"),
    5,
    segmentValue
  );

  // Ranked by the same value the totals use (un-priced = what was paid in "fill").
  const topItems = [...safeItems]
    .sort((a, b) => segmentValue(b) - segmentValue(a))
    .slice(0, 6);

  const recentItems = [...safeItems]
    .sort((a, b) => safeNumber(b.createdAt) - safeNumber(a.createdAt))
    .slice(0, 6);

  const maxSegmentValue = topValueSegments[0]?.value ?? 0;

  let topPerformer: VaultItem | undefined;
  let biggestUnderwater: VaultItem | undefined;
  let highestValue: VaultItem | undefined;

  for (const item of safeItems) {
    if (!topPerformer || itemProfit(item) > itemProfit(topPerformer)) {
      topPerformer = item;
    }

    if (!biggestUnderwater || itemProfit(item) < itemProfit(biggestUnderwater)) {
      biggestUnderwater = item;
    }

    if (!highestValue || itemCurrentValue(item) > itemCurrentValue(highestValue)) {
      highestValue = item;
    }
  }

  return {
    totalItems,
    totalCost,
    totalValue,
    delta,
    roi,
    universes,
    categories,
    topValueSegments,
    topSourceSegments,
    topItems,
    recentItems,
    maxSegmentValue,
    intelligence: {
      topPerformer,
      biggestUnderwater,
      highestValue,
    },
  };
}

export function getGalleryMetrics(gallery: Gallery, allItems: VaultItem[]): GalleryMetrics {
  const itemMap = new Map(safeArray(allItems).map((item) => [item.id, item]));

  const galleryItemIds = safeArray(gallery.itemIds).filter(Boolean);

  const items = galleryItemIds
    .map((id) => itemMap.get(id))
    .filter(Boolean) as VaultItem[];

  const totalItems = items.length;
  const totalCost = items.reduce((sum, item) => sum + itemTotalCost(item), 0);
  const totalValue = items.reduce((sum, item) => sum + itemCurrentValue(item), 0);
  const delta = totalValue - totalCost;
  const roi = totalCost > 0 ? (delta / totalCost) * 100 : 0;

  const notesCount = safeArray(gallery.itemNotes).filter((note) => safeString(optionalRecord(note).note).length > 0).length;

  const notesCoverage = totalItems > 0 ? (notesCount / totalItems) * 100 : 0;
  const views = safeNumber(gallery.analytics?.views);
  const uniqueViewers = safeArray(gallery.analytics?.uniqueViewKeys).length;

  const inviteCount = safeArray(gallery.share?.inviteTokens).filter((token) => {
    const invite = optionalRecord(token);
    if (!safeString(invite.token)) return false;
    if (invite.disabled) return false;
    return true;
  }).length;

  const shareReady = Boolean(safeString(gallery.share?.publicToken)) || inviteCount > 0;

  const topItems = [...items]
    .sort((a, b) => itemCurrentValue(b) - itemCurrentValue(a))
    .slice(0, 5);

  const topSegments = makeSegments(
    items,
    (item) => String(item.categoryLabel ?? item.category ?? item.universe ?? "Uncategorized")
  );

  const maxSegmentValue = topSegments[0]?.value ?? 0;

  const sections = safeArray(gallery.sections);
  const layoutType: ExhibitionLayoutType =
    gallery.exhibitionLayout?.type ?? "GRID";

  const sectionCount = sections.length;
  const featuredWorkCount = sections.filter((section) => !!section?.featuredItemId).length;

  const sectionAssignedIds = new Set<string>();
  for (const section of sections) {
    const itemIds = safeArray(section?.itemIds);
    for (const itemId of itemIds) {
      const cleanId = safeString(itemId);
      if (cleanId) sectionAssignedIds.add(cleanId);
    }
  }

  const sectionAssignedCount = Array.from(sectionAssignedIds).filter((id) =>
    galleryItemIds.includes(id)
  ).length;

  const sectionCoverage = totalItems > 0 ? (sectionAssignedCount / totalItems) * 100 : 0;

  return {
    totalItems,
    totalCost,
    totalValue,
    delta,
    roi,
    notesCount,
    notesCoverage,
    views,
    uniqueViewers,
    inviteCount,
    shareReady,
    topItems,
    topSegments,
    maxSegmentValue,
    layoutType,
    sectionCount,
    featuredWorkCount,
    sectionAssignedCount,
    sectionCoverage,
  };
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export type NetProceedsResult = {
  totalCurrentValue: number;
  totalCostBasis: number;
  estimatedFees: number;
  estimatedShipping: number;
  netProceeds: number;
  netGainLoss: number;
  netRoi: number;
  itemCount: number;
};

// Whole-portfolio estimate: the main published percentage per marketplace (checked October 2026; see the Cost to Sell
// panel on an item for the exact tables), plus the usual flat charge per order.
const PLATFORM_FEE_RATES: Record<string, number> = {
  ebay: 0.1325,
  mercari: 0.1,
  whatnot: 0.109,
  pwcc: 0.06,
  discogs: 0.119,
  custom: 0.1325,
};
const PLATFORM_FEE_PER_ORDER: Record<string, number> = {
  ebay: 0.4,
  mercari: 0,
  whatnot: 0.3,
  pwcc: 0,
  discogs: 0.3,
  custom: 0.4,
};

const AVG_SHIPPING_PER_ITEM = 5;

export function getNetProceedsEstimate(
  items: VaultItem[],
  platform: keyof typeof PLATFORM_FEE_RATES = "ebay"
): NetProceedsResult {
  const safeItems = safeArray(items).filter((item) => item.status !== "SOLD" && item.status !== "WISHLIST");
  const feeRate = PLATFORM_FEE_RATES[platform] ?? PLATFORM_FEE_RATES.ebay;

  const totalCurrentValue = safeItems.reduce((sum, item) => sum + itemCurrentValue(item), 0);
  const totalCostBasis = safeItems.reduce((sum, item) => sum + itemTotalCost(item), 0);
  const estimatedFees = totalCurrentValue * feeRate + safeItems.length * (PLATFORM_FEE_PER_ORDER[platform] ?? 0);
  const estimatedShipping = safeItems.length * AVG_SHIPPING_PER_ITEM;
  const netProceeds = totalCurrentValue - estimatedFees - estimatedShipping;
  const netGainLoss = netProceeds - totalCostBasis;
  const netRoi = totalCostBasis > 0 ? (netGainLoss / totalCostBasis) * 100 : 0;

  return {
    totalCurrentValue,
    totalCostBasis,
    estimatedFees,
    estimatedShipping,
    netProceeds,
    netGainLoss,
    netRoi,
    itemCount: safeItems.length,
  };
}
