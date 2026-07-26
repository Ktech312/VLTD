"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { loadGalleries, deleteGallery } from "@/lib/galleryModel";
import { loadItems } from "@/lib/vaultModel";
import { canViewPublicGallery, isAdultOnlyGallery } from "@/lib/galleryPublic";
import { addWishlistItem } from "@/lib/wishlistModel";
import { AdultContentGate, useAdultGate } from "@/components/PublicSafetyControls";
import SwipeStack from "@/components/SwipeStack";

import GalleryHero from "@/components/gallery/GalleryHero";
import GalleryLayout from "@/components/gallery/GalleryLayout";

export default function PublicGalleryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.galleryId as string;

  const [galleryMode, setGalleryMode] = useState<"grid" | "swipe">("grid");
  const [reportSent, setReportSent] = useState(false);

  const gallery = useMemo(() => {
    const galleries = loadGalleries();
    return galleries.find((entry) => entry.id === id) ?? null;
  }, [id]);

  const items = useMemo(() => loadItems(), []);

  const galleryItems = useMemo(() => {
    if (!gallery) return [];
    return items.filter((i) => gallery.itemIds.includes(i.id));
  }, [gallery, items]);

  // If found via loadGalleries() (local storage), the viewer is the owner
  const isOwner = gallery !== null;

  const adultGate = useAdultGate(isAdultOnlyGallery(gallery));

  function handleDelete() {
    if (!gallery) return;
    if (!confirm("Delete this exhibit? This cannot be undone.")) return;
    deleteGallery(gallery.id);
    router.push("/museum");
  }

  function handleReport() {
    setReportSent(true);
    setTimeout(() => setReportSent(false), 3000);
  }

  if (!gallery) {
    return (
      <main className="text-[color:var(--fg)]">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="text-2xl font-semibold">This exhibit is private</div>
          <div className="mt-2 text-sm opacity-70">The owner has restricted public access.</div>
        </div>
      </main>
    );
  }

  if (!canViewPublicGallery(gallery)) {
    return (
      <main className="text-[color:var(--fg)]">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="text-2xl font-semibold">This exhibit is private</div>
          <div className="mt-2 text-sm opacity-70">The owner has restricted public access.</div>
        </div>
      </main>
    );
  }

  if (adultGate.shouldGate) {
    return <AdultContentGate onConfirm={adultGate.confirm} />;
  }

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">

        {/* Hero with all controls embedded */}
        <GalleryHero
          gallery={gallery}
          isOwner={isOwner}
          galleryMode={galleryMode}
          onSwipe={() => setGalleryMode("swipe")}
          onGridView={() => setGalleryMode("grid")}
          onAdd={() => router.push(`/museum/${gallery.id}`)}
          onDelete={handleDelete}
          onReport={handleReport}
        />

        {reportSent && (
          <div className="mt-3 rounded-2xl px-4 py-3 text-sm text-center" style={{ background: "rgba(203,208,213,0.08)", border: "1px solid rgba(203,208,213,0.2)", color: "#C8CDD2" }}>
            Report submitted — thank you.
          </div>
        )}

        {/* Content */}
        <div className="mt-6">
          {/* Blank "add first item" card — shown in both modes when empty */}
          {galleryItems.length === 0 ? (
            <button
              type="button"
              onClick={() => router.push(`/museum/${gallery.id}`)}
              className="mx-auto flex w-full max-w-[200px] flex-col items-center justify-center gap-3 rounded-[24px] transition hover:scale-[1.02] active:scale-[0.98]"
              style={{
                aspectRatio: "2/3",
                background: "rgba(15,25,45,0.6)",
                border: "1.5px dashed rgba(203,208,213,0.35)",
                color: "#C8CDD2",
              }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: "rgba(203,208,213,0.12)", border: "1px solid rgba(203,208,213,0.3)", fontSize: "24px", fontWeight: 300 }}
              >
                +
              </span>
              <span className="text-sm font-semibold" style={{ color: "#A0956B" }}>Add first item</span>
            </button>
          ) : galleryMode === "swipe" ? (
            <div className="mx-auto max-w-sm px-4 pt-4">
              <SwipeStack
                items={galleryItems}
                mode="gallery"
                onWant={(item) => {
                  addWishlistItem({
                    title: item.title,
                    targetPrice: item.currentValue ?? undefined,
                    notes: `Spotted in ${gallery.title}'s exhibit`,
                    universe: item.universe,
                    category: item.category,
                  });
                }}
                onOpen={(item) => router.push(`/vault/item/${item.id}`)}
                onEnd={() => setGalleryMode("grid")}
              />
            </div>
          ) : (
            <GalleryLayout
              layout={gallery.layout}
              items={galleryItems}
              title={gallery.title}
            />
          )}
        </div>

      </div>
    </main>
  );
}
