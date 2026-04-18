"use client";

import GuestGalleryRenderer from "@/components/gallery/GuestGalleryRenderer";
import { resolveGuestGalleryViewModel } from "@/lib/guestGalleryViewModel";

export default function BuilderPreviewBridge({ gallery, items }) {
  const model = resolveGuestGalleryViewModel(gallery, items, {
    navigation: { show: false },
    access: { modeLabel: "Preview", isPublic: true },
  });

  return <GuestGalleryRenderer model={model} />;
}
