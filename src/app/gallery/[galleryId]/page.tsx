"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// The old exhibition viewer only read this device's own saved exhibitions, so anyone else's
// exhibition showed as private. The home page, favorites and old links still point here, so
// they all land on the real public exhibit page instead.
export default function GalleryRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.galleryId ?? "");

  useEffect(() => {
    if (id) router.replace(`/museum/${encodeURIComponent(id)}/guest`);
  }, [id, router]);

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-[color:var(--muted)]">
        Opening exhibition…
      </div>
    </main>
  );
}
