// src/lib/salesHistory.ts
// Adapter over the unified sales model (src/lib/salesModel.ts). Kept so existing
// callers (sales page, activity page, undoSale) keep working unchanged.

import { addSale, loadSales as unifiedLoad, saveSales as unifiedSave, type Sale } from "@/lib/salesModel";

export type SaleRecord = {
  id: string;
  itemId: string;
  title?: string;
  universe?: string;
  categoryLabel?: string;
  purchasePrice?: number;
  salePrice?: number;
  soldAt: number;
};

function toRecord(s: Sale): SaleRecord {
  return {
    id: s.id,
    itemId: s.itemId ?? "",
    title: s.title,
    universe: s.universe,
    categoryLabel: s.category,
    purchasePrice: s.purchasePrice,
    salePrice: s.salePrice,
    soldAt: s.soldAt,
  };
}

export function loadSales(): SaleRecord[] {
  return unifiedLoad().map(toRecord);
}

export function saveSales(sales: SaleRecord[]) {
  unifiedSave(
    sales.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      title: r.title,
      universe: r.universe,
      category: r.categoryLabel,
      purchasePrice: r.purchasePrice,
      salePrice: r.salePrice,
      soldAt: r.soldAt,
    }))
  );
}

export function recordSale(record: SaleRecord) {
  addSale({
    id: record.id,
    itemId: record.itemId,
    title: record.title,
    universe: record.universe,
    category: record.categoryLabel,
    purchasePrice: record.purchasePrice,
    salePrice: record.salePrice,
    soldAt: record.soldAt,
  });
  return loadSales();
}
