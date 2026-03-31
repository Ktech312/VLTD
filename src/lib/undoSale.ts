import { loadItems, saveItems } from "./vaultModel";
import { loadSales, saveSales } from "./salesHistory";

export function undoLastSale() {
  const sales = loadSales();
  if (sales.length === 0) return;

  const [last, ...rest] = sales;

  const items = loadItems();

  const restored = {
    id: last.itemId,
    title: last.title,
    purchasePrice: last.purchasePrice,
    currentValue: last.salePrice,
    universe: last.universe,
    categoryLabel: last.categoryLabel,
    createdAt: Date.now(),
  };

  saveItems([restored, ...items]);
  saveSales(rest);
}