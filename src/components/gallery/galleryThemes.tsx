// Path: src/components/gallery/galleryThemes.ts

export type GalleryThemeId =
  | "museum-noir"
  | "velvet-gold"
  | "vault-steel"
  | "ivory-minimal"
  | "neon-future";

export type ShelfStyleId =
  | "walnut"
  | "ebony"
  | "glass"
  | "steel"
  | "floating";

export type BackdropStyleId =
  | "charcoal"
  | "gallery-cream"
  | "midnight-blue"
  | "burgundy"
  | "emerald";

/**
 * Compatibility with the currently active museum theme pack system
 * already used in galleryModel / GalleryBuilder / museum pages.
 */
export type LegacyGalleryThemePack =
  | "classic"
  | "walnut"
  | "midnight"
  | "marble"
  | "cold-blue";

export type GalleryThemeDefinition = {
  id: GalleryThemeId;
  label: string;
  description: string;
  roomClass: string;
  panelClass: string;
  cardClass: string;
  shelfGlowClass: string;
  accentClass: string;
  heroOverlay: string;
};

export type ShelfStyleDefinition = {
  id: ShelfStyleId;
  label: string;
  shelfClass: string;
  lipClass: string;
  supportClass: string;
};

export type BackdropStyleDefinition = {
  id: BackdropStyleId;
  label: string;
  wallClass: string;
  vignetteClass: string;
};

export type ResolvedGalleryVisualTheme = {
  galleryTheme: GalleryThemeDefinition;
  shelfStyle: ShelfStyleDefinition;
  backdropStyle: BackdropStyleDefinition;
};

export type GalleryPresentationMode = "grid" | "shelf";

export type ResolvedGalleryPresentation = ResolvedGalleryVisualTheme & {
  themePack: LegacyGalleryThemePack;
  displayMode: GalleryPresentationMode;
  shelfBackground: string;
  heroShellClass: string;
  heroChipClass: string;
  galleryPanelClass: string;
  gridCardClass: string;
};

export const GALLERY_THEMES: GalleryThemeDefinition[] = [
  {
    id: "museum-noir",
    label: "Museum Noir",
    description: "Dark cinematic walls with spotlight contrast.",
    roomClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_22%),linear-gradient(180deg,#11161d_0%,#0a0d12_100%)]",
    panelClass: "bg-[rgba(10,12,16,0.68)] ring-white/10",
    cardClass:
      "bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] border-white/8",
    shelfGlowClass: "shadow-[0_18px_40px_rgba(0,0,0,0.45)]",
    accentClass: "text-amber-100",
    heroOverlay:
      "radial-gradient(circle_at_50%_0%,rgba(255,245,220,0.16),rgba(255,245,220,0)_40%)",
  },
  {
    id: "velvet-gold",
    label: "Velvet Gold",
    description: "Warm collector-room presentation with luxe tones.",
    roomClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,230,180,0.12),transparent_25%),linear-gradient(180deg,#3a1f1d_0%,#211212_100%)]",
    panelClass: "bg-[rgba(40,20,18,0.6)] ring-amber-200/10",
    cardClass:
      "bg-[linear-gradient(180deg,rgba(255,233,200,0.06),rgba(255,233,200,0.022))] border-amber-200/10",
    shelfGlowClass: "shadow-[0_18px_40px_rgba(30,10,8,0.42)]",
    accentClass: "text-amber-100",
    heroOverlay:
      "radial-gradient(circle_at_50%_0%,rgba(255,220,140,0.14),rgba(255,220,140,0)_44%)",
  },
  {
    id: "vault-steel",
    label: "Vault Steel",
    description: "Industrial steel gallery with cool reflections.",
    roomClass:
      "bg-[radial-gradient(circle_at_top,rgba(140,190,255,0.12),transparent_24%),linear-gradient(180deg,#1a2129_0%,#0c1015_100%)]",
    panelClass: "bg-[rgba(14,18,24,0.72)] ring-cyan-200/10",
    cardClass:
      "bg-[linear-gradient(180deg,rgba(190,220,255,0.045),rgba(190,220,255,0.015))] border-cyan-100/10",
    shelfGlowClass: "shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
    accentClass: "text-cyan-100",
    heroOverlay:
      "radial-gradient(circle_at_50%_0%,rgba(170,210,255,0.14),rgba(170,210,255,0)_42%)",
  },
  {
    id: "ivory-minimal",
    label: "Ivory Minimal",
    description: "Soft bright gallery with a cleaner museum finish.",
    roomClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6),transparent_26%),linear-gradient(180deg,#f5f1e8_0%,#e7e0d2_100%)]",
    panelClass: "bg-white/65 ring-black/8",
    cardClass:
      "bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.58))] border-black/8",
    shelfGlowClass: "shadow-[0_16px_30px_rgba(120,100,80,0.12)]",
    accentClass: "text-stone-800",
    heroOverlay:
      "radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.55),rgba(255,255,255,0)_40%)",
  },
  {
    id: "neon-future",
    label: "Neon Future",
    description: "Collector lab style with futuristic glow.",
    roomClass:
      "bg-[radial-gradient(circle_at_top,rgba(82,214,244,0.16),transparent_22%),radial-gradient(circle_at_80%_0%,rgba(150,21,219,0.16),transparent_26%),linear-gradient(180deg,#0c0d15_0%,#08090f_100%)]",
    panelClass: "bg-[rgba(8,10,16,0.74)] ring-fuchsia-300/10",
    cardClass:
      "bg-[linear-gradient(180deg,rgba(82,214,244,0.05),rgba(150,21,219,0.03))] border-white/8",
    shelfGlowClass:
      "shadow-[0_20px_46px_rgba(0,0,0,0.48),0_0_30px_rgba(82,214,244,0.08)]",
    accentClass: "text-cyan-100",
    heroOverlay:
      "radial-gradient(circle_at_50%_0%,rgba(82,214,244,0.16),rgba(82,214,244,0)_32%)",
  },
];

export const SHELF_STYLES: ShelfStyleDefinition[] = [
  {
    id: "walnut",
    label: "Walnut Shelf",
    shelfClass: "bg-[linear-gradient(180deg,#7b5736_0%,#4f341f_100%)]",
    lipClass: "bg-[linear-gradient(180deg,#8a6240_0%,#5a3921_100%)]",
    supportClass: "bg-[#3b2416]",
  },
  {
    id: "ebony",
    label: "Ebony Shelf",
    shelfClass: "bg-[linear-gradient(180deg,#343434_0%,#141414_100%)]",
    lipClass: "bg-[linear-gradient(180deg,#444_0%,#1f1f1f_100%)]",
    supportClass: "bg-[#111]",
  },
  {
    id: "glass",
    label: "Glass Shelf",
    shelfClass: "bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0.14))]",
    lipClass: "bg-[linear-gradient(180deg,rgba(255,255,255,0.4),rgba(255,255,255,0.18))]",
    supportClass: "bg-white/20",
  },
  {
    id: "steel",
    label: "Steel Shelf",
    shelfClass: "bg-[linear-gradient(180deg,#8793a1_0%,#4f5864_100%)]",
    lipClass: "bg-[linear-gradient(180deg,#99a6b5_0%,#606a77_100%)]",
    supportClass: "bg-[#404852]",
  },
  {
    id: "floating",
    label: "Floating Shelf",
    shelfClass: "bg-[linear-gradient(180deg,#d6c2a3_0%,#8f6c46_100%)]",
    lipClass: "bg-[linear-gradient(180deg,#e0ccb0_0%,#9c7750_100%)]",
    supportClass: "bg-transparent",
  },
];

export const BACKDROP_STYLES: BackdropStyleDefinition[] = [
  {
    id: "charcoal",
    label: "Charcoal Wall",
    wallClass: "bg-[linear-gradient(180deg,#20242c_0%,#11141a_100%)]",
    vignetteClass:
      "bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.28)_100%)]",
  },
  {
    id: "gallery-cream",
    label: "Gallery Cream",
    wallClass: "bg-[linear-gradient(180deg,#f6f1e6_0%,#ddd2be_100%)]",
    vignetteClass:
      "bg-[radial-gradient(circle_at_center,transparent_35%,rgba(90,70,40,0.08)_100%)]",
  },
  {
    id: "midnight-blue",
    label: "Midnight Blue",
    wallClass: "bg-[linear-gradient(180deg,#19253c_0%,#0b111c_100%)]",
    vignetteClass:
      "bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.22)_100%)]",
  },
  {
    id: "burgundy",
    label: "Burgundy",
    wallClass: "bg-[linear-gradient(180deg,#4a1e2a_0%,#1e0e14_100%)]",
    vignetteClass:
      "bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.22)_100%)]",
  },
  {
    id: "emerald",
    label: "Emerald",
    wallClass: "bg-[linear-gradient(180deg,#17362f_0%,#0b1815_100%)]",
    vignetteClass:
      "bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.22)_100%)]",
  },
];

export function getGalleryTheme(themeId?: string | null) {
  return GALLERY_THEMES.find((theme) => theme.id === themeId) ?? GALLERY_THEMES[0];
}

export function getShelfStyle(shelfId?: string | null) {
  return SHELF_STYLES.find((shelf) => shelf.id === shelfId) ?? SHELF_STYLES[0];
}

export function getBackdropStyle(backdropId?: string | null) {
  return (
    BACKDROP_STYLES.find((backdrop) => backdrop.id === backdropId) ??
    BACKDROP_STYLES[0]
  );
}

/**
 * Maps the current saved museum theme pack values to the richer gallery theme system.
 * This avoids breaking existing saved gallery data while letting the visual layer
 * use the more expressive theme/backdrop/shelf catalog.
 */
export function mapLegacyThemePackToGalleryThemeId(
  themePack?: string | null
): GalleryThemeId {
  switch (themePack) {
    case "walnut":
      return "velvet-gold";
    case "midnight":
      return "vault-steel";
    case "cold-blue":
      return "museum-noir";
    case "marble":
      return "ivory-minimal";
    case "classic":
    default:
      return "museum-noir";
  }
}

export function mapLegacyThemePackToShelfStyleId(
  themePack?: string | null
): ShelfStyleId {
  switch (themePack) {
    case "walnut":
      return "walnut";
    case "midnight":
      return "steel";
    case "cold-blue":
      return "ebony";
    case "marble":
      return "glass";
    case "classic":
    default:
      return "ebony";
  }
}

export function mapLegacyThemePackToBackdropStyleId(
  themePack?: string | null
): BackdropStyleId {
  switch (themePack) {
    case "walnut":
      return "burgundy";
    case "midnight":
      return "midnight-blue";
    case "cold-blue":
      return "charcoal";
    case "marble":
      return "gallery-cream";
    case "classic":
    default:
      return "charcoal";
  }
}

/**
 * Resolve visuals from either explicit rich theme IDs or the existing legacy
 * theme pack currently stored on galleries.
 */
export function resolveGalleryVisualTheme(input?: {
  themeId?: string | null;
  shelfStyleId?: string | null;
  backdropStyleId?: string | null;
  themePack?: string | null;
}): ResolvedGalleryVisualTheme {
  const galleryTheme = getGalleryTheme(
    input?.themeId ?? mapLegacyThemePackToGalleryThemeId(input?.themePack)
  );

  const shelfStyle = getShelfStyle(
    input?.shelfStyleId ?? mapLegacyThemePackToShelfStyleId(input?.themePack)
  );

  const backdropStyle = getBackdropStyle(
    input?.backdropStyleId ?? mapLegacyThemePackToBackdropStyleId(input?.themePack)
  );

  return {
    galleryTheme,
    shelfStyle,
    backdropStyle,
  };
}

export function getGalleryThemeOptions() {
  return GALLERY_THEMES;
}

export function getShelfStyleOptions() {
  return SHELF_STYLES;
}

export function getBackdropStyleOptions() {
  return BACKDROP_STYLES;
}
