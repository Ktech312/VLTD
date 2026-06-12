// Path: src/lib/galleryTier.ts
import { type Tier } from "./subscription";
import { type Gallery } from "./galleryModel";

export type GalleryVisibility = "PUBLIC" | "INVITE" | "LOCKED";
export type GalleryState = "ACTIVE" | "STORAGE";

export function getGalleryLimits(tier: Tier) {
  if (tier === "FULL") {
    return {
      galleries: Infinity,
      storage: Infinity,
      freeStorageDays: 0,
    };
  }

  if (tier === "MID") {
    return {
      galleries: 25,
      storage: Infinity,
      freeStorageDays: 0,
    };
  }

  return {
    galleries: 5,
    storage: 1,
    freeStorageDays: 90,
  };
}

export function canCreateGallery(tier: Tier, currentCount: number) {
  const limits = getGalleryLimits(tier);
  return limits.galleries === Infinity || currentCount < limits.galleries;
}

export function canMoveGalleryToStorage(params: {
  tier: Tier;
  gallery: Gallery;
  storageCount: number;
  now?: number;
}) {
  const { tier, gallery, storageCount, now = Date.now() } = params;
  const limits = getGalleryLimits(tier);

  if (tier === "FULL" || tier === "MID") {
    return { allowed: true as const, reason: "" };
  }

  if (storageCount >= limits.storage) {
    return {
      allowed: false as const,
      reason: "Free tier allows only 1 gallery in storage at a time.",
    };
  }

  const ageMs = now - gallery.createdAt;
  const maxAgeMs = limits.freeStorageDays * 24 * 60 * 60 * 1000;

  if (ageMs > maxAgeMs) {
    return {
      allowed: false as const,
      reason: "Free storage is only available during the first 90 days after gallery creation.",
    };
  }

  return { allowed: true as const, reason: "" };
}