"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listViewerFavorites, type FavoriteRecord } from "@/lib/favorites";
import { loadGalleries, type Gallery } from "@/lib/galleryModel";

function favoriteTitle(record: FavoriteRecord, galleries: Gallery[]) {
  const gallery = galleries.find((entry) => String(entry.id) === String(record.content_id));
  return gallery?.title || String(record.metadata?.title || "Saved gallery");
}

function favoriteSubtitle(record: FavoriteRecord, galleries: Gallery[]) {
  const gallery = galleries.find((entry) => String(entry.id) === String(record.content_id));
  const count = gallery?.itemIds?.length ?? record.metadata?.itemCount;
  return `${Number(count ?? 0)} item${Number(count ?? 0) === 1 ? "" : "s"}`;
}

function favoriteImage(record: FavoriteRecord, galleries: Gallery[]) {
  const gallery = galleries.find((entry) => String(entry.id) === String(record.content_id));
  return gallery?.coverImage || "";
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const records = await listViewerFavorites();
      if (!active) return;
      setFavorites(records.filter((favorite) => favorite.content_type === "gallery"));
      setGalleries(loadGalleries({ includeAllProfiles: true }));
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[color:var(--bg)] px-4 py-8 text-[color:var(--fg)] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Favorites</div>
            <h1 className="mt-2 text-3xl font-semibold">Saved galleries</h1>
            <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted)]">
              Your saved public galleries. These favorites are database-backed and feed gallery engagement analytics for owners.
            </p>
          </div>
          <Link href="/" className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-sm ring-1 ring-[color:var(--border)]">
            Back Home
          </Link>
        </div>

        {loading ? (
          <div className="mt-8 rounded-[22px] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
            Loading favorites...
          </div>
        ) : favorites.length === 0 ? (
          <div className="mt-8 rounded-[22px] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
            No saved galleries yet. Use the star on any public gallery to save it here.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {favorites.map((record) => {
              const image = favoriteImage(record, galleries);
              return (
                <Link
                  key={record.id}
                  href={`/gallery/${record.content_id}`}
                  className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-[18px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
                >
                  <div className="h-[88px] overflow-hidden rounded-[14px] bg-black/20">
                    {image ? (
                      <img src={image} alt="" className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-[color:var(--muted)]">No image</div>
                    )}
                  </div>
                  <div className="min-w-0 self-center">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">gallery</div>
                    <div className="mt-1 line-clamp-1 font-semibold text-cyan-200">{favoriteTitle(record, galleries)}</div>
                    <div className="mt-1 line-clamp-1 text-sm text-[color:var(--muted)]">{favoriteSubtitle(record, galleries)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
