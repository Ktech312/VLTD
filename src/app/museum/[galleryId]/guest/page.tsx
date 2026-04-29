"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import GuestGalleryRenderer from "@/components/gallery/GuestGalleryRenderer";
import {
  getGalleryById,
  recordGalleryView,
  type Gallery,
  type GalleryPublicItemSnapshot,
} from "@/lib/galleryModel";
import { resolveGuestGalleryViewModel } from "@/lib/guestGalleryViewModel";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { AdultContentGate, ReportContentButton, useAdultGate } from "@/components/PublicSafetyControls";

function vaultItemFromGallerySnapshot(snapshot: GalleryPublicItemSnapshot): VaultItem {
  return {
    id: String(snapshot.id ?? "").trim(),
    title: String(snapshot.title ?? "").trim() || "Untitled Item",
    subtitle: typeof snapshot.subtitle === "string" ? snapshot.subtitle : undefined,
    number: typeof snapshot.number === "string" ? snapshot.number : undefined,
    grade: typeof snapshot.grade === "string" ? snapshot.grade : undefined,
    currentValue:
      typeof snapshot.currentValue === "number" && Number.isFinite(snapshot.currentValue)
        ? snapshot.currentValue
        : undefined,
    imageFrontUrl: typeof snapshot.imageFrontUrl === "string" ? snapshot.imageFrontUrl : undefined,
    imageBackUrl: typeof snapshot.imageBackUrl === "string" ? snapshot.imageBackUrl : undefined,
    imageFrontStoragePath:
      typeof snapshot.imageFrontStoragePath === "string" ? snapshot.imageFrontStoragePath : undefined,
    primaryImageKey:
      typeof snapshot.primaryImageKey === "string" ? snapshot.primaryImageKey : undefined,
    createdAt:
      typeof snapshot.createdAt === "number" && Number.isFinite(snapshot.createdAt)
        ? snapshot.createdAt
        : Date.now(),
    isNew: false,
  };
}

export default function GuestGalleryPage() {
  const params = useParams<{ galleryId: string }>();
  const galleryId = String(params?.galleryId ?? "");

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    if (!galleryId) return;

    let cancelled = false;

    async function resolveGuestPage() {
      const found = getGalleryById(galleryId);
      if (cancelled) return;

      setGallery(found);

      await syncVaultItemsFromSupabase();
      if (cancelled) return;

      setItems(loadItems());
      setIsResolved(true);

      if (found) {
        recordGalleryView(found.id);
      }
    }

    void resolveGuestPage();

    function onVaultUpdate() {
      setItems(loadItems());
    }

    window.addEventListener("vltd:vault-updated", onVaultUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("vltd:vault-updated", onVaultUpdate);
    };
  }, [galleryId]);

  const resolvedItems = useMemo(() => {
    if (!gallery) return items;

    const byId = new Map(items.map((item) => [item.id, item]));
    const snapshotById = new Map(
      (gallery.publicItemSnapshots ?? []).map((snapshot) => [snapshot.id, snapshot])
    );

    const ordered = gallery.itemIds
      .map((itemId) => {
        const hydrated = byId.get(itemId);
        if (hydrated) return hydrated;
        const snapshot = snapshotById.get(itemId);
        return snapshot ? vaultItemFromGallerySnapshot(snapshot) : undefined;
      })
      .filter(Boolean) as VaultItem[];

    return ordered.length > 0
      ? ordered
      : Array.isArray(gallery.publicItemSnapshots)
        ? gallery.publicItemSnapshots.map(vaultItemFromGallerySnapshot)
        : [];
  }, [gallery, items]);

  const model = useMemo(
    () =>
      resolveGuestGalleryViewModel(gallery, resolvedItems, {
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
    [gallery, resolvedItems]
  );

  const adultGate = useAdultGate(gallery?.adultOnly === true);

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

  if (adultGate.shouldGate) {
    return <AdultContentGate onConfirm={adultGate.confirm} />;
  }

  return (
    <>
      <div className="fixed right-4 top-4 z-40">
        <ReportContentButton contentType="gallery" contentId={gallery.id} />
      </div>
      <GuestGalleryRenderer model={model} />
    </>
  );
}
