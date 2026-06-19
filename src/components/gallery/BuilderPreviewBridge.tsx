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
  onRemoveItem?: (itemId: string) => void;
  onReorder?: (orderedIds: string[]) => void;
  /** When true, renders exactly as a guest would see it — no drag handles, real section nav */
  readOnly?: boolean;
};

export default function BuilderPreviewBridge({ gallery, items, onHeightChange, onRemoveItem, onReorder, readOnly }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const model = resolveGuestGalleryViewModel(gallery, items, {
    navigation: { show: false },
    access: { modeLabel: "Preview", isPublic: true },
    // readOnly passes all items and lets VM resolve order from gallery.itemIds (same as real guest)
    // embedded edit mode passes pre-filtered section items already in the right order
    itemsAreResolvedGalleryItems: !readOnly,
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
      {/* Gallery shelf is a virtual room — always dark regardless of app theme */}
      <div style={{ isolation: "isolate", background: "#0B1320", borderRadius: "16px", overflow: "hidden" }}>
        {readOnly ? (
          // Guest-accurate preview: same renderer, same logic, no editor chrome
          <GuestGalleryRenderer model={model} />
        ) : (
          // Edit mode: embedded with drag/reorder handles
          <GuestGalleryRenderer model={model} embedded onRemoveItem={onRemoveItem} onReorder={onReorder} />
        )}
      </div>
    </div>
  );
}
