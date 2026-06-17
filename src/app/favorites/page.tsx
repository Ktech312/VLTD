"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { listViewerFavorites, type FavoriteRecord } from "@/lib/favorites";
import { loadGalleries, type Gallery } from "@/lib/galleryModel";
import { loadItems, getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";

// ─── helpers ──────────────────────────────────────────────────────────────────

function favoriteTitle(r: FavoriteRecord, items: VaultItem[], galleries: Gallery[]) {
  if (r.content_type === "item") {
    const it = items.find((x) => String(x.id) === String(r.content_id));
    return it?.title || String(r.metadata?.title || "Saved item");
  }
  const g = galleries.find((x) => String(x.id) === String(r.content_id));
  return g?.title || String(r.metadata?.title || "Saved gallery");
}

function favoriteSubtitle(r: FavoriteRecord, items: VaultItem[], galleries: Gallery[]) {
  if (r.content_type === "item") {
    const it = items.find((x) => String(x.id) === String(r.content_id));
    return [it?.universe, it?.number && `#${it.number}`, it?.grade].filter(Boolean).join(" · ") || "Saved item";
  }
  const g = galleries.find((x) => String(x.id) === String(r.content_id));
  const n = g?.itemIds?.length ?? r.metadata?.itemCount ?? 0;
  return `${n} item${n === 1 ? "" : "s"} · Gallery`;
}

function favoriteImage(r: FavoriteRecord, items: VaultItem[], galleries: Gallery[]) {
  if (r.content_type === "item") {
    const it = items.find((x) => String(x.id) === String(r.content_id));
    return it ? getPrimaryImageUrl(it) : String(r.metadata?.image || "");
  }
  const g = galleries.find((x) => String(x.id) === String(r.content_id));
  return g?.coverImage || "";
}

function favoriteValue(r: FavoriteRecord, items: VaultItem[]) {
  if (r.content_type !== "item") return null;
  const it = items.find((x) => String(x.id) === String(r.content_id));
  const v = Number(it?.currentValue ?? it?.estimatedValue ?? it?.askingPrice ?? 0);
  if (!Number.isFinite(v) || v <= 0) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function favoriteHref(r: FavoriteRecord) {
  if (r.content_type === "item") return `/vault/item/${r.content_id}`;
  return `/gallery/${r.content_id}`;
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── FavoriteCard ─────────────────────────────────────────────────────────────

function FavoriteCard({
  record,
  items,
  galleries,
}: {
  record: FavoriteRecord;
  items: VaultItem[];
  galleries: Gallery[];
}) {
  const image = favoriteImage(record, items, galleries);
  const title = favoriteTitle(record, items, galleries);
  const subtitle = favoriteSubtitle(record, items, galleries);
  const href = favoriteHref(record);
  const isItem = record.content_type === "item";
  const value = favoriteValue(record, items);

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl p-3 ring-1 ring-[color:var(--border)] transition hover:ring-[color:var(--theme-gold)] hover:brightness-110"
      style={{ background: "var(--surface)" }}
    >
      {/* Thumbnail */}
      <div
        className="relative shrink-0 overflow-hidden rounded-xl"
        style={{ width: 68, height: 68, background: "var(--pill)" }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl">
            {isItem ? "🗝️" : "🏛️"}
          </div>
        )}
        {/* type pill */}
        <div
          className="absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
          style={{ background: "rgba(0,0,0,0.72)", color: isItem ? "var(--theme-gold)" : "#a78bfa" }}
        >
          {isItem ? "Item" : "Gallery"}
        </div>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold" style={{ color: "var(--fg)" }}>
          {title}
        </div>
        <div className="mt-0.5 truncate text-xs" style={{ color: "var(--muted)" }}>
          {subtitle}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          {value && (
            <span className="text-xs font-bold" style={{ color: "var(--theme-gold)" }}>{value}</span>
          )}
          {record.created_at && (
            <span className="text-[10px]" style={{ color: "var(--muted2, var(--muted))" }}>
              Saved {timeAgo(record.created_at)}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div className="shrink-0 text-lg opacity-30 transition group-hover:opacity-80" style={{ color: "var(--theme-gold)" }}>
        →
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Filter = "all" | "item" | "gallery";
type Sort = "saved" | "alpha";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("saved");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const [records] = await Promise.all([listViewerFavorites()]);
      if (!active) return;
      setFavorites(records);
      setItems(loadItems({ includeAllProfiles: true }));
      setGalleries(loadGalleries({ includeAllProfiles: true }));
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const itemCount = favorites.filter((f) => f.content_type === "item").length;
  const galleryCount = favorites.filter((f) => f.content_type === "gallery").length;

  const displayed = useMemo(() => {
    let list = favorites;
    if (filter !== "all") list = list.filter((f) => f.content_type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) =>
        favoriteTitle(f, items, galleries).toLowerCase().includes(q)
      );
    }
    if (sort === "alpha") {
      list = [...list].sort((a, b) =>
        favoriteTitle(a, items, galleries).localeCompare(favoriteTitle(b, items, galleries))
      );
    } else {
      list = [...list].sort((a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );
    }
    return list;
  }, [favorites, filter, sort, search, items, galleries]);

  const TABS: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: favorites.length },
    { key: "item", label: "Items", count: itemCount },
    { key: "gallery", label: "Galleries", count: galleryCount },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link href="/vault" className="text-sm" style={{ color: "var(--muted)" }}>Vault</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Favorites</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold" style={{ color: "var(--fg)" }}>Favorites</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Items and exhibitions you've saved from across VLTD.
          </p>

          {/* Stats bar */}
          {!loading && favorites.length > 0 && (
            <div className="mt-4 flex items-center gap-6">
              <div>
                <span className="text-lg font-bold" style={{ color: "var(--theme-gold)" }}>{favorites.length}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>saved</span>
              </div>
              <div>
                <span className="text-lg font-bold" style={{ color: "var(--fg)" }}>{itemCount}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>items</span>
              </div>
              <div>
                <span className="text-lg font-bold" style={{ color: "var(--fg)" }}>{galleryCount}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>galleries</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--muted)" }}>
            Loading favorites…
          </div>
        ) : favorites.length === 0 ? (
          /* Empty state */
          <div
            className="rounded-2xl px-6 py-14 text-center ring-1 ring-[color:var(--border)]"
            style={{ background: "var(--surface)" }}
          >
            <div className="text-4xl">🤍</div>
            <div className="mt-4 text-base font-semibold" style={{ color: "var(--fg)" }}>
              No favorites yet
            </div>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Browse the Discover page and tap the heart on any item or gallery to save it here.
            </p>
            <Link
              href="/discover"
              className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
              style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}
            >
              Explore Discover →
            </Link>
          </div>
        ) : (
          <>
            {/* Filter + Sort bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Tabs */}
              <div
                className="flex gap-1 rounded-xl p-1"
                style={{ background: "var(--pill)" }}
              >
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                    style={
                      filter === t.key
                        ? { background: "var(--theme-gold)", color: "#0B0B0B" }
                        : { color: "var(--muted)" }
                    }
                  >
                    {t.label}
                    {t.count > 0 && (
                      <span className="ml-1.5 opacity-70">{t.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Sort + Search */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="h-8 rounded-xl px-3 text-xs ring-1 ring-[color:var(--border)] focus:outline-none"
                  style={{ background: "var(--pill)", color: "var(--fg)", width: 140 }}
                />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="h-8 rounded-xl px-2 text-xs ring-1 ring-[color:var(--border)] focus:outline-none"
                  style={{ background: "var(--pill)", color: "var(--muted)" }}
                >
                  <option value="saved">Recently saved</option>
                  <option value="alpha">A → Z</option>
                </select>
              </div>
            </div>

            {/* List */}
            {displayed.length === 0 ? (
              <div className="mt-8 text-center text-sm" style={{ color: "var(--muted)" }}>
                No results for "{search}"
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {displayed.map((rec) => (
                  <FavoriteCard
                    key={rec.id}
                    record={rec}
                    items={items}
                    galleries={galleries}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
