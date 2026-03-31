// src/app/gallery/[galleryId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { loadGalleries } from "@/lib/galleryModel";
import { loadItems } from "@/lib/vaultModel";

export default function PublicGalleryPage() {

  const params = useParams();
  const id = params.galleryId as string;

  const [gallery,setGallery] = useState<any>(null);
  const [items,setItems] = useState<any[]>([]);
  const [blocked,setBlocked] = useState(false);

  useEffect(()=>{

    const g = loadGalleries().find(x=>x.id===id);

    if(!g) return;

    if(g.visibility !== "PUBLIC"){
      setBlocked(true);
      return;
    }

    setGallery(g);
    setItems(loadItems());

  },[id]);

  if(blocked){
    return (
      <main className="min-h-screen grid place-items-center bg-[color:var(--bg)] text-[color:var(--fg)]">
        <div className="text-center rounded-[28px] vltd-panel-main bg-[color:var(--surface)] p-8 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <h1 className="text-3xl font-semibold">Gallery Locked</h1>
          <div className="mt-3 opacity-70">
            This gallery is not publicly accessible.
          </div>
        </div>
      </main>
    );
  }

  if(!gallery) return null;

  const galleryItems = items.filter(i=>gallery.itemIds.includes(i.id));

  return (

    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">

      <div className="mx-auto max-w-6xl px-6 py-12">

        <div className="mb-10 rounded-[30px] vltd-panel-main bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">

          {gallery.coverImage && (
            <img
              src={gallery.coverImage}
              className="rounded-3xl mb-6 vltd-panel-main"
            />
          )}

          <h1 className="text-5xl font-semibold">
            {gallery.title}
          </h1>

          {gallery.description && (
            <div className="mt-4 text-lg opacity-70">
              {gallery.description}
            </div>
          )}

        </div>

        <div className="grid gap-6 md:grid-cols-3">

          {galleryItems.map(i=>(
            <div
              key={i.id}
              className="rounded-3xl vltd-panel-soft bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]"
            >

              {i.imageFrontUrl && (
                <img
                  src={i.imageFrontUrl}
                  className="rounded-xl mb-3"
                />
              )}

              <div className="font-semibold">
                {i.title}
              </div>

            </div>
          ))}

        </div>

      </div>

    </main>
  )
}