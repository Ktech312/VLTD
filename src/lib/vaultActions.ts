import { loadItems, saveItem, saveItems, type VaultItem } from "./vaultModel";
import { emitVaultUpdate } from "./vaultEvents";
import { getSupabaseBrowserClient } from "./supabaseClient";
import { hasSupabaseEnv, VAULT_ITEMS_TABLE } from "./vaultCloud";
import { removeItemIdFromAllGalleries } from "./galleryModel";

export function addItemAndNotify(item: VaultItem) {
  saveItem(item);
  emitVaultUpdate();
  return item;
}

export function updateItemAndNotify(item: VaultItem) {
  saveItem(item);
  emitVaultUpdate();
  return item;
}

// The one shared, cloud-aware delete path (NYCC launch blocker #2). Every
// entry point that lets someone permanently delete a vault item — the Vault
// grid, the item-detail page, anywhere else — must call this instead of
// removing the local copy on its own. Deleting only locally (the old
// item-detail-page behavior) let a cloud sync or a second device bring the
// "deleted" item back. This also prunes the item's id out of every
// exhibition that referenced it, so a deleted item can't keep inflating an
// exhibition's item count or showing up in a public gallery forever.
export async function deleteVaultItemEverywhere(id: string) {
  const items = loadItems({ includeAllProfiles: true });
  const next = items.filter((item) => String(item.id) !== String(id));
  saveItems(next);
  emitVaultUpdate();

  if (hasSupabaseEnv()) {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      try {
        await supabase.from(VAULT_ITEMS_TABLE).delete().eq("id", id);
      } catch {
        // Local delete already applied; the row will be caught by the next
        // reconcile if this fails.
      }
    }
  }

  removeItemIdFromAllGalleries(id);
  emitVaultUpdate();
  return id;
}
