import { loadItems, saveItem, saveItems, type VaultItem } from "./vaultModel";
import { emitVaultUpdate } from "./vaultEvents";
import { getSupabaseBrowserClient } from "./supabaseClient";
import { hasSupabaseEnv, VAULT_ITEMS_TABLE } from "./vaultCloud";
import { removeItemIdsFromAllGalleriesConfirmed } from "./galleryModel";

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

export type DeleteVaultItemResult = {
  ok: boolean;
  error?: string;
};

// The one shared, cloud-aware delete path (NYCC launch blocker #2). Every
// entry point that lets someone permanently delete a vault item — the Vault
// grid, the item-detail page, anywhere else — must call this instead of
// removing the local copy on its own, and must await it and check `ok`
// before treating the delete as done. Deleting only locally (the old
// item-detail-page behavior) let a cloud sync or a second device bring the
// "deleted" item back. On a confirmed cloud delete, this also prunes the
// item's id out of every exhibition that referenced it (awaited and
// confirmed against Supabase itself, not fire-and-forget) so a deleted
// item can't keep inflating an exhibition's item count or showing up in a
// public gallery forever.
//
// The Supabase JS client does not throw on an ordinary delete failure — it
// resolves with `{ error }`. A bare try/catch around the call never sees
// that; it has to be checked explicitly, which is what actually confirms
// the cloud row is gone before anything is reported back as successful.
//
// That alone isn't enough, though — confirmed live against a disposable test
// row: an RLS-denied delete comes back with `error: null` and zero rows
// affected, not an error. `.select("id")` gets back the row(s) actually
// deleted, so an empty result is treated as a failure too, instead of being
// read as "nothing left to delete, so it must have worked."
export async function deleteVaultItemEverywhere(id: string): Promise<DeleteVaultItemResult> {
  const before = loadItems({ includeAllProfiles: true });
  const target = before.find((item) => String(item.id) === String(id));
  saveItems(before.filter((item) => String(item.id) !== String(id)));
  emitVaultUpdate();

  if (hasSupabaseEnv()) {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data, error } = await supabase
        .from(VAULT_ITEMS_TABLE)
        .delete()
        .eq("id", id)
        .select("id");
      if (error || !data || data.length === 0) {
        // Cloud still has this item — don't leave it looking deleted locally.
        if (target) {
          saveItems([...loadItems({ includeAllProfiles: true }), target]);
          emitVaultUpdate();
        }
        return {
          ok: false,
          error: error?.message || "Could not delete this item from the cloud.",
        };
      }
    }
  }

  await removeItemIdsFromAllGalleriesConfirmed([id]);
  emitVaultUpdate();
  return { ok: true };
}

// Same delete path, batched. Deleting several items one at a time (each
// through deleteVaultItemEverywhere) would run one independent gallery
// cleanup per item; two deleted items that belonged to the same exhibition
// would then each push their own confirmed-but-partial state to that one
// gallery row back to back. Mass delete resolves every gallery exactly
// once, after all the ids are known.
export async function deleteVaultItemsEverywhere(ids: string[]): Promise<DeleteVaultItemResult> {
  const idSet = new Set(ids.map(String));
  if (idSet.size === 0) return { ok: true };

  const before = loadItems({ includeAllProfiles: true });
  const targets = before.filter((item) => idSet.has(String(item.id)));
  saveItems(before.filter((item) => !idSet.has(String(item.id))));
  emitVaultUpdate();

  if (hasSupabaseEnv()) {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const results = await Promise.all(
        [...idSet].map(async (id) => {
          const { data, error } = await supabase
            .from(VAULT_ITEMS_TABLE)
            .delete()
            .eq("id", id)
            .select("id");
          // Same RLS-denial gap as the single-item path: no error, zero rows
          // deleted, must be treated as a failure just the same.
          const ok = !error && Boolean(data && data.length > 0);
          return { id, error, ok };
        })
      );

      const failed = results.filter((r) => !r.ok);
      const succeededIds = results.filter((r) => r.ok).map((r) => r.id);

      if (failed.length > 0) {
        // Restore only the ones that actually failed to delete.
        const failedIds = new Set(failed.map((f) => f.id));
        const restore = targets.filter((item) => failedIds.has(String(item.id)));
        if (restore.length > 0) {
          saveItems([...loadItems({ includeAllProfiles: true }), ...restore]);
          emitVaultUpdate();
        }

        // A partial failure must not skip cleanup for the ones that DID
        // delete — returning early here used to leave every successfully
        // deleted item's id still sitting in gallery.itemIds, permanently,
        // since this is the only place that ever prunes them.
        if (succeededIds.length > 0) {
          await removeItemIdsFromAllGalleriesConfirmed(succeededIds);
          emitVaultUpdate();
        }

        const failedTitles = restore
          .map((item) => item.title)
          .filter((title): title is string => Boolean(title));
        const named = failedTitles.length > 0 ? `: ${failedTitles.join(", ")}` : "";

        return {
          ok: false,
          error: `${failed.length} of ${idSet.size} item(s) could not be deleted from the cloud${named}. They've been restored.`,
        };
      }
    }
  }

  await removeItemIdsFromAllGalleriesConfirmed([...idSet]);
  emitVaultUpdate();
  return { ok: true };
}
