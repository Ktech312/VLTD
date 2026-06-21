import { appendItems, type VaultItem } from "./vaultModel";
import { removeWishlistItem, type WishlistItem } from "./wishlistModel";
import { emitVaultUpdate } from "./vaultEvents";
import { enqueueVaultItemSync, processVaultSyncQueue } from "./vaultSyncQueue";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function getActiveProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Moves a wishlist item into the vault as a real, owned item - mirrors the
 * exact save pattern used by /vault/add (appendItems + sync queue + event)
 * so the new item shows up immediately and syncs to the cloud like any
 * other added item, instead of silently sitting in localStorage only.
 */
export async function convertWishlistToVault(item: WishlistItem): Promise<VaultItem> {
  const now = Date.now();
  const activeProfileId = getActiveProfileId();
  const targetPrice =
    typeof item.targetPrice === "number" && Number.isFinite(item.targetPrice)
      ? item.targetPrice
      : undefined;

  // Wishlist condition is a constrained enum (any/raw/graded/nm/ex) -
  // carry it into the freeform `condition` field on VaultItem rather than
  // dropping it, since there's no equivalent enum field there.
  const conditionLabel =
    item.condition && item.condition !== "any" ? item.condition : undefined;

  const noteParts = [
    item.notes?.trim(),
    item.priority ? `Priority: ${item.priority}` : undefined,
  ].filter(Boolean);

  const vaultItem: VaultItem = {
    id: `vault_${now}_${Math.random().toString(36).slice(2, 8)}`,
    profile_id: activeProfileId || undefined,
    title: item.title?.trim() || "Wishlist Item",
    universe: item.universe?.trim() || "MISC",
    category: item.category?.trim() || undefined,
    subject: item.subject?.trim() || undefined,
    condition: conditionLabel,
    // Seed both purchase price and current value from the target price so
    // the item isn't valueless on arrival - the collector can refine either
    // once they've actually logged what they paid.
    purchasePrice: targetPrice,
    currentValue: targetPrice,
    notes: noteParts.length ? noteParts.join("\n") : undefined,
    status: "COLLECTION",
    createdAt: now,
    isNew: true,
  };

  appendItems([vaultItem]);
  enqueueVaultItemSync(vaultItem.id);
  emitVaultUpdate();
  await processVaultSyncQueue();

  removeWishlistItem(item.id);

  return vaultItem;
}
