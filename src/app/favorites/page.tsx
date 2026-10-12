"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { PillButton } from "@/components/ui/PillButton";
import { PillSelect } from "@/components/ui/PillSelect";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { listViewerFavorites, type FavoriteRecord } from "@/lib/favorites";
import { loadGalleries, type Gallery } from "@/lib/galleryModel";
import { loadItems, getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import { Glyph } from "@/components/ui/Glyph";

// ─── helpers ──────────────────────────────────────────────────────────────────

function favoriteTitle(r: FavoriteRecord, items: VaultItem[], galleries: Gallery[]) {
  if (r.content_type === "item") {
    const it = items.find((x) => String(x.id) === String(r.content_id));
    return it?.title || String(r.metadata?.title || "Saved item");
  }
  const g = galleries.find((x) => String(x.id) === String(r.content_id));
  return g?.title || String(r.metadata?.title || "Saved exhibition");
}

function favoriteSubtitle(r: FavoriteRecord, items: VaultItem[], galleries: Gallery[]) {
  if (r.content_type === "item") {
    const it = items.find((x) => String(x.id) === String(r.content_id));
    return [it?.universe, it?.number && `#${it.number}`, it?.grade].filter(Boolean).join(" · ") || "Saved item";
  }
  const g = galleries.find((x) => String(x.id) === String(r.content_id));
  const n = g?.itemIds?.length ?? r.metadata?.itemCount ?? 0;
  return `${n} item${n === 1 ? "" : "s"} · Exhibition`;
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
  return `/museum/${r.content_id}/guest`;
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
          <div className="flex h-full w-full items-center justify-center">
            {isItem ? <Glyph name="key" size={22} /> : <Glyph name="exhibition" size={22} />}
          </div>
        )}
        {/* type pill */}
        <div
          className="absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
          style={{ background: "rgba(0,0,0,0.72)", color: isItem ? "var(--theme-gold)" : "#a78bfa" }}
        >
          {isItem ? "Item" : "Exhibition"}
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
    { key: "gallery", label: "Exhibitions", count: galleryCount },
  ];

  return (
    <div className="" style={{ background: "var(--bg)" }}>
      <PageHeader
        title="Favorites"
        description="Items and exhibitions you've saved from across VLTD."
        contentClassName="max-w-2xl"
      />
      <div className="mx-auto max-w-2xl px-4">
        <div>
          {/* Stats bar */}
          {!loading && favorites.length > 0 && (
            <div className="flex items-center gap-6">
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
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>exhibitions</span>
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
            <div className="flex justify-center" style={{ color: "var(--theme-gold)" }}><Glyph name="heart" size={42} /></div>
            <div className="mt-4 text-base font-semibold" style={{ color: "var(--fg)" }}>
              No favorites yet
            </div>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Browse the Discover page and tap the heart on any item or exhibition to save it here.
            </p>
            <PillButton href="/discover" className="mt-6 font-black" style={{ background: "linear-gradient(180deg, #79E7FB, #41C6E4 55%, #2CB1D1)", color: "#06171d", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 16px rgba(79,211,238,0.25)" }}>Explore Discover →</PillButton>
          </div>
        ) : (
          <>
            {/* Filter + Sort bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Tabs */}
              <div className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                  <PillButton key={t.key} variant={filter === t.key ? "active" : "default"} onClick={() => setFilter(t.key)}>
                    {t.label}
                    {t.count > 0 && <span className="opacity-70">{t.count}</span>}
                  </PillButton>
                ))}
              </div>

              {/* Sort + Search */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="h-11 rounded-[8px] px-3 text-[13px] ring-1 ring-[color:var(--border)] focus:outline-none md:h-9"
                  style={{ background: "var(--pill)", color: "var(--fg)", width: 140 }}
                />
                <PillSelect value={sort} ariaLabel="Sort favorites" align="right" minWidthPx={140} onChange={(next) => setSort(next as Sort)} options={[{ value: "saved", label: "Recently saved" }, { value: "alpha", label: "A → Z" }]} />
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
