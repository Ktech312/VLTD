"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import GuestGalleryRenderer from "@/components/gallery/GuestGalleryRenderer";
import {
  getGalleryById,
  recordGalleryView,
  type Gallery,
} from "@/lib/galleryModel";
import { resolveGuestGalleryViewModel } from "@/lib/guestGalleryViewModel";
import { loadItems, type VaultItem } from "@/lib/vaultModel";

export default function GuestGalleryPage() {
  const params = useParams<{ galleryId: string }>();
  const galleryId = String(params?.galleryId ?? "");

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    if (!galleryId) return;

    const found = getGalleryById(galleryId);
    setGallery(found);
    setItems(loadItems());
    setIsResolved(true);

    if (found) {
      recordGalleryView(found.id);
    }
  }, [galleryId]);

  const model = useMemo(
    () =>
      resolveGuestGalleryViewModel(gallery, items, {
        navigation: {
          show: !!gallery,
          primaryLabel: "Gallery as Guest",
          backHref: gallery ? `/museum/${gallery.id}` : null,
          homeHref: "/museum",
        },
        access: {
          modeLabel: "Guest Preview",
          isPublic: true,
        },
      }),
    [gallery, items]
  );

  if (isResolved && !gallery) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(30,36,46,0.96),rgba(8,10,14,1)_62%)] text-white">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] border border-white/10 bg-black/25 p-8 text-center ring-1 ring-white/10 backdrop-blur-sm">
            <div className="text-[11px] tracking-[0.22em] text-white/55">GUEST PREVIEW</div>
            <h1 className="mt-3 text-2xl font-semibold">Gallery not available</h1>
            <p className="mt-3 text-sm text-white/70">
              This gallery could not be loaded for guest preview.
            </p>
            <div className="mt-6">
              <Link
                href="/museum"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-95"
              >
                Open Museum
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!gallery) return null;

  return <GuestGalleryRenderer model={model} />;
}
