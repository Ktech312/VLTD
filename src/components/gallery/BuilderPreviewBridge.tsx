"use client";

import GuestGalleryRenderer from "@/components/gallery/GuestGalleryRenderer";
import { resolveGuestGalleryViewModel } from "@/lib/guestGalleryViewModel";
import type { Gallery } from "@/lib/galleryModel";
import type { VaultItem } from "@/lib/vaultModel";

type Props = {
  gallery: Gallery;
  items: VaultItem[];
};

export default function BuilderPreviewBridge({ gallery, items }: Props) {
  const model = resolveGuestGalleryViewModel(gallery, items, {
    navigation: { show: false },
    access: { modeLabel: "Preview", isPublic: true },
  });

  return <GuestGalleryRenderer model={model} embedded />;
}
