import { appendItems, loadItems, type VaultItem } from "@/lib/vaultModel";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import { enqueueVaultItemSync, isItemSyncPending, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import type { WishlistItem } from "@/lib/wishlistModel";
import { acquiredOf, quantityOf, withAcquired } from "@/lib/wantsCore";

// "Acquired": the copies the person actually received become real Vault records. What they paid is asked for and may stay unknown; it is NEVER taken from the
// target price or the expected price. The want is changed only AFTER the Vault records exist on this device (and are queued or uploaded), so a failed save
// leaves it exactly as it was. Vault record ids are fixed per want and copy number, so saving twice (a retry, a second tap, a refresh) cannot create a second record.

export type AcquireResult =
  | { ok: true; want: WishlistItem; itemIds: string[]; created: number; pending: boolean }
  | { ok: false; reason: string };

export function vaultIdForCopy(wantId: string, copyNumber: number): string {
  return `vault_acq_${wantId}_${copyNumber}`;
}

function friendly(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.startsWith("FREE_TIER_LIMIT:")) return msg.slice("FREE_TIER_LIMIT:".length);
  return "Could not save to your Vault. Nothing was marked as received. Try again.";
}

export function vaultItemFromWant(want: WishlistItem, id: string, profileId: string | undefined, paid: number | undefined, now: number): VaultItem {
  const subtitle = [want.series?.trim(), want.edition?.trim()].filter(Boolean).join(" · ") || undefined;
  const notes = [want.notes?.trim(), want.sourceUrl ? `Source: ${want.sourceUrl}` : undefined].filter(Boolean).join("\n") || undefined;
  return {
    id,
    profile_id: profileId || undefined,
    title: want.title.trim() || "Item",
    subtitle,
    edition: want.edition?.trim() || undefined,
    universe: want.universe?.trim() || "MISC",
    category: want.category?.trim() || undefined,
    subject: want.subject?.trim() || undefined,
    imageFrontUrl: want.imageUrl || undefined,
    purchaseSource: want.shop?.trim() || undefined,
    // The real cost, or nothing. Not the target price, not the expected price.
    purchasePrice: typeof paid === "number" && Number.isFinite(paid) && paid >= 0 ? paid : undefined,
    notes,
    status: "COLLECTION",
    createdAt: now,
    isNew: true,
    addedVia: "wishlist",
  };
}

export async function acquireCopies(
  want: WishlistItem,
  opts: { count: number; paidEach?: number; profileId?: string; now?: number },
): Promise<AcquireResult> {
  const now = opts.now ?? Date.now();
  const total = quantityOf(want);
  const have = acquiredOf(want);
  const left = total - have;
  const count = Math.floor(opts.count);
  if (!Number.isFinite(count) || count < 1) return { ok: false, reason: "Enter how many copies you received." };
  if (count > left) return { ok: false, reason: left === 0 ? "All copies are already recorded as received." : `Only ${left} ${left === 1 ? "copy is" : "copies are"} still to receive.` };

  const wanted: string[] = [];
  for (let i = 0; i < count; i++) wanted.push(vaultIdForCopy(want.id, have + i + 1));
  const present = new Set(loadItems().map((item) => String(item.id)));
  const toCreate = wanted.filter((id) => !present.has(id));
  try {
    if (toCreate.length) appendItems(toCreate.map((id) => vaultItemFromWant(want, id, opts.profileId, opts.paidEach, now)));
  } catch (error) {
    return { ok: false, reason: friendly(error) };
  }
  // The save counts only if every record can now be read back from the Vault on this device.
  const after = new Set(loadItems().map((item) => String(item.id)));
  if (!wanted.every((id) => after.has(id))) return { ok: false, reason: "Could not save to your Vault. Nothing was marked as received. Try again." };

  for (const id of toCreate) enqueueVaultItemSync(id);
  emitVaultUpdate();
  try {
    await processVaultSyncQueue();
  } catch {
    /* the records stay queued ("waiting to upload") and are retried by the Vault itself */
  }
  const pending = wanted.some((id) => isItemSyncPending(id));
  return { ok: true, want: withAcquired(want, wanted, now), itemIds: wanted, created: toCreate.length, pending };
}
