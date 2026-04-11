// PUBLIC SHARE PAGE (NO AUTH INTERFERENCE)

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import {
  getGalleryByPublicToken,
  recordGalleryView,
  type Gallery,
} from "@/lib/galleryModel";

export default function SharedGalleryPage() {
  const params = useParams();
  const token = params?.token as string | undefined;

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsResolved(true);
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const g = await getGalleryByPublicToken(token);

        if (cancelled) return;

        setGallery(g);
        setIsResolved(true);

        if (g) recordGalleryView(g.id);
      } catch (err) {
        console.error("Public gallery load failed:", err);
        if (!cancelled) setIsResolved(true);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!isResolved) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white">
        Loading gallery...
      </main>
    );
  }

  if (!gallery) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white">
        Link not available
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white p-6">
      <h1 className="text-3xl font-semibold">{gallery.title}</h1>
      {gallery.description && (
        <p className="mt-2 text-white/70">{gallery.description}</p>
      )}
    </main>
  );
}
