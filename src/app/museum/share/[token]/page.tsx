// FIXED VERSION (loading state added)

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
    if (!token) return;

    let cancelled = false;

    async function run() {
      const g = await getGalleryByPublicToken(token);

      if (cancelled) return;

      setGallery(g);
      setIsResolved(true);

      if (g) recordGalleryView(g.id);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ✅ FIX: LOADING STATE
  if (!isResolved) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white">
        Loading gallery...
      </main>
    );
  }

  // ✅ FIX: NOT FOUND STATE
  if (!gallery) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white">
        Link not available
      </main>
    );
  }

  // ✅ VALID STATE
  return (
    <main className="min-h-screen text-white">
      <h1 className="text-3xl">{gallery.title}</h1>
    </main>
  );
}
