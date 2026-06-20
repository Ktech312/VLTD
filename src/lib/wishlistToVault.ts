import { saveItem, type VaultItem } from "./vaultModel";
import { removeWishlistItem, type WishlistItem } from "./wishlistModel";

export function convertWishlistToVault(item: WishlistItem) {
  const vaultItem: VaultItem = {
    id: String(item.id ?? "").trim() || `wish_${Date.now()}`,
    title: String(item.title ?? "").trim() || "Wishlist Item",
    createdAt:
      typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now(),
    currentValue:
      typeof (item as { currentValue?: unknown }).currentValue === "number"
        ? (item as { currentValue?: number }).currentValue
        : undefined,
    purchasePrice:
      typeof (item as { targetPrice?: unknown }).targetPrice === "number"
        ? (item as { targetPrice?: number }).targetPrice
        : undefined,
    notes:
      typeof (item as { notes?: unknown }).notes === "string"
        ? (item as { notes?: string }).notes
        : undefined,
  };

  saveItem(vaultItem);
  removeWishlistItem(item.id);
  return vaultItem;
}
