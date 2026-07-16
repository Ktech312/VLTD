// src/lib/historyModel.ts
// Adapter over the unified sales model (src/lib/salesModel.ts). Kept so existing
// callers (vaultLifecycle.sellItem, activity page, portfolioHistoryMetrics)
// keep working unchanged.

import { addSale, loadSales as unifiedLoad, saveSales as unifiedSave, type Sale } from "@/lib/salesModel";
import type { SaleRecord } from "@/types/vaultLifecycle";

function toRecord(s: Sale): SaleRecord {
  return {
    id: s.id,
    itemId: s.itemId ?? "",
    title: s.title ?? "",
    universe: s.universe,
    category: s.category,
    grade: s.grade,
    certNumber: s.certNumber,
    purchasePrice: s.purchasePrice,
    salePrice: s.salePrice,
    soldAt: s.soldAt,
    platform: s.platform,
    notes: s.notes,
  };
}

export function loadSaleHistory(): SaleRecord[] {
  return unifiedLoad().map(toRecord);
}

export function saveSaleHistory(records: SaleRecord[]) {
  unifiedSave(records.map((r) => ({ ...r })));
}

export function addSaleRecord(record: Omit<SaleRecord, "id">) {
  addSale({ ...record });
}
