"use client";

import { useEffect, useRef } from "react";

import GuestGalleryRenderer from "@/components/gallery/GuestGalleryRenderer";
import { resolveGuestGalleryViewModel } from "@/lib/guestGalleryViewModel";
import type { Gallery } from "@/lib/galleryModel";
import type { VaultItem } from "@/lib/vaultModel";

type Props = {
  gallery: Gallery;
  items: VaultItem[];
  onHeightChange?: (height: number) => void;
};

export default function BuilderPreviewBridge({ gallery, items, onHeightChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const model = resolveGuestGalleryViewModel(gallery, items, {
    navigation: { show: false },
    access: { modeLabel: "Preview", isPublic: true },
  });

  useEffect(() => {
    if (!onHeightChange || !containerRef.current || typeof ResizeObserver === "undefined") return;

    const element = containerRef.current;
    const reportHeight = () => {
      const nextHeight = Math.ceil(element.getBoundingClientRect().height || element.offsetHeight || 0);
      if (nextHeight > 0) {
        onHeightChange(nextHeight);
      }
    };

    reportHeight();

    const observer = new ResizeObserver(() => {
      reportHeight();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightChange, model.galleryItems.length, model.displayMode, model.layoutType, model.themePack]);

  return (
    <div ref={containerRef}>
      <GuestGalleryRenderer model={model} embedded />
    </div>
  );
}
