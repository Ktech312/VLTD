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

// One pass over the exhibitions answers every item. Each card on the Vault asks "which exhibits hold me, am I hidden there" when it
// appears, and each answer used to re-read, repair and compare the whole saved exhibition list (60 cards = 120 full reads per page).
// The answer is remembered against the exact stored text of the list, so any save (here or in another tab) rebuilds it.
const GALLERIES_STORAGE_KEY = "vltd_galleries"; // same key as galleryModel
let exhibitIndex: { stored: string | null; names: Map<string, string[]>; hidden: Set<string> } | null = null;

function readStoredGalleries(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(GALLERIES_STORAGE_KEY);
  } catch {
    return null;
  }
}

function buildExhibitIndex() {
  const names = new Map<string, string[]>();
  const hidden = new Set<string>();
  for (const gallery of loadGalleries({ includeAllProfiles: true })) {
    const held = new Set(gallery.itemIds);
    for (const snapshot of gallery.publicItemSnapshots ?? []) {
      if (snapshot.hidden === true && held.has(snapshot.id)) hidden.add(snapshot.id);
    }
    const titlesByItem = new Map<string, string[]>();
    for (const section of getGallerySections(gallery)) {
      const title = section.title?.trim();
      const shown = title && title !== "Untitled Section" ? title : gallery.title || "Exhibit";
      for (const id of section.itemIds) {
        const list = titlesByItem.get(id) ?? [];
        list.push(shown);
        titlesByItem.set(id, list);
      }
    }
    for (const id of held) {
      const list = names.get(id) ?? [];
      const inSections = titlesByItem.get(id);
      if (inSections && inSections.length > 0) list.push(...inSections);
      else list.push(gallery.title || "Exhibition");
      names.set(id, list);
    }
  }
  for (const [id, list] of names) names.set(id, Array.from(new Set(list)));
  // Read the text AFTER the list was loaded: loading can tidy and re-save it.
  exhibitIndex = { stored: readStoredGalleries(), names, hidden };
  return exhibitIndex;
}

function currentExhibitIndex() {
  const stored = readStoredGalleries();
  if (exhibitIndex && exhibitIndex.stored === stored) return exhibitIndex;
  return buildExhibitIndex();
}

/** Names of the exhibits this item sits in, for the "this will hide it" note. */
export function exhibitNamesForItem(itemId: string): string[] {
  return [...(currentExhibitIndex().names.get(itemId) ?? [])];
}

/** True when the item is hidden in any exhibit that holds it. */
export function isHiddenInExhibits(itemId: string): boolean {
  return currentExhibitIndex().hidden.has(itemId);
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
