"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { loadGalleries, type Gallery } from "@/lib/galleryModel";
import { loadItems, type VaultItem } from "@/lib/vaultModel";
import { canViewPublicGallery, isAdultOnlyGallery } from "@/lib/galleryPublic";
import { AdultContentGate, ReportContentButton, useAdultGate } from "@/components/PublicSafetyControls";

import GalleryHero from "@/components/gallery/GalleryHero";
import GalleryLayout from "@/components/gallery/GalleryLayout";

export default function PublicGalleryPage() {

  const params = useParams();
  const id = params.galleryId as string;

  const [gallery,setGallery] = useState<Gallery | null>(null);
  const [items,setItems] = useState<VaultItem[]>([]);

  useEffect(()=>{

    const galleries = loadGalleries();
    const g = galleries.find(x=>x.id === id) ?? null;

    setGallery(g);
    setItems(loadItems());

  },[id])

  const galleryItems = useMemo(()=>{

    if(!gallery) return [];

    return items.filter(i => gallery.itemIds.includes(i.id));

  },[gallery,items])

  const adultGate = useAdultGate(isAdultOnlyGallery(gallery));

  if(!gallery) return null;

  if(!canViewPublicGallery(gallery)){

    return (
      <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">

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

    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">

      <div className="fixed right-4 top-4 z-40">
        <ReportContentButton contentType="gallery" contentId={gallery.id} />
      </div>

      <GalleryHero gallery={gallery} />

      <div className="mx-auto max-w-7xl px-6 py-10">

        <GalleryLayout
          layout={gallery.layout}
          items={galleryItems}
        />

      </div>

    </main>
  )
}