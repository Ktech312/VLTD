"use client";

import { useEffect, useState } from "react";

import { getImageObjectUrlFromIndexedDb, revokeImageObjectUrl } from "@/lib/vaultImageStore";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";

function getIndexedDbCandidateKey(item: VaultItem | null) {
  if (!item) return "";
  if (item.primaryImageKey) return item.primaryImageKey;
  if (item.imageFrontStoragePath) return item.imageFrontStoragePath;
  if (Array.isArray(item.images) && item.images.length > 0) {
    const ordered = [...item.images].sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
    return ordered[0]?.storageKey ?? "";
  }
  return "";
}

export function useResolvedVaultImage(item: VaultItem | null) {
  const [resolvedUrl, setResolvedUrl] = useState("");

  useEffect(() => {
    let active = true;
    let indexedDbObjectUrl = "";

    async function resolve() {
      if (!item) {
        setResolvedUrl("");
        return;
      }

      const modelResolved = getPrimaryImageUrl(item);
      if (modelResolved) {
        setResolvedUrl(modelResolved);
        return;
      }

      const indexedDbKey = getIndexedDbCandidateKey(item);
      if (!indexedDbKey) {
        setResolvedUrl("");
        return;
      }

      const indexedDbUrl = await getImageObjectUrlFromIndexedDb(indexedDbKey);

      if (!active) {
        if (indexedDbUrl) revokeImageObjectUrl(indexedDbUrl);
        return;
      }

      if (indexedDbUrl) {
        indexedDbObjectUrl = indexedDbUrl;
        setResolvedUrl(indexedDbUrl);
        return;
      }

      setResolvedUrl("");
    }

    void resolve();

    return () => {
      active = false;
      if (indexedDbObjectUrl) {
        revokeImageObjectUrl(indexedDbObjectUrl);
      }
    };
  }, [
    item?.id,
    item?.primaryImageKey,
    item?.imageFrontStoragePath,
    item?.imageFrontUrl,
    JSON.stringify(
      (item?.images ?? []).map((image) => ({
        storageKey: image?.storageKey ?? "",
        url: image?.url ?? "",
        order: image?.order ?? 0,
        localOnly: image?.localOnly ?? false,
      }))
    ),
  ]);

  return resolvedUrl;
}