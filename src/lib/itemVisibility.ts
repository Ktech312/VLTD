// Turning an item public or private: the one place that does it, shared by the visibility eye and the Share panel's
// "Turn on public sharing?" answer, so both behave the same way and both report a failure instead of pretending it worked.

import { emitVaultUpdate } from "@/lib/vaultEvents";
import { saveItem, type VaultItem } from "@/lib/vaultModel";
import { hasSupabaseEnv, upsertVaultItemToSupabase } from "@/lib/vaultCloud";
import { canUsePrivatePhotos, migrateItemImagesToPrivate, migrateItemImagesToPublic } from "@/lib/privatePhotos";

export type VisibilityResult = {
  /** True only when the account has the change (or there is no account to save to). */
  ok: boolean;
  /** The item as it stands now: the new one on success, the original on failure. */
  item: VaultItem;
  error?: string;
};

/**
 * Sets an item public or private.
 * - Photos: only paid profiles keep private photos in a separate store (see privatePhotos.ts); going public always moves any
 *   private-stored photo back, whatever the plan.
 * - `onLocal` is called as soon as the copy on this device has the change (before the account answers), so the eye can respond
 *   at once. On a failure the device copy is put back and `onLocal` is called again with the original.
 */
export async function setItemPublic(item: VaultItem, nextPublic: boolean, opts?: { onLocal?: (item: VaultItem) => void }): Promise<VisibilityResult> {
  const previousPublic = Boolean(item.isPublic);
  let next: VaultItem = { ...item, isPublic: nextPublic };

  try {
    if (previousPublic && !nextPublic) {
      if (await canUsePrivatePhotos()) {
        next = await migrateItemImagesToPrivate(next);
      }
    } else if (nextPublic) {
      next = await migrateItemImagesToPublic(next);
    }
  } catch {
    // Moving photos failed: keep going with the photos where they already are, rather than blocking the change on a storage hiccup.
  }

  saveItem(next);
  opts?.onLocal?.(next);
  emitVaultUpdate();

  try {
    if (hasSupabaseEnv()) await upsertVaultItemToSupabase(next);
    return { ok: true, item: next };
  } catch (error) {
    const reverted: VaultItem = { ...item, isPublic: previousPublic };
    saveItem(reverted);
    opts?.onLocal?.(reverted);
    emitVaultUpdate();
    return { ok: false, item: reverted, error: error instanceof Error && error.message ? error.message : "Visibility could not be updated." };
  }
}
