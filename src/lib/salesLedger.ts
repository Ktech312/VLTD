
// src/lib/salesLedger.ts

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

const LS_KEY = "vltd_sales_ledger_v1";

function safeNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function loadSales(): SaleRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSales(records: SaleRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(records));
}

export function recordSale(params: {
  itemId: string;
  purchasePrice: number;
  salePrice: number;
  universe?: string;
  category?: string;
}) {
  const sales = loadSales();

  const sale: SaleRecord = {
    id: crypto.randomUUID(),
    itemId: params.itemId,
    universe: params.universe,
    category: params.category,
    purchasePrice: safeNumber(params.purchasePrice),
    salePrice: safeNumber(params.salePrice),
    profit: safeNumber(params.salePrice) - safeNumber(params.purchasePrice),
    saleDate: Date.now(),
    createdAt: Date.now(),
  };

  sales.push(sale);
  saveSales(sales);

  return sale;
}

export function getSalesMetrics() {
  const sales = loadSales();

  const totalSold = sales.length;
  const totalRevenue = sales.reduce((s, r) => s + r.salePrice, 0);
  const totalCost = sales.reduce((s, r) => s + r.purchasePrice, 0);
  const totalProfit = totalRevenue - totalCost;

  return {
    totalSold,
    totalRevenue,
    totalCost,
    totalProfit,
  };
}
