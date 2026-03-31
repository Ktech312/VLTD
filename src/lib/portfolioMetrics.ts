import type {
  ExhibitionLayoutType,
  Gallery,
} from "@/lib/galleryModel";
import type { VaultItem } from "@/lib/vaultModel";

export type ValueSegment = {
  label: string;
  value: number;
  cost: number;
  count: number;
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

export function itemTotalCost(item: VaultItem) {
  return (
    safeNumber(item.purchasePrice) +
    safeNumber(item.purchaseTax) +
    safeNumber(item.purchaseShipping) +
    safeNumber(item.purchaseFees)
  );
}

export function itemCurrentValue(item: VaultItem) {
  return safeNumber(item.currentValue);
}

export function itemProfit(item: VaultItem) {
  return itemCurrentValue(item) - itemTotalCost(item);
}

function makeSegments(
  items: VaultItem[],
  keyGetter: (item: VaultItem) => string,
  limit = 5
): ValueSegment[] {
  const map = new Map<string, ValueSegment>();

  for (const item of items) {
    const key = safeString(keyGetter(item)) || "Uncategorized";
    const existing = map.get(key) ?? {
      label: key,
      value: 0,
      cost: 0,
      count: 0,
    };

    existing.value += itemCurrentValue(item);
    existing.cost += itemTotalCost(item);
    existing.count += 1;

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

export function getCollectionMetrics(items: VaultItem[]): CollectionMetrics {
  const safeItems = safeArray(items);

  const totalItems = safeItems.length;
  const totalCost = safeItems.reduce((sum, item) => sum + itemTotalCost(item), 0);
  const totalValue = safeItems.reduce((sum, item) => sum + itemCurrentValue(item), 0);
  const delta = totalValue - totalCost;
  const roi = totalCost > 0 ? (delta / totalCost) * 100 : 0;

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

  const topValueSegments = makeSegments(
    safeItems,
    (item) => String(item.categoryLabel ?? item.category ?? item.universe ?? "Uncategorized")
  );

  const topSourceSegments = makeSegments(
    safeItems,
    (item) => String(item.purchaseSource ?? "Unknown Source")
  );

  const topItems = [...safeItems]
    .sort((a, b) => itemCurrentValue(b) - itemCurrentValue(a))
    .slice(0, 6);

  const recentItems = [...safeItems]
    .sort((a, b) => safeNumber((b as any).createdAt) - safeNumber((a as any).createdAt))
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

  const notesCount = safeArray(gallery.itemNotes).filter((note) =>
    safeString((note as any)?.note).length > 0
  ).length;

  const notesCoverage = totalItems > 0 ? (notesCount / totalItems) * 100 : 0;
  const views = safeNumber(gallery.analytics?.views);
  const uniqueViewers = safeArray(gallery.analytics?.uniqueViewKeys).length;

  const inviteCount = safeArray(gallery.share?.inviteTokens).filter((token) => {
    if (!safeString((token as any)?.token)) return false;
    if ((token as any)?.disabled) return false;
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
    (gallery.layout?.type as ExhibitionLayoutType) ?? "GRID";

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