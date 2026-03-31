// Path: src/lib/galleryPublic.ts

import { Gallery } from "./galleryModel";

export type PublicGalleryAccess =
  | "PUBLIC"
  | "INVITE"
  | "LOCKED";

export function canViewPublicGallery(g: Gallery) {
  if (g.visibility === "LOCKED") return false;
  return true;
}

export function isInviteOnly(g: Gallery) {
  return g.visibility === "INVITE";
}

export function isPublic(g: Gallery) {
  return g.visibility === "PUBLIC";
}