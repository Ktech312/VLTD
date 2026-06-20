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

const STORAGE_KEY = "vltd_sales_history";

export function loadSales(): SaleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSales(sales: SaleRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
}

export function recordSale(record: SaleRecord) {
  const existing = loadSales();
  const next = [record, ...existing];
  saveSales(next);
  return next;
}
