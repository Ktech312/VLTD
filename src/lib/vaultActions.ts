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
// A delete that removed zero rows is ambiguous: either the cloud denied it
// (RLS -- the row is still there) or the cloud never had this row at all
// (an item that only ever existed on this device, which can never be
// "deleted from the cloud" and used to be undeletable forever). Looking the
// row up by id tells them apart: still there = a real failure, keep it;
// not there = nothing to delete in the cloud, so the delete is done. A
// lookup error is treated as "can't tell" and still counts as a failure.
async function isConfirmedAbsentFromCloud(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  id: string,
  profileId?: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(VAULT_ITEMS_TABLE)
    .select("id")
    .eq("id", id)
    .limit(1);
  if (error || !Array.isArray(data) || data.length !== 0) return false;
  // An empty answer is also what an account gets for a row it is NOT allowed to see (it is no longer a member of the
  // profile). Only trust "not there" when this account can see its own membership of the item's profile; otherwise the
  // delete was refused, not finished, and the item must be kept and reported.
  return canSeeOwnMembership(supabase, profileId);
}

async function canSeeOwnMembership(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  profileId?: string
): Promise<boolean> {
  if (!profileId) return true; // nothing to check against: keep the earlier behaviour
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return false;
  const { data, error } = await supabase
    .from("profile_members")
    .select("role")
    .eq("profile_id", profileId)
    .eq("user_id", userId)
    .limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

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
      const deletedNothing = !error && Boolean(data) && data!.length === 0;
      const alreadyGone = deletedNothing && (await isConfirmedAbsentFromCloud(supabase, id, target?.profile_id ? String(target.profile_id) : undefined));
      if (!alreadyGone && (error || !data || data.length === 0)) {
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
      const profileOf = new Map(targets.map((item) => [String(item.id), item.profile_id ? String(item.profile_id) : undefined]));
      const results = await Promise.all(
        [...idSet].map(async (id) => {
          const { data, error } = await supabase
            .from(VAULT_ITEMS_TABLE)
            .delete()
            .eq("id", id)
            .select("id");
          // Same RLS-denial gap as the single-item path: no error, zero rows
          // deleted, must be treated as a failure just the same.
          const deleted = !error && Boolean(data && data.length > 0);
          const ok =
            deleted ||
            (!error && Boolean(data) && (await isConfirmedAbsentFromCloud(supabase, id, profileOf.get(String(id)))));
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

export type MoveItemsResult = {
  /** Items the cloud CONFIRMED are now in the other profile (and have left this profile's exhibitions). */
  movedIds: string[];
  /** Items left exactly as they were (still in the original profile and in their exhibitions), with the reason. */
  failed: { id: string; reason: string }[];
};

// Move items to another profile (Personal <-> Business). The cloud answers FIRST: an item is only treated as moved once the account has
// confirmed it, and only then does it leave this profile on screen and in the exhibitions that held it. If the cloud does not confirm
// (offline, refused, an item that has not finished uploading), nothing changes for that item: it stays in its original profile and in its
// exhibitions. A lost answer is checked by reading the rows back, so an item that did move is not reported as failed (and the other way round).
export async function moveItemsToProfileConfirmed(items: VaultItem[], targetProfileId: string): Promise<MoveItemsResult> {
  const ids = items.map((item) => String(item.id));
  const result: MoveItemsResult = { movedIds: [], failed: [] };
  if (ids.length === 0 || !targetProfileId) return result;

  const supabase = hasSupabaseEnv() ? getSupabaseBrowserClient() : null;
  let confirmed: string[] = [];
  const reasons = new Map<string, string>();

  if (!supabase) {
    // No cloud configured (local-only use): there is nothing to confirm against.
    confirmed = ids;
  } else {
    const CHUNK = 100;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      let done: string[] | null = null;
      let failure = "The account did not confirm the move.";
      try {
        const { data, error } = await supabase
          .from(VAULT_ITEMS_TABLE)
          .update({ profile_id: targetProfileId, is_public: false })
          .in("id", chunk)
          .neq("profile_id", targetProfileId)
          .select("id");
        if (error) failure = error.message || failure;
        else done = (data ?? []).map((row: { id: unknown }) => String(row.id));
      } catch (error) {
        failure = error instanceof Error ? error.message : failure;
      }
      if (done === null) {
        // The answer was lost or refused: read the rows back before deciding (the move may have gone through).
        try {
          const { data, error } = await supabase.from(VAULT_ITEMS_TABLE).select("id, profile_id").in("id", chunk);
          if (!error && data) done = data.filter((row: { profile_id: unknown }) => String(row.profile_id) === targetProfileId).map((row: { id: unknown }) => String(row.id));
        } catch {
          /* cannot tell: treated as not moved */
        }
      }
      for (const id of chunk) {
        if (done && done.includes(id)) confirmed.push(id);
        else reasons.set(id, done === null ? failure : "Not found in your account yet (it may still be uploading), so it was left where it is.");
      }
    }
  }

  const confirmedSet = new Set(confirmed);
  for (const id of ids) if (!confirmedSet.has(id)) result.failed.push({ id, reason: reasons.get(id) ?? "The account did not confirm the move." });
  if (confirmed.length === 0) return result;

  // Confirmed in the account: now update this device's copy (no upload queue: the cloud already has it), then take the items out of the
  // exhibitions that held them (an exhibition only holds its own profile's items).
  const local = loadItems({ includeAllProfiles: true });
  saveItems(local.map((item) => (confirmedSet.has(String(item.id)) ? { ...item, profile_id: targetProfileId, isPublic: false } : item)));
  result.movedIds = confirmed;
  emitVaultUpdate();
  try {
    await removeItemIdsFromAllGalleriesConfirmed(confirmed);
  } catch (error) {
    console.error("Moved items could not be taken out of their exhibitions yet:", error);
  }
  emitVaultUpdate();
  return result;
}
