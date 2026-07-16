// src/lib/salesLedger.ts
// Adapter over the unified sales model (src/lib/salesModel.ts). Kept so existing
// callers (salePortfolioBridge) keep working; all data now flows to one store.

import {
  addSale,
  getSalesMetrics as unifiedMetrics,
  loadSales as unifiedLoad,
  saveSales as unifiedSave,
  type Sale,
} from "@/lib/salesModel";

export type SaleRecord = {
  id: string;
  itemId: string;
  universe?: string;
  category?: string;
  purchasePrice: number;
  salePrice: number;
  profit: number;
  saleDate: number;
  createdAt: number;
};

function toRecord(s: Sale): SaleRecord {
  return {
    id: s.id,
    itemId: s.itemId ?? "",
    universe: s.universe,
    category: s.category,
    purchasePrice: s.purchasePrice ?? 0,
    salePrice: s.salePrice ?? 0,
    profit: s.profit ?? (s.salePrice ?? 0) - (s.purchasePrice ?? 0),
    saleDate: s.soldAt,
    createdAt: s.soldAt,
  };
}

export function loadSales(): SaleRecord[] {
  return unifiedLoad().map(toRecord);
}

export function saveSales(records: SaleRecord[]) {
  unifiedSave(
    records.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      universe: r.universe,
      category: r.category,
      purchasePrice: r.purchasePrice,
      salePrice: r.salePrice,
      profit: r.profit,
      soldAt: r.saleDate,
    }))
  );
}

export function recordSale(params: {
  itemId: string;
  purchasePrice: number;
  salePrice: number;
  universe?: string;
  category?: string;
}) {
  const sale = addSale({
    itemId: params.itemId,
    universe: params.universe,
    category: params.category,
    purchasePrice: Number(params.purchasePrice) || 0,
    salePrice: Number(params.salePrice) || 0,
  });
  return toRecord(sale);
}

export function getSalesMetrics() {
  return unifiedMetrics();
}
