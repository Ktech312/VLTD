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

  // FREE tier
  return {
    galleries: 4,         // 4 public exhibitions max
    storage: 1,
    freeStorageDays: 90,
  };
}

/** Free tier vault item cap */
export const FREE_VAULT_ITEM_LIMIT = 50;

export function getVaultItemLimit(tier: Tier): number {
  if (tier === "FREE") return FREE_VAULT_ITEM_LIMIT;
  return Infinity;
}

/**
 * Free tier can only have PUBLIC exhibitions.
 * Returns true if the tier forces all galleries to be PUBLIC.
 */
export function mustBePublicGallery(tier: Tier): boolean {
  return tier === "FREE";
}

/** Image quality settings per tier */
export function getImageUploadOptions(tier: Tier): { maxDimension: number; quality: number } {
  if (tier === "FREE") {
    return { maxDimension: 900, quality: 0.65 }; // good but not HD
  }
  return { maxDimension: 1600, quality: 0.82 }; // full quality
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