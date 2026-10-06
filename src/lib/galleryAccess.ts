import type { Gallery } from "@/lib/galleryModel";

// Who can see an exhibition, in the four plain choices people pick from. The create page and the
// exhibit page both use these, so the words and the behaviour never drift apart.
export type GalleryAccessPillMode = "private" | "public_gallery" | "guest_view" | "registered_users";

export const ACCESS_PILLS: { mode: GalleryAccessPillMode; label: string }[] = [
  { mode: "private", label: "Private" },
  { mode: "public_gallery", label: "Public Exhibit" },
  { mode: "guest_view", label: "Guest View" },
  { mode: "registered_users", label: "Registered Users" },
];

export function getAccessMode(gallery: Gallery | null | undefined): GalleryAccessPillMode {
  if (!gallery) return "private";
  if (gallery.guestViewMode === "guest") return "registered_users";
  if (gallery.visibility === "LOCKED") return "private";
  if (gallery.visibility === "INVITE") return "guest_view";
  return "public_gallery";
}

export function applyAccessMode(current: Gallery, mode: GalleryAccessPillMode): Gallery {
  if (mode === "private") {
    return {
      ...current,
      visibility: "LOCKED",
      guestViewMode: "public",
    };
  }

  if (mode === "registered_users") {
    return {
      ...current,
      visibility: "INVITE",
      guestViewMode: "guest",
    };
  }

  if (mode === "guest_view") {
    return {
      ...current,
      visibility: "INVITE",
      guestViewMode: "public",
    };
  }

  return {
    ...current,
    visibility: "PUBLIC",
    guestViewMode: "public",
  };
}

export function accessDescription(mode: GalleryAccessPillMode) {
  switch (mode) {
    case "public_gallery":
      return "Public Exhibition - Available to registered or unregistered users, searchable on Home page.";
    case "guest_view":
      return "Guest View - Anyone with access to the shared link can view your exhibition.";
    case "registered_users":
      return "Registered Users - Any registered user with access to the shared link can view your exhibition, allows analytics on views.";
    case "private":
    default:
      return "Private Exhibition - This only for yourself, good for exhibition test beds before sharing with anyone.";
  }
}
