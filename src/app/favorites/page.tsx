"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { listViewerFavorites, type FavoriteRecord } from "@/lib/favorites";
import { loadGalleries, type Gallery } from "@/lib/galleryModel";
import { loadItems, getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";

function favoriteTitle(record: FavoriteRecord, items: VaultItem[], galleries: Gallery[]) {
  if (record.content_type === "item") {
    const item = items.find((entry) => String(entry.id) === String(record.content_id));
    return item?.title || String(record.metadata?.title || "Favorite item");
  }

  const gallery = galleries.find((entry) => String(entry.id) === String(record.content_id));
  return gallery?.title || String(record.metadata?.title || "Favorite gallery");
}

function favoriteSubtitle(record: FavoriteRecord, items: VaultItem[], galleries: Gallery[]) {
  if (record.content_type === "item") {
    const item = items.find((entry) => String(entry.id) === String(record.content_id));
    return [item?.subtitle, item?.number, item?.grade].filter(Boolean).join(" • ") || "Saved item";
  }

  const gallery = galleries.find((entry) => String(entry.id) === String(record.content_id));
  const count = gallery?.itemIds?.length ?? record.metadata?.itemCount;
  return `${Number(count ?? 0)} item${Number(count ?? 0) === 1 ? "" : "s"} saved gallery`;
}

function favoriteImage(record: FavoriteRecord, items: VaultItem[], galleries: Gallery[]) {
  if (record.content_type === "item") {
    const item = items.find((entry) => String(entry.id) === String(record.content_id));
    return item ? getPrimaryImageUrl(item) : String(record.metadata?.image || "");
  }

  const gallery = galleries.find((entry) => String(entry.id) === String(record.content_id));
  return gallery?.coverImage || "";
}

function favoriteHref(record: FavoriteRecord) {
  if (record.content_type === "item") return `/vault/item/${record.content_id}`;
  return `/gallery/${record.content_id}`;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [records] = await Promise.all([listViewerFavorites()]);
      if (!active) return;
      setFavorites(records);
      setItems(loadItems({ includeAllProfiles: true }));
      setGalleries(loadGalleries({ includeAllProfiles: true }));
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    return {
      galleries: favorites.filter((favorite) => favorite.content_type === "gallery"),
      items: favorites.filter((favorite) => favorite.content_type === "item"),
    };
  }, [favorites]);

  function renderFavorite(record: FavoriteRecord) {
    const image = favoriteImage(record, items, galleries);
    return (
      <Link
        key={record.id}
        href={favoriteHref(record)}
        className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-[18px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
      >
        <div className="h-[76px] overflow-hidden rounded-[14px] bg-black/20">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-[color:var(--muted)]">No image</div>
          )}
        </div>
        <div className="min-w-0 self-center">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">{record.content_type}</div>
          <div className="mt-1 line-clamp-1 font-semibold text-cyan-200">{favoriteTitle(record, items, galleries)}</div>
          <div className="mt-1 line-clamp-1 text-sm text-[color:var(--muted)]">{favoriteSubtitle(record, items, galleries)}</div>
        </div>
      </Link>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] px-4 py-8 text-[color:var(--fg)] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Favorites</div>
            <h1 className="mt-2 text-3xl font-semibold">Saved items and galleries</h1>
            <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted)]">
              Your saved public items and galleries. These favorites are database-backed and feed future engagement analytics.
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
            No favorites yet. Favorite public items or galleries to build your saved list.
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="text-lg font-semibold">Favorite Galleries</h2>
              <div className="mt-3 grid gap-3">{grouped.galleries.map(renderFavorite)}</div>
            </section>
            <section>
              <h2 className="text-lg font-semibold">Favorite Items</h2>
              <div className="mt-3 grid gap-3">{grouped.items.map(renderFavorite)}</div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
