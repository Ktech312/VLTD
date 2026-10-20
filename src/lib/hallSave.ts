// Save as Hall: build ONE private exhibition from the selected items and STORE it through the same path every other exhibition uses
// (saveGalleries: written on this device, then uploaded; the cloud status pill reports the upload).
//
// Found by the audit (VLT-256, VLT-288): the page called createGallery(), which only BUILDS an object, and then updateGallery() /
// setGalleryItemIds(), which only change galleries that are already stored. Nothing was stored, yet the page opened the new id
// ("Exhibition not found"). The hall is now stored first, read back, and only then opened.
import { createGallery, loadAllGalleries, loadGalleries, saveGalleries, setGalleryItemIds } from "@/lib/galleryModel";
import { getGalleryLimits } from "@/lib/galleryTier";
import { getUserBonusGalleries } from "@/lib/referral";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getTierSafe } from "@/lib/subscription";

/** True when this account may not create another exhibition (the same limit the Create Exhibition page applies). */
export function exhibitionLimitReached(existingCount: number, baseLimit: number, bonus: number): boolean {
  if (baseLimit === Infinity) return false;
  return existingCount >= baseLimit + Math.max(0, bonus);
}

async function bonusExhibitions(): Promise<number> {
  try {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return 0;
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return 0;
    return await getUserBonusGalleries(data.user.id);
  } catch {
    return 0;
  }
}

export type SaveHallResult = { ok: true; galleryId: string } | { ok: false; error: string; galleryId?: string };

/**
 * `reuseId` makes a retry after a failure update the SAME hall instead of creating a second one.
 */
export async function saveHall(title: string, itemIds: string[], reuseId?: string): Promise<SaveHallResult> {
  if (itemIds.length === 0) return { ok: false, error: "Select at least one item first." };

  const existing = reuseId ? loadAllGalleries().find((g) => g.id === reuseId) : undefined;
  if (!existing) {
    const limits = getGalleryLimits(getTierSafe());
    const current = loadGalleries().length;
    if (exhibitionLimitReached(current, limits.galleries, limits.galleries === Infinity ? 0 : await bonusExhibitions())) {
      return { ok: false, error: "You have reached your exhibition limit, so this Hall was not created. Remove an exhibition or upgrade, then try again." };
    }
  }

  let id = existing?.id ?? reuseId;
  try {
    if (!existing) {
      const hall = { ...createGallery(title), visibility: "LOCKED" as const };
      id = hall.id;
      // Stored first, alongside everything already stored (all profiles, so nothing else is touched).
      saveGalleries([...loadAllGalleries(), hall]);
    }
    setGalleryItemIds(id!, itemIds);
  } catch (e) {
    console.error("save hall failed", e);
    return { ok: false, galleryId: id, error: "The Hall could not be saved on this device. Nothing was lost: try again." };
  }

  // Read it back: never open (or report) a hall that is not actually stored with its items.
  const stored = loadAllGalleries().find((g) => g.id === id);
  if (!stored || stored.itemIds.length !== new Set(itemIds.map(String)).size) {
    return { ok: false, galleryId: id, error: "The Hall could not be confirmed after saving. Try again." };
  }
  return { ok: true, galleryId: stored.id };
}
