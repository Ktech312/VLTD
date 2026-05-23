import { loadSaleHistory } from "@/lib/historyModel";

export function getTotalSalesValue() {
  const sales = loadSaleHistory();

  return sales.reduce((sum, s) => sum + (s.salePrice ?? 0), 0);
}

export function getTotalProfit() {
  const sales = loadSaleHistory();

  return sales.reduce((sum, s) => {
    const cost = s.purchasePrice ?? 0;
    const sale = s.salePrice ?? 0;

    return sum + (sale - cost);
  }, 0);
}

export function getTotalSoldItems() {
  return loadSaleHistory().length;
}