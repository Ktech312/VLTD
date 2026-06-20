// Path: src/lib/galleryLayout.ts

export type GalleryLayout =
  | "GRID"
  | "SPOTLIGHT"
  | "TIMELINE"
  | "EDITORIAL";

export const GALLERY_LAYOUTS: GalleryLayout[] = [
  "GRID",
  "SPOTLIGHT",
  "TIMELINE",
  "EDITORIAL",
];

export function getGalleryLayoutLabel(layout: GalleryLayout) {
  switch (layout) {
    case "GRID":
      return "Grid";
    case "SPOTLIGHT":
      return "Spotlight";
    case "TIMELINE":
      return "Timeline";
    case "EDITORIAL":
      return "Editorial";
    default:
      return "Gallery";
  }
}

export function getDefaultGalleryLayout(): GalleryLayout {
  return "GRID";
}