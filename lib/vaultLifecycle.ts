import { loadItems, saveItems, type VaultItem } from "@/lib/vaultModel";
import { addSaleRecord } from "@/lib/historyModel";

export function sellItem(itemId: string, salePrice: number, platform?: string) {
  const items = loadItems();

  const item = items.find((i) => i.id === itemId);
  if (!item) return;

  const remaining = items.filter((i) => i.id !== itemId);

  saveItems(remaining);

  addSaleRecord({
    itemId: item.id,
    title: item.title,
    universe: item.universe,
    category: item.category,
    grade: item.grade,
    certNumber: item.certNumber,

    purchasePrice: item.purchasePrice,
    salePrice,

    soldAt: Date.now(),
    platform,
  });
}