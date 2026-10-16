import { getStoredActiveProfileId } from "@/lib/auth";
import {
  getAllLocalItems,
  saveItem,
  saveItemsBatch,
  noteItemUploaded,
  syncVaultItemsFromSupabase,
  type VaultItem,
} from "@/lib/vaultModel";
import {
  hasSupabaseEnv,
  upsertVaultItemToSupabase,
  uploadVaultImageToSupabase,
} from "@/lib/vaultCloud";
import { getImageBlobFromIndexedDb } from "@/lib/vaultImageStore";
import { getVaultLocalSignature, writeVaultLocalJson } from "@/lib/vaultLocalStore";
import { stillSignedInAs, storedSessionUserId } from "@/lib/sessionGuard";
import { clearSpecsDeviceOnly, getSpecsDeviceOnlyIds } from "@/lib/specsDeviceOnly";
import { registerCloudSaveRetry, reportIdle, reportPending, reportSaved, reportSaving } from "@/lib/cloudSaveStatus";

export type VaultSyncQueueItem = {
  id: string;
  type: "upsert_item";
  itemId: string;
  createdAt: number;
  /** Goes up each time the item is edited again while it is already waiting. An upload only clears the entry it started
   *  with: an edit made during the upload leaves a newer revision, which is sent next instead of being lost. */
  rev?: number;
};

export type VaultSyncQueueSnapshotItem = VaultSyncQueueItem & {
  item?: VaultItem;
  missingLocalItem: boolean;
  pendingImageCount: number;
};

export type VaultSyncQueueSnapshot = {
  online: boolean;
  hasCloudSync: boolean;
  pendingCount: number;
  pendingImageCount: number;
  items: VaultSyncQueueSnapshotItem[];
};

const LS_QUEUE_KEY = "vltd_sync_queue_v1";

function readQueue(): VaultSyncQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && entry.type === "upsert_item");
  } catch {
    return [];
  }
}

function writeQueue(queue: VaultSyncQueueItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_QUEUE_KEY, JSON.stringify(queue));
}

function removeQueueItemByItemId(itemId: string) {
  const next = readQueue().filter((entry) => String(entry.itemId) !== String(itemId));
  writeQueue(next);
}

function dedupeQueue(queue: VaultSyncQueueItem[]) {
  const seen = new Set<string>();
  const next: VaultSyncQueueItem[] = [];

  for (const entry of queue) {
    const key = String(entry.itemId);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(entry);
  }

  return next.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
}

// Retry button and automatic retries (cloudSaveStatus) run the queue again; the queue is upserted by item id, so a retry
// can never create a second copy.
if (typeof window !== "undefined") registerCloudSaveRetry(() => processVaultSyncQueue());

export function getPendingVaultSyncCount() {
  return readQueue().length;
}

export function getVaultSyncQueueSnapshot(): VaultSyncQueueSnapshot {
  if (typeof window === "undefined") {
    return {
      online: true,
      hasCloudSync: false,
      pendingCount: 0,
      pendingImageCount: 0,
      items: [],
    };
  }

  const allItems = getAllLocalItems();
  const itemById = new Map(allItems.map((item) => [String(item.id), item]));
  const queue = dedupeQueue(readQueue());
  const items = queue.map((entry) => {
    const item = itemById.get(String(entry.itemId));
    const pendingImageCount = (item?.images ?? []).filter((image) => image?.localOnly).length;

    return {
      ...entry,
      item,
      missingLocalItem: !item,
      pendingImageCount,
    };
  });

  return {
    online: navigator.onLine,
    hasCloudSync: hasSupabaseEnv(),
    pendingCount: queue.length,
    pendingImageCount: allItems.reduce(
      (count, item) => count + (item.images ?? []).filter((image) => image?.localOnly).length,
      0
    ),
    items,
  };
}

export function enqueueVaultItemSync(itemId: string) {
  queuedDuringRun = true;
  const queue = readQueue();

  const existing = queue.find((entry) => String(entry.itemId) === String(itemId));
  if (existing) {
    // Already waiting (or being uploaded right now): note that it changed again.
    existing.rev = (existing.rev ?? 0) + 1;
    writeQueue(queue);
    return;
  }

  queue.push({
    id: `${itemId}_${Date.now()}`,
    type: "upsert_item",
    itemId,
    createdAt: Date.now(),
  });

  writeQueue(dedupeQueue(queue));
}

/**
 * Apply a batch of edited items: one local write, one queue write. Callers
 * then run processVaultSyncQueue() (usually in the background) to upload.
 */
export function commitVaultItemEdits(items: VaultItem[]) {
  if (items.length === 0) return;
  saveItemsBatch(items);
  const queue = readQueue();
  const queued = new Set(queue.map((entry) => String(entry.itemId)));
  for (const item of items) {
    const itemId = String(item.id);
    if (queued.has(itemId)) {
      const entry = queue.find((e) => String(e.itemId) === itemId);
      if (entry) entry.rev = (entry.rev ?? 0) + 1;
      continue;
    }
    queued.add(itemId);
    queue.push({ id: `${itemId}_${Date.now()}`, type: "upsert_item", itemId, createdAt: Date.now() });
  }
  writeQueue(dedupeQueue(queue));
}

function itemNeedsImageUpload(item: VaultItem) {
  return (item.images ?? []).some((image) => image?.localOnly);
}

async function syncAllImages(item: VaultItem, startedAs: string): Promise<VaultItem> {
  const nextItem: VaultItem = {
    ...item,
    images: [...(item.images ?? [])],
  };

  if (!nextItem.images || nextItem.images.length === 0) return nextItem;

  const updatedImages = [];

  for (const image of nextItem.images) {
    if (!image.localOnly) {
      updatedImages.push(image);
      continue;
    }

    // Never upload or save for a person who is no longer the one signed in (their change of account happened mid-upload).
    if (!stillSignedInAs(startedAs)) throw new Error("The signed-in account changed during sync.");
    const blob = await getImageBlobFromIndexedDb(image.storageKey);

    if (!blob) {
      // Keep the image entry instead of silently dropping it.
      updatedImages.push(image);
      continue;
    }

    const uploaded = await uploadVaultImageToSupabase({
      itemId: nextItem.id,
      file: blob,
      fileName: "image.jpg",
    });

    updatedImages.push({
      ...image,
      storageKey: uploaded.path,
      url: uploaded.publicUrl,
      localOnly: false,
    });
  }

  nextItem.images = updatedImages;

  const primary =
    updatedImages.find((img) => img.storageKey === nextItem.primaryImageKey) ||
    updatedImages[0];

  if (primary) {
    nextItem.primaryImageKey = primary.storageKey;
    nextItem.imageFrontUrl = primary.url || nextItem.imageFrontUrl;
    nextItem.imageFrontStoragePath = primary.localOnly ? undefined : primary.storageKey;
  } else {
    nextItem.primaryImageKey = undefined;
    nextItem.imageFrontUrl = undefined;
    nextItem.imageFrontStoragePath = undefined;
  }

  if (!stillSignedInAs(startedAs)) throw new Error("The signed-in account changed during sync.");
  saveItem(nextItem);
  return nextItem;
}

async function syncOneItem(item: VaultItem, startedAs: string) {
  let nextItem: VaultItem = { ...item };
  const hadLocalImages = itemNeedsImageUpload(nextItem);

  if (hadLocalImages) {
    nextItem = await syncAllImages(nextItem, startedAs);
  }

  if (!stillSignedInAs(startedAs)) throw new Error("The signed-in account changed during sync.");
  await upsertVaultItemToSupabase({
    ...nextItem,
    profile_id: nextItem.profile_id || getStoredActiveProfileId(),
  });
  noteItemUploaded(String(nextItem.id));

  // Only write back when image uploads changed the item. Otherwise this was a
  // full read + rewrite of the whole local vault that stored identical data
  // (and could overwrite an edit made while the upload was in flight).
  if (hadLocalImages && stillSignedInAs(startedAs)) saveItem(nextItem);
}

// Read fresh each time: the browser can lose its connection while an upload run is in progress.
function connectionLooksDown() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

let lastSpecsRequeueAt = 0;
export function requeueSpecsDeviceOnly() {
  if (Date.now() - lastSpecsRequeueAt < 5 * 60 * 1000) return;
  const ids = getSpecsDeviceOnlyIds();
  if (!ids.length) return;
  lastSpecsRequeueAt = Date.now();
  const local = new Set(getAllLocalItems().map((entry) => String(entry.id)));
  for (const id of ids) {
    if (local.has(id)) enqueueVaultItemSync(id);
    else clearSpecsDeviceOnly(id); // the item is gone from this device; nothing left to send
  }
}

type VaultSyncRunResult = { processed: number; remaining: number; fresh?: VaultItem[] };

let runPromise: Promise<VaultSyncRunResult> | null = null;
let queuedDuringRun = false;

/** Removes the waiting entry for an upload that finished, unless the item was edited again since the upload began. */
function settleEntry(done: VaultSyncQueueItem) {
  const stored = readQueue();
  const next = stored.filter((entry) => !(String(entry.itemId) === String(done.itemId) && (entry.rev ?? 0) === (done.rev ?? 0)));
  if (next.length !== stored.length) writeQueue(next);
}

/** Is an edit of this item still waiting to reach the account? */
export function isItemSyncPending(itemId: string) {
  return readQueue().some((entry) => String(entry.itemId) === String(itemId));
}

/**
 * Save an edited item so that leaving the page, refreshing, closing the tab or losing the connection cannot lose it:
 * written on this device and recorded as "waiting to upload" BEFORE anything goes over the network, then uploaded by the
 * shared queue (one writer: no duplicate writes, same account checks, same status). Resolves once the upload attempt is over.
 */
export async function saveItemDurably(item: VaultItem): Promise<{ pending: boolean }> {
  saveItem(item);
  if (!hasSupabaseEnv()) return { pending: false };
  enqueueVaultItemSync(String(item.id));
  try {
    await processVaultSyncQueue();
  } catch {
    /* the entry stays queued and is retried */
  }
  return { pending: isItemSyncPending(String(item.id)) };
}

export function processVaultSyncQueue(): Promise<VaultSyncRunResult> {
  if (typeof window === "undefined") return Promise.resolve({ processed: 0, remaining: 0 });
  // A run is already going: it reads the queue again after each upload, so anything queued meanwhile is picked up by it.
  // This caller simply waits for that whole run.
  if (runPromise) return runPromise;
  runPromise = (async () => {
    let result = await runVaultSyncQueue();
    // An edit queued while the run was finishing (after its last look at the queue) gets its own run straight away.
    for (let again = 0; again < 3 && queuedDuringRun; again++) {
      queuedDuringRun = false;
      const next = await runVaultSyncQueue();
      result = { ...next, processed: result.processed + next.processed };
    }
    return result;
  })().finally(() => {
    runPromise = null;
  });
  queuedDuringRun = false;
  return runPromise;
}

async function runVaultSyncQueue(): Promise<VaultSyncRunResult> {
  if (!navigator.onLine || !hasSupabaseEnv()) {
    // Saved on this device only for now: say so (it is retried when the connection is back).
    if (getPendingVaultSyncCount() > 0 && storedSessionUserId()) reportPending("items");
    return { processed: 0, remaining: getPendingVaultSyncCount() };
  }

  // Nobody signed in: there is no one to send for and nothing to pull. (A signed-out tab that kept running this wrote the last
  // person's queue back into storage after they had signed out, and spun without pause.)
  const startedAs = storedSessionUserId();
  if (!startedAs) {
    reportIdle("items");
    return { processed: 0, remaining: getPendingVaultSyncCount() };
  }

  // Items whose specialist details never reached the account (the database had no place for them yet) are sent again,
  // at most once every few minutes, so they upload on their own once it does.
  requeueSpecsDeviceOnly();

  let processed = 0;
  // Items the cloud refused or could not take this time. They stay in the queue and are tried again on the next run, but
  // they no longer hold up the items behind them: one refused item (for instance in a profile this account may no longer
  // write to) used to stop every later item, in every profile, from ever being uploaded.
  const failedIds = new Set<string>();
  let networkFailures = 0;
  let stop = false;
  let announced = false;

  // Each pass reads the queue as it is NOW, so an edit made while an upload was running is picked up by the next pass.
  for (let pass = 0; pass < 50 && !stop; pass++) {
    const work = dedupeQueue(readQueue()).filter((entry) => !failedIds.has(String(entry.itemId)));
    if (work.length === 0) break;
    if (!announced) {
      reportSaving("items");
      announced = true;
    }

    for (const current of work) {
      // Another person signed in (in this tab or another) while this was running: the queue now on the device is theirs.
      if (!stillSignedInAs(startedAs)) {
        stop = true;
        break;
      }

      const item = getAllLocalItems().find((entry) => String(entry.id) === String(current.itemId));
      if (!item) {
        settleEntry(current);
        continue;
      }

      try {
        await syncOneItem(item, startedAs);
        processed += 1;
        if (stillSignedInAs(startedAs)) settleEntry(current);
      } catch (err) {
        console.error("Sync failed", err);
        failedIds.add(String(current.itemId));
        // A lost connection fails every item the same way: stop instead of trying each one.
        const text = String((err as { message?: unknown })?.message ?? err);
        const offline = connectionLooksDown() || /failed to fetch|networkerror|network request failed|load failed/i.test(text);
        if (offline) {
          networkFailures += 1;
          if (networkFailures >= 2) {
            stop = true;
            break;
          }
        }
      }
    }
  }

  const before = getVaultLocalSignature();
  const fresh = await syncVaultItemsFromSupabase();
  // Tell the open pages only when something actually changed. This used to fire after every run, and the Vault page re-runs
  // this whenever it hears it, so an open Vault page made a full round of requests every fraction of a second, forever.
  if (stillSignedInAs(startedAs) && (processed > 0 || getVaultLocalSignature() !== before)) {
    window.dispatchEvent(new Event("vltd:vault-updated"));
  }

  const remaining = getPendingVaultSyncCount();
  // What the person is told: still waiting (the cloud refused, or the connection failed), saved, or nothing to say.
  if (!stillSignedInAs(startedAs)) reportIdle("items");
  else if (remaining > 0) reportPending("items");
  else if (processed > 0) reportSaved("items");
  else reportIdle("items");

  return { processed, remaining, fresh };
}

/**
 * One-time full backup: push every locally-stored item (all profiles) to
 * Supabase. Reuses the tested queue/upsert path, so images go up too. Safe to
 * run repeatedly — items are upserted, nothing is deleted.
 */
export async function syncAllItemsToCloud(): Promise<{
  total: number;
  processed: number;
  remaining: number;
}> {
  if (typeof window === "undefined") return { total: 0, processed: 0, remaining: 0 };
  const items = getAllLocalItems();
  for (const item of items) {
    if (item?.id) enqueueVaultItemSync(String(item.id));
  }
  const result = await processVaultSyncQueue();
  return {
    total: items.length,
    processed: result.processed,
    remaining: result.remaining,
  };
}

/**
 * Recovery: discard the local item cache + pending queue and re-pull the active
 * profile's items fresh from Supabase (the source of truth). Use this if local
 * assignments got out of sync with the cloud. Cloud data is not modified.
 */
export async function restoreLocalVaultFromCloud(): Promise<{ pulled: number }> {
  if (typeof window === "undefined") return { pulled: 0 };
  // Drop any pending (possibly mis-tagged) local edits so they can't re-upload.
  window.localStorage.setItem("vltd_sync_queue_v1", "[]");
  // Wipe the local item cache entirely, then re-pull authoritative cloud data.
  writeVaultLocalJson("[]");
  const fresh = await syncVaultItemsFromSupabase();
  window.dispatchEvent(new Event("vltd:vault-updated"));
  return { pulled: Array.isArray(fresh) ? fresh.length : 0 };
}

export function clearVaultSyncQueue() {
  writeQueue([]);
}

export function removeVaultItemFromSyncQueue(itemId: string) {
  removeQueueItemByItemId(itemId);
}
