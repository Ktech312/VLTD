"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { loadGalleries } from "@/lib/galleryModel";
import { loadItems } from "@/lib/vaultModel";
import { canViewPublicGallery, isAdultOnlyGallery } from "@/lib/galleryPublic";
import { addWishlistItem } from "@/lib/wishlistModel";
import FavoriteButton from "@/components/FavoriteButton";
import { AdultContentGate, ReportContentButton, useAdultGate } from "@/components/PublicSafetyControls";
import SwipeStack from "@/components/SwipeStack";

import GalleryHero from "@/components/gallery/GalleryHero";
import GalleryLayout from "@/components/gallery/GalleryLayout";

export default function PublicGalleryPage() {

  const params = useParams();
  const router = useRouter();
  const id = params.galleryId as string;

  const [galleryMode, setGalleryMode] = useState<"grid" | "swipe">("grid");

  const gallery = useMemo(() => {
    const galleries = loadGalleries();
    return galleries.find((entry) => entry.id === id) ?? null;
  }, [id]);
  const items = useMemo(() => loadItems(), []);

  const galleryItems = useMemo(()=>{

    if(!gallery) return [];

    return items.filter(i => gallery.itemIds.includes(i.id));

  },[gallery,items])

  const adultGate = useAdultGate(isAdultOnlyGallery(gallery));

  if(!gallery) return null;

  if(!canViewPublicGallery(gallery)){

    return (
      <main className="min-h-screen text-[color:var(--fg)]">

        <div className="mx-auto max-w-4xl px-6 py-16">

          <div className="text-2xl font-semibold">
            This gallery is private
          </div>

          <div className="mt-2 text-sm opacity-70">
            The owner has restricted public access.
          </div>

        </div>

      </main>
    )
  }

  if (adultGate.shouldGate) {
    return <AdultContentGate onConfirm={adultGate.confirm} />;
  }

  return (

    <main className="min-h-screen text-[color:var(--fg)]">

      <div className="fixed right-4 top-4 z-40 flex flex-col items-end gap-2">
        <FavoriteButton
          contentType="gallery"
          contentId={gallery.id}
          metadata={{ title: gallery.title, itemCount: gallery.itemIds.length }}
          label="Favorite gallery"
          compact
        />
        <ReportContentButton contentType="gallery" contentId={gallery.id} />
      </div>

      <GalleryHero gallery={gallery} />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={() => setGalleryMode((current) => (current === "grid" ? "swipe" : "grid"))}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition"
            style={
              galleryMode === "swipe"
                ? {
                    background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
                    borderColor: "var(--theme-gold-border, rgba(245,181,72,0.4))",
                    color: "var(--theme-gold, #F5B548)",
                  }
                : {
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--muted)",
                  }
            }
          >
            {galleryMode === "swipe" ? "Swipe Mode" : "Swipe"}
          </button>
        </div>

        {galleryMode === "swipe" ? (
          <div className="mx-auto max-w-sm px-4 pt-4">
            <SwipeStack
              items={galleryItems}
              mode="gallery"
              onWant={(item) => {
                addWishlistItem({
                  title: item.title,
                  targetPrice: item.currentValue ?? undefined,
                  notes: `Spotted in ${gallery.title}'s gallery`,
                  universe: item.universe,
                  category: item.category,
                });
              }}
              onOpen={(item) => {
                router.push(`/vault/item/${item.id}`);
              }}
              onEnd={() => setGalleryMode("grid")}
            />
          </div>
        ) : (
          <GalleryLayout
            layout={gallery.layout}
            items={galleryItems}
          />
        )}

      </div>

    </main>
  )
}
