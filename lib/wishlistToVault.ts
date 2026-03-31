import { addItem } from "./vaultModel";
import { removeWishlistItem, type WishlistItem } from "./wishlistModel";

export function convertWishlistToVault(item: WishlistItem) {
  const vaultItem = {
    id: `${Date.now()}`,
    title: item.title,
    purchasePrice: item.targetPrice ?? 0,
    currentValue: item.targetPrice ?? 0,
    createdAt: Date.now(),
  };

  addItem(vaultItem);
  removeWishlistItem(item.id);

  return vaultItem;
}
