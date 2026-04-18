import {
  type Gallery,
  type GalleryDisplayMode,
  type GalleryGuestViewMode,
  type GalleryThemePack,
  getGalleryDisplayMode,
  getGalleryGuestViewMode,
  getGalleryLayoutType,
  getGalleryShelfBackground,
  getGalleryThemeBackground,
  getGalleryThemePack,
} from "@/lib/galleryModel";
import type { VaultItem } from "@/lib/vaultModel";

export type GuestBackgroundType = "blank" | "theme" | "upload";

export type GuestGalleryBackground = {
  type: GuestBackgroundType;
  url: string | null;
  themeKey: GalleryThemePack | null;
};

export type GuestGalleryNavigation = {
  show: boolean;
  primaryLabel?: string;
  backHref?: string | null;
  homeHref?: string | null;
};

export type GuestGalleryAccess = {
  modeLabel: string;
  isPublic: boolean;
};

export type GuestGalleryViewModel = {
  gallery: Gallery | null;
  galleryId: string | null;
  galleryTitle: string;
  galleryDescription: string;
  galleryItems: VaultItem[];
  totalValue: number;
  themePack: GalleryThemePack;
  displayMode: GalleryDisplayMode;
  guestViewMode: GalleryGuestViewMode;
  layoutType: string;
  shelvesEnabled: boolean;
  background: GuestGalleryBackground;
  navigation: GuestGalleryNavigation;
  access: GuestGalleryAccess;
};

export function resolveGuestGalleryBackground(
  gallery: Gallery | null | undefined
): GuestGalleryBackground {
  const themePack = getGalleryThemePack(gallery);
  const uploaded = getGalleryShelfBackground(gallery).trim();

  if (uploaded) {
    return {
      type: "upload",
      url: uploaded,
      themeKey: themePack,
    };
  }

  const themed = getGalleryThemeBackground(themePack);

  if (themed) {
    return {
      type: "theme",
      url: themed,
      themeKey: themePack,
    };
  }

  return {
    type: "blank",
    url: null,
    themeKey: themePack,
  };
}

export function resolveGuestGalleryViewModel(
  gallery: Gallery | null | undefined,
  items: VaultItem[],
  options?: {
    navigation?: GuestGalleryNavigation;
    access?: GuestGalleryAccess;
    itemsAreResolvedGalleryItems?: boolean;
  }
): GuestGalleryViewModel {
  const safeGallery = gallery ?? null;
  const galleryItems = options?.itemsAreResolvedGalleryItems
    ? items
    : safeGallery
      ? safeGallery.itemIds
          .map((itemId) => items.find((item) => item.id === itemId))
          .filter(Boolean) as VaultItem[]
      : [];

  const totalValue = galleryItems.reduce(
    (sum, item) => sum + Number(item.currentValue ?? 0),
    0
  );

  const themePack = getGalleryThemePack(safeGallery);
  const displayMode = getGalleryDisplayMode(safeGallery);
  const guestViewMode = getGalleryGuestViewMode(safeGallery);
  const layoutType = getGalleryLayoutType(safeGallery);

  return {
    gallery: safeGallery,
    galleryId: safeGallery?.id ?? null,
    galleryTitle: safeGallery?.title || "Untitled Gallery",
    galleryDescription:
      safeGallery?.description?.trim() || "Curated collection presentation",
    galleryItems,
    totalValue,
    themePack,
    displayMode,
    guestViewMode,
    layoutType,
    shelvesEnabled: displayMode === "shelf",
    background: resolveGuestGalleryBackground(safeGallery),
    navigation: options?.navigation ?? {
      show: false,
      backHref: null,
      homeHref: null,
    },
    access: options?.access ?? {
      modeLabel: guestViewMode === "public" ? "Guest Preview" : "Shared Gallery",
      isPublic: guestViewMode === "public",
    },
  };
}
