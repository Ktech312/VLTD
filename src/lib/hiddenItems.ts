import {
  loadGalleries,
  saveGalleriesLocally,
  syncGalleryToSupabaseNow,
  getGallerySections,
  type Gallery,
  type GalleryPublicItemSnapshot,
} from "@/lib/galleryModel";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";

export const HIDDEN_ITEM_TITLE = "Hidden Item";

// Plain grey picture used when no blurred thumbnail could be made.
const GREY_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='90' height='120' viewBox='0 0 90 120'><rect width='90' height='120' fill='#3a3f47'/></svg>"
  );

/** What visitors see in place of an item the owner has hidden. */
export function hiddenStubItem(id: string, createdAt?: number, blurThumb?: string): VaultItem {
  return {
    id,
    title: HIDDEN_ITEM_TITLE,
    imageFrontUrl: blurThumb || GREY_IMAGE,
    createdAt: typeof createdAt === "number" && Number.isFinite(createdAt) ? createdAt : Date.now(),
    isNew: false,
    hiddenItem: true,
  };
}

/** Turns a saved public record back into an item for a public page (hidden ones become the stub). */
export function vaultItemFromPublicSnapshot(snapshot: GalleryPublicItemSnapshot): VaultItem {
  if (snapshot.hidden) return hiddenStubItem(snapshot.id, snapshot.createdAt, snapshot.blurThumb);
  return {
    id: String(snapshot.id ?? "").trim(),
    title: String(snapshot.title ?? "").trim() || "Untitled Item",
    subtitle: snapshot.subtitle,
    number: snapshot.number,
    grade: snapshot.grade,
    year: snapshot.year,
    notes: snapshot.description,
    categoryLabel: snapshot.categoryLabel,
    subcategoryLabel: snapshot.subcategoryLabel,
    imageFrontUrl: snapshot.imageFrontUrl,
    imageBackUrl: snapshot.imageBackUrl,
    imageFrontStoragePath: snapshot.imageFrontStoragePath,
    primaryImageKey: snapshot.primaryImageKey,
    createdAt:
      typeof snapshot.createdAt === "number" && Number.isFinite(snapshot.createdAt) ? snapshot.createdAt : Date.now(),
    isNew: false,
  };
}

/** The public record for a hidden item: no title, no photo, only a tiny grey blur. */
export function hiddenSnapshot(id: string, createdAt?: number, blurThumb?: string): GalleryPublicItemSnapshot {
  return { id, title: HIDDEN_ITEM_TITLE, hidden: true, blurThumb, createdAt };
}

/** The public record for an item. A hidden item stays hidden until it is made public again. */
export function buildPublicSnapshot(item: VaultItem, previous?: GalleryPublicItemSnapshot): GalleryPublicItemSnapshot {
  if (previous?.hidden && item.isPublic !== true) {
    return hiddenSnapshot(item.id, item.createdAt, previous.blurThumb);
  }
  return {
    id: item.id,
    title: item.title || "Untitled Item",
    subtitle: item.subtitle,
    number: item.number,
    grade: item.grade,
    year: item.year,
    description: item.description,
    categoryLabel: item.categoryLabel || item.customCategoryLabel || item.category,
    subcategoryLabel: item.subcategoryLabel,
    imageFrontUrl: item.imageFrontUrl,
    imageBackUrl: item.imageBackUrl,
    imageFrontStoragePath: item.imageFrontStoragePath,
    primaryImageKey: item.primaryImageKey,
    createdAt: item.createdAt,
  };
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed"));
    img.src = src;
  });
}

function toTinyGrey(img: HTMLImageElement): string {
  const w = 18;
  const h = 24;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < data.data.length; i += 4) {
    const g = Math.round(data.data[i] * 0.3 + data.data[i + 1] * 0.59 + data.data[i + 2] * 0.11);
    const soft = Math.round(g * 0.7 + 40);
    data.data[i] = soft;
    data.data[i + 1] = soft;
    data.data[i + 2] = soft;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.6);
}

/**
 * A tiny greyscale copy of the item's photo (18x24). Shown enlarged it reads as a grey fuzz,
 * and the real photo's address is never published. Returns undefined if it can't be made.
 */
export async function makeBlurThumb(item: VaultItem): Promise<string | undefined> {
  if (typeof document === "undefined") return undefined;
  const url = getPrimaryImageUrl(item);
  if (!url || !/^https?:/i.test(url)) return undefined;
  try {
    return toTinyGrey(await loadImage(url));
  } catch {
    try {
      return toTinyGrey(await loadImage(`/api/image-proxy?url=${encodeURIComponent(url)}`));
    } catch {
      return undefined;
    }
  }
}

/** Names of the exhibits this item sits in, for the "this will hide it" note. */
export function exhibitNamesForItem(itemId: string): string[] {
  const names: string[] = [];
  for (const gallery of loadGalleries({ includeAllProfiles: true })) {
    if (!gallery.itemIds.includes(itemId)) continue;
    const sections = getGallerySections(gallery).filter((section) => section.itemIds.includes(itemId));
    if (sections.length === 0) {
      names.push(gallery.title || "Exhibition");
      continue;
    }
    for (const section of sections) {
      const title = section.title?.trim();
      names.push(title && title !== "Untitled Section" ? title : gallery.title || "Exhibit");
    }
  }
  return Array.from(new Set(names));
}

/** True when the item is hidden in any exhibit that holds it. */
export function isHiddenInExhibits(itemId: string): boolean {
  return loadGalleries({ includeAllProfiles: true }).some(
    (gallery) =>
      gallery.itemIds.includes(itemId) &&
      (gallery.publicItemSnapshots ?? []).some((snapshot) => snapshot.id === itemId && snapshot.hidden === true)
  );
}

/** After an item is hidden or shown again, update every exhibit that holds it. */
export async function applyVisibilityToExhibits(
  item: VaultItem,
  blurThumb?: string,
  action: "hide" | "show" = item.isPublic === true ? "show" : "hide"
) {
  const all = loadGalleries({ includeAllProfiles: true });
  const changed: Gallery[] = [];
  const next = all.map((gallery) => {
    if (!gallery.itemIds.includes(item.id)) return gallery;
    const snapshots = Array.isArray(gallery.publicItemSnapshots) ? gallery.publicItemSnapshots : [];
    const entry =
      action === "show" ? buildPublicSnapshot(item) : hiddenSnapshot(item.id, item.createdAt, blurThumb);
    const found = snapshots.some((snapshot) => snapshot.id === item.id);
    const updated: Gallery = {
      ...gallery,
      publicItemSnapshots: found
        ? snapshots.map((snapshot) => (snapshot.id === item.id ? entry : snapshot))
        : [...snapshots, entry],
      updatedAt: Date.now(),
    };
    changed.push(updated);
    return updated;
  });
  if (changed.length === 0) return;
  saveGalleriesLocally(next);
  for (const gallery of changed) {
    try {
      await syncGalleryToSupabaseNow(gallery);
    } catch (error) {
      console.error("Could not update an exhibit after hiding an item:", error);
    }
  }
}
