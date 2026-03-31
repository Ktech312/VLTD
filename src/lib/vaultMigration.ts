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

function isLegacyBrokenStorageKey(value?: string | null) {
  if (!value) return false;
  const v = String(value).trim();
  if (!v) return false;

  return v.startsWith("item_") && !v.includes("/") && !v.includes(".");
}

function hasHealthyCloudPrimary(item: VaultItem) {
  return Boolean(
    item.imageFrontUrl &&
      item.imageFrontStoragePath &&
      !isLegacyBrokenStorageKey(item.imageFrontStoragePath)
  );
}

function getPrimaryCandidateKey(item: VaultItem) {
  if (item.primaryImageKey) return String(item.primaryImageKey).trim();
  if (item.imageFrontStoragePath) return String(item.imageFrontStoragePath).trim();

  const firstImage =
    Array.isArray(item.images) && item.images.length > 0
      ? [...item.images].sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0))[0]
      : null;

  if (firstImage?.storageKey) return String(firstImage.storageKey).trim();
  return "";
}

function buildRepairedItem(item: VaultItem, uploaded: { path: string; publicUrl: string }): VaultItem {
  const nextImages =
    Array.isArray(item.images) && item.images.length > 0
      ? [...item.images]
          .sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
          .map((image, index) => {
            if (index !== 0) return image;
            return {
              ...image,
              id: image.id || `${item.id}_img_0`,
              storageKey: uploaded.path,
              url: uploaded.publicUrl,
              order: 0,
              localOnly: false,
            };
          })
      : [
          {
            id: `${item.id}_img_0`,
            storageKey: uploaded.path,
            url: uploaded.publicUrl,
            order: 0,
            localOnly: false,
          },
        ];

  return {
    ...item,
    primaryImageKey: uploaded.path,
    imageFrontUrl: uploaded.publicUrl,
    imageFrontStoragePath: uploaded.path,
    images: nextImages,
  };
}

export async function migrateExistingVaultImagesToSupabase() {
  if (typeof window === "undefined") return { migrated: 0, skipped: 0 };
  if (!navigator.onLine || !hasSupabaseEnv()) return { migrated: 0, skipped: 0 };

  const items = getAllLocalItems();
  let migrated = 0;
  let skipped = 0;

  for (const item of items) {
    const primaryKey = getPrimaryCandidateKey(item);
    const needsStandardMigration =
      Boolean(primaryKey) && (!item.imageFrontUrl || !item.imageFrontStoragePath);

    const needsLegacyRepair =
      Boolean(primaryKey) &&
      (
        isLegacyBrokenStorageKey(item.imageFrontStoragePath) ||
        isLegacyBrokenStorageKey(item.primaryImageKey) ||
        (
          Array.isArray(item.images) &&
          item.images.length > 0 &&
          isLegacyBrokenStorageKey(item.images[0]?.storageKey)
        )
      );

    if (!needsStandardMigration && !needsLegacyRepair) {
      if (hasHealthyCloudPrimary(item)) {
        skipped += 1;
        continue;
      }
    }

    if (!primaryKey) {
      skipped += 1;
      continue;
    }

    const blob = await getImageBlobFromIndexedDb(primaryKey);
    if (!blob) {
      skipped += 1;
      continue;
    }

    try {
      const uploaded = await uploadVaultImageToSupabase({
        itemId: item.id,
        file: blob,
        fileName: "primary.jpg",
      });

      const nextItem = buildRepairedItem(item, uploaded);

      saveItem(nextItem);
      await upsertVaultItemToSupabase(nextItem);
      migrated += 1;
    } catch {
      skipped += 1;
    }
  }

  await syncVaultItemsFromSupabase();
  window.dispatchEvent(new Event("vltd:vault-updated"));

  return { migrated, skipped };
}