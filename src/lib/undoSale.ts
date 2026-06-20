import { loadItems, saveItems } from "./vaultModel";
import { loadSales, saveSales } from "./salesHistory";
import type { VaultItem } from "./vaultModel";

export function undoLastSale() {
  const sales = loadSales();
  if (sales.length === 0) return;

  const [last, ...rest] = sales;
  const items = loadItems();

  const restored: VaultItem = {
    id: String(last.itemId ?? "").trim(),
    title: String(last.title ?? "").trim() || "Restored Item",
    purchasePrice: last.purchasePrice,
    currentValue: last.salePrice,
    universe: last.universe,
    categoryLabel: last.categoryLabel,
    createdAt: Date.now(),
  };

  saveItems([restored, ...items]);
  saveSales(rest);
}
