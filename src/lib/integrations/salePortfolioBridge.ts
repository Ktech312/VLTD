import { recordSale } from "@/lib/salesLedger";
import { loadItems, saveItems } from "@/lib/vaultModel";
import { dispatchItemSold } from "@/hooks/useAutoShareTrigger";

export function sellItemAndRecord(item: any, salePrice: number) {
  const purchase = Number(item.purchasePrice ?? 0);

  // 1. record sale
  recordSale({
    itemId: item.id,
    purchasePrice: purchase,
    salePrice,
    universe: item.universe,
    category: item.categoryLabel,
  });

  // 2. remove from vault
  const items = loadItems();
  const next = items.filter((i) => i.id !== item.id);

  saveItems(next);

  // 3. notify app
  window.dispatchEvent(new Event("vltd:vault-updated"));
  dispatchItemSold(item, salePrice);

  return {
    profit: salePrice - purchase,
  };
}