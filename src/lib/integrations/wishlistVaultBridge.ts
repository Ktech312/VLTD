import { loadItems, saveItems } from "@/lib/vaultModel";
import { removeWishlistItem } from "@/lib/wishlistModel";

export function moveWishlistItemToVault(item: any) {
  const vaultItem = {
    ...item,
    id: String(Date.now()),
    createdAt: Date.now(),
  };

  const existing = loadItems();
  saveItems([...existing, vaultItem]);

  removeWishlistItem(item.id);

  window.dispatchEvent(new Event("vltd:vault-updated"));

  return vaultItem;
}