import { getStoredActiveProfileId } from "@/lib/auth";
import {
  getAllLocalItems,
  saveItem,
  syncVaultItemsFromSupabase,
  type VaultItem,
} from "@/lib/vaultModel";
import {
  hasSupabaseEnv,
  upsertVaultItemToSupabase,
  uploadVaultImageToSupabase,
} from "@/lib/vaultCloud";
import { getImageBlobFromIndexedDb } from "@/lib/vaultImageStore";

export type VaultSyncQueueItem = {
  id: string;
  type: "upsert_item";
  itemId: string;
  createdAt: number;
};

const LS_QUEUE_KEY = "vltd_sync_queue_v1";
let isProcessing = false;

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

export function getPendingVaultSyncCount() {
  return readQueue().length;
}

export function enqueueVaultItemSync(itemId: string) {
  const queue = readQueue();

  if (queue.find((entry) => String(entry.itemId) === String(itemId))) return;

  queue.push({
    id: `${itemId}_${Date.now()}`,
    type: "upsert_item",
    itemId,
    createdAt: Date.now(),
  });

  writeQueue(dedupeQueue(queue));
}

function itemNeedsImageUpload(item: VaultItem) {
  return (item.images ?? []).some((image) => image?.localOnly);
}

async function syncAllImages(item: VaultItem): Promise<VaultItem> {
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

  saveItem(nextItem);
  return nextItem;
}

async function syncOneItem(item: VaultItem) {
  let nextItem: VaultItem = { ...item };

  if (itemNeedsImageUpload(nextItem)) {
    nextItem = await syncAllImages(nextItem);
  }

  await upsertVaultItemToSupabase({
    ...nextItem,
    profile_id: nextItem.profile_id || getStoredActiveProfileId(),
  });

  saveItem(nextItem);
}

export async function processVaultSyncQueue() {
  if (typeof window === "undefined") return { processed: 0, remaining: 0 };
  if (isProcessing) {
    return { processed: 0, remaining: getPendingVaultSyncCount() };
  }

  if (!navigator.onLine || !hasSupabaseEnv()) {
    return { processed: 0, remaining: getPendingVaultSyncCount() };
  }

  isProcessing = true;

  try {
    let queue = dedupeQueue(readQueue());
    writeQueue(queue);

    let processed = 0;

    while (queue.length > 0) {
      const current = queue[0];

      const item = getAllLocalItems().find(
        (entry) => String(entry.id) === String(current.itemId)
      );

      if (!item) {
        queue.shift();
        writeQueue(queue);
        continue;
      }

      try {
        await syncOneItem(item);
        processed += 1;
        queue.shift();
        writeQueue(queue);
      } catch (err) {
        console.error("Sync failed", err);
        break;
      }
    }

    const fresh = await syncVaultItemsFromSupabase();
    window.dispatchEvent(new Event("vltd:vault-updated"));

    return {
      processed,
      remaining: queue.length,
      fresh,
    };
  } finally {
    isProcessing = false;
  }
}

export function clearVaultSyncQueue() {
  writeQueue([]);
}

export function removeVaultItemFromSyncQueue(itemId: string) {
  removeQueueItemByItemId(itemId);
}