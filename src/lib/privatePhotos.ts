"use client";

// Private Photos (paid feature) — see 20260919_private_photos.sql for the
// full architecture writeup and why this is a second, opt-in bucket rather
// than a signed-URL rewrite of every image in the app. Free accounts and
// every photo that's never been marked Private never touch any of this —
// they keep using vault-images (VAULT_IMAGES_BUCKET) exactly as before.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getStoredActiveProfileId } from "@/lib/auth";
import { getVaultImagePublicUrl, VAULT_IMAGES_BUCKET } from "@/lib/vaultCloud";
import type { VaultItem } from "@/lib/vaultModel";

export const VAULT_IMAGES_PRIVATE_BUCKET = "vault-images-private";

// Real, server-confirmed check — deliberately NOT getTierSafe() (that's a
// client-side localStorage cache a user could edit directly; fine for
// "which upsell copy to show," not fine for gating what's allowed to
// upload into a private, paid-only bucket). Reads the actual profiles.tier
// column for the active profile.
export async function canUsePrivatePhotos(): Promise<boolean> {
  const profileId = getStoredActiveProfileId();
  if (!profileId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data } = await supabase.from("profiles").select("tier").eq("id", profileId).maybeSingle();
  const tier = data?.tier ?? "FREE";
  return tier !== "FREE";
}

// ── Signed URL cache ────────────────────────────────────────────
// resolveVaultImageUrl() (vaultModel.ts) is a plain synchronous function
// called from ~28 places across the app (every card, gallery, museum
// room, etc.) — none of them can suddenly become async just for the
// handful of images someone's actually made private. Same
// stale-while-revalidate shape the rest of this app already uses for
// "cache locally, refetch in the background, re-render via the existing
// vltd:vault-updated event when new data lands" (see vaultSyncQueue.ts).
// A signed URL this cache hands out is only ever used by the owner's own
// signed-in session, so briefly showing a stale-but-still-valid cached
// one is harmless — the bucket's own RLS is the real gate either way.
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const inFlight = new Set<string>();

function dispatchVaultUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("vltd:vault-updated"));
}

async function fetchAndCacheSignedUrl(storageKey: string) {
  if (inFlight.has(storageKey)) return;
  inFlight.add(storageKey);
  try {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data, error } = await supabase.storage
      .from(VAULT_IMAGES_PRIVATE_BUCKET)
      .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return;
    signedUrlCache.set(storageKey, {
      url: data.signedUrl,
      // Refresh a little before actual expiry, not right at the edge.
      expiresAt: Date.now() + (SIGNED_URL_TTL_SECONDS - 60) * 1000,
    });
    dispatchVaultUpdated();
  } finally {
    inFlight.delete(storageKey);
  }
}

/**
 * Synchronous, like every other image URL resolver in this app. Returns a
 * cached signed URL immediately if one's already been fetched and hasn't
 * expired; otherwise kicks off a background fetch (fire-and-forget) and
 * returns "" for this call — the existing vltd:vault-updated event fires
 * once the real URL is ready, which is what every image-showing component
 * already re-renders on.
 */
export function resolvePrivateImageUrlSync(storageKey: string): string {
  const cached = signedUrlCache.get(storageKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  void fetchAndCacheSignedUrl(storageKey);
  return cached?.url ?? "";
}

// ── Migration between buckets ───────────────────────────────────
// Only ever touches the ONE item being toggled, on demand — never a bulk
// migration of existing data. Downloads each image's current bytes (its
// already-public URL is directly fetchable, no auth needed) and re-uploads
// them under the OTHER bucket's own folder convention, then removes the
// old copy so a photo is never live in both places at once.

async function downloadBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/** Moves every non-local image on this item from vault-images into vault-images-private. */
export async function migrateItemImagesToPrivate(item: VaultItem): Promise<VaultItem> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return item;
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData?.user?.id;
  if (!uid) return item;

  const images = [...(item.images ?? [])];
  const updated = await Promise.all(
    images.map(async (image) => {
      if (image.localOnly || image.isPrivateStorage || !image.storageKey) return image;
      const publicUrl = getVaultImagePublicUrl(image.storageKey);
      const blob = await downloadBlob(publicUrl);
      if (!blob) return image; // leave it exactly as-is rather than lose it

      const ext = image.storageKey.split(".").pop() || "jpg";
      const newPath = `${uid}/${item.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(VAULT_IMAGES_PRIVATE_BUCKET)
        .upload(newPath, blob, { cacheControl: "3600", upsert: false, contentType: blob.type || "image/jpeg" });
      if (uploadError) return image;

      await supabase.storage.from(VAULT_IMAGES_BUCKET).remove([image.storageKey]);

      return { ...image, storageKey: newPath, isPrivateStorage: true, url: undefined };
    })
  );

  return { ...item, images: updated };
}

/** Reverses migrateItemImagesToPrivate — moves images back to the public bucket. */
export async function migrateItemImagesToPublic(item: VaultItem): Promise<VaultItem> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return item;

  const images = [...(item.images ?? [])];
  const updated = await Promise.all(
    images.map(async (image) => {
      if (image.localOnly || !image.isPrivateStorage || !image.storageKey) return image;
      const { data: signed, error: signError } = await supabase.storage
        .from(VAULT_IMAGES_PRIVATE_BUCKET)
        .createSignedUrl(image.storageKey, 300);
      if (signError || !signed?.signedUrl) return image;
      const blob = await downloadBlob(signed.signedUrl);
      if (!blob) return image;

      const ext = image.storageKey.split(".").pop() || "jpg";
      const newPath = `items/${item.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(VAULT_IMAGES_BUCKET)
        .upload(newPath, blob, { cacheControl: "3600", upsert: false, contentType: blob.type || "image/jpeg" });
      if (uploadError) return image;

      await supabase.storage.from(VAULT_IMAGES_PRIVATE_BUCKET).remove([image.storageKey]);

      return { ...image, storageKey: newPath, isPrivateStorage: false, url: undefined };
    })
  );

  return { ...item, images: updated };
}
