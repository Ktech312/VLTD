"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Glyph } from "@/components/ui/Glyph";
import {
  loadWishlist,
  removeWishlistItem,
  syncWishlistFromSupabase,
  type WishlistItem,
} from "@/lib/wishlistModel";
import { convertWishlistToVault } from "@/lib/wishlistToVault";
import {
  loadWatchlist,
  removeFromWatchlist,
  syncWatchlistFromSupabase,
  type WatchlistItem,
} from "@/lib/watchlistModel";
import {
  loadComicWishlist,
  removeFromComicWishlist,
  type ComicWishlistItem,
} from "@/lib/comicWishlistModel";
import { showToast } from "@/lib/toast";

type WatchKind = "item" | "exhibition" | "comic";
type FilterKey = "all" | "items" | "exhibitions" | "alerts" | "undecided";
type SortMode = "recent" | "value" | "target";

type WatchEntry = {
  id: string;
  kind: WatchKind;
  title: string;
  subtitle: string;
  meta: string;
  image?: string;
  currentValue: number;
  targetPrice: number;
  source: string;
  savedAgo: string;
  priority: "low" | "medium" | "high";
  alertActive: boolean;
  notes: string;
  sourceType: "wishlist" | "watchlist" | "comic";
  raw?: WishlistItem | WatchlistItem | ComicWishlistItem;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function priorityFromItem(item: WishlistItem): WatchEntry["priority"] {
  return item.priority ?? (item.targetPrice && item.targetPrice > 1000 ? "high" : "medium");
}

function entryFromWishlist(item: WishlistItem): WatchEntry {
  const target = safeNumber(item.targetPrice, 0);
  return {
    id: item.id,
    kind: "item",
    title: item.title || "Untitled Watch",
    subtitle: item.subject || item.category || item.universe || "Saved target",
    meta: [item.condition && item.condition !== "any" ? item.condition.toUpperCase() : null, item.priority ? `${item.priority} priority` : null]
      .filter(Boolean)
      .join(" Â· ") || "Target watch",
    image: imageForText(item.title, item.universe, item.category),
    currentValue: target ? Math.round(target * 1.18) : 0,
    targetPrice: target,
    source: "Manual",
    savedAgo: "manual",
    priority: priorityFromItem(item),
    alertActive: target > 0,
    notes: item.notes || "Saved from your watchlist. Add notes, target price, and condition before moving to vault.",
    sourceType: "wishlist",
    raw: item,
  };
}

function entryFromWatch(item: WatchlistItem): WatchEntry {
  const currentValue = safeNumber(item.currentValue, 0);
  return {
    id: item.id,
    kind: "item",
    title: item.title || "Watched item",
    subtitle: item.subtitle || item.collectorName || "Public gallery save",
    meta: item.grade || "Gallery watch",
    image: item.imageFrontUrl || imageForText(item.title, item.subtitle, item.grade),
    currentValue,
    targetPrice: currentValue ? Math.round(currentValue * 0.86) : 0,
    source: item.collectorName || "Public Gallery",
    savedAgo: formatAgo(item.savedAt),
    priority: currentValue > 5000 ? "high" : "medium",
    alertActive: currentValue > 0,
    notes: "Saved from Discover. Watch this item before adding it to your private vault.",
    sourceType: "watchlist",
    raw: item,
  };
}

function entryFromComic(item: ComicWishlistItem): WatchEntry {
  return {
    id: String(item.metronId),
    kind: "comic",
    title: `${item.series} #${item.number}`,
    subtitle: item.publisher || "Upcoming comic",
    meta: item.storeDate ? `Release ${item.storeDate}` : "Upcoming issue",
    image: item.imageUrl || "/collectibles/comic-slab.png",
    currentValue: 0,
    targetPrice: 0,
    source: "Metron",
    savedAgo: formatAgo(Date.parse(item.addedAt)),
    priority: "medium",
    alertActive: false,
    notes: "Upcoming issue saved from Metron. Move it to your vault after release or purchase.",
    sourceType: "comic",
    raw: item,
  };
}

function formatAgo(timestamp: number) {
  if (!timestamp || Number.isNaN(timestamp)) return "recently";
  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function imageForText(...parts: Array<string | undefined>) {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  if (text.includes("rolex") || text.includes("watch")) return "/collectibles/watch.png";
  if (text.includes("vinyl") || text.includes("record") || text.includes("pink floyd")) return "/collectibles/vinyl-record.png";
  if (text.includes("jordan") || text.includes("rookie") || text.includes("sports")) return "/collectibles/sports-slab.png";
  if (text.includes("poster") || text.includes("movie")) return "/collectibles/movie-poster.png";
  if (text.includes("guitar") || text.includes("instrument")) return "/collectibles/guitar.png";
  if (text.includes("zelda") || text.includes("game")) return "/collectibles/vault-intake-sprites.png";
  if (text.includes("bear") || text.includes("toy") || text.includes("figure")) return "/collectibles/vinyl-figure.png";
  return "/collectibles/comic-slab.png";
}

function SparkLine({ tone = "cyan" }: { tone?: "cyan" | "green" }) {
  const stroke = tone === "green" ? "#56D879" : "var(--info,#52D6F4)";
  return (
    <svg viewBox="0 0 420 156" className="h-full w-full" role="img" aria-label="Value history">
      <defs>
        <linearGradient id={`watch-fill-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 128 L28 118 L54 104 L78 111 L105 86 L132 92 L160 68 L190 72 L218 61 L248 69 L279 48 L310 53 L338 40 L366 35 L396 18 L420 5 L420 156 L0 156 Z" fill={`url(#watch-fill-${tone})`} />
      <path d="M0 128 L28 118 L54 104 L78 111 L105 86 L132 92 L160 68 L190 72 L218 61 L248 69 L279 48 L310 53 L338 40 L366 35 L396 18 L420 5" fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WatchCard({
  entry,
  selected,
  onSelect,
  onMove,
}: {
  entry: WatchEntry;
  selected: boolean;
  onSelect: () => void;
  onMove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group min-h-[264px] rounded-[7px] border p-3 text-left transition hover:-translate-y-0.5"
      style={{
        background: "var(--theme-card,rgba(15,25,45,0.85))",
        borderColor: selected ? "var(--theme-gold,#F5B548)" : "rgba(245,181,72,0.28)",
        boxShadow: selected ? "0 0 0 1px rgba(245,181,72,0.16), 0 16px 44px rgba(0,0,0,0.22)" : "none",
      }}
    >
      <div className="mb-2">
        <span className="rounded-[4px] border border-[rgba(245,181,72,0.42)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--theme-gold,#F5B548)" }}>
          {entry.kind}
        </span>
      </div>
      <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4">
        <div className="relative flex h-[154px] items-center justify-center rounded-[7px] bg-black/25">
          <img src={entry.image || "/collectibles/comic-slab.png"} alt="" className="max-h-[148px] max-w-[110px] object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.5)]" />
        </div>
        <div className="min-w-0">
          <div className="line-clamp-2 font-serif text-[17px] font-black leading-tight" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>
            {entry.title}
          </div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{entry.subtitle}</div>
          <div className="text-[12px]" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{entry.meta}</div>
          <div className="mt-4 text-[11px]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Current Value</div>
          <div className="text-[23px] font-black leading-tight text-[color:var(--info,#52D6F4)]">{entry.currentValue ? money(entry.currentValue) : "--"}</div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>Target Price</div>
          <div className="text-[17px] font-black" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{entry.targetPrice ? money(entry.targetPrice) : "--"}</div>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div className="flex items-center gap-4" style={{ color: "var(--theme-gold,#F5B548)" }}>
          <Glyph name="sparkle" size={22} />
          <Glyph name="heart" size={24} />
        </div>
        {entry.kind === "exhibition" ? (
          <Link href="/discover" onClick={(event) => event.stopPropagation()} className="rounded-[7px] border border-[rgba(245,181,72,0.32)] px-5 py-2 text-xs font-black" style={{ color: "var(--theme-gold,#F5B548)" }}>
            View Exhibition
          </Link>
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onMove(); }} className="rounded-[7px] border border-[rgba(245,181,72,0.32)] px-5 py-2 text-xs font-black" style={{ color: "var(--theme-gold,#F5B548)" }}>
            + Add to Vault
          </button>
        )}
      </div>
    </button>
  );
}

export default function WishlistPage() {
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => loadWishlist());
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => loadWatchlist());
  const [comicItems, setComicItems] = useState<ComicWishlistItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortMode>("recent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void syncWishlistFromSupabase().then(() => {
      if (active) setWishlist(loadWishlist());
    });
    void syncWatchlistFromSupabase().then(() => {
      if (active) setWatchlist(loadWatchlist());
    });
    void loadComicWishlist().then((items) => {
      if (active) setComicItems(items);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const realEntries = useMemo<WatchEntry[]>(() => {
    return [
      ...watchlist.map(entryFromWatch),
      ...wishlist.map(entryFromWishlist),
      ...comicItems.map(entryFromComic),
    ];
  }, [comicItems, watchlist, wishlist]);

  const entries = realEntries;

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = entries.filter((entry) => {
      if (filter === "items" && entry.kind !== "item" && entry.kind !== "comic") return false;
      if (filter === "exhibitions" && entry.kind !== "exhibition") return false;
      if (filter === "alerts" && !entry.alertActive) return false;
      if (filter === "undecided" && entry.priority !== "low") return false;
      if (!q) return true;
      return [entry.title, entry.subtitle, entry.meta, entry.source].join(" ").toLowerCase().includes(q);
    });

    if (sort === "value") list = [...list].sort((a, b) => b.currentValue - a.currentValue);
    if (sort === "target") list = [...list].sort((a, b) => b.targetPrice - a.targetPrice);
    return list;
  }, [entries, filter, query, sort]);

  const selected = filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0] ?? null;
  const itemCount = entries.filter((entry) => entry.kind === "item" || entry.kind === "comic").length;
  const exhibitionCount = entries.filter((entry) => entry.kind === "exhibition").length;
  const alertCount = entries.filter((entry) => entry.alertActive).length;
  const undecidedCount = entries.filter((entry) => entry.priority === "low").length;
  const totalValue = entries.reduce((sum, entry) => sum + entry.currentValue, 0);
  const priceDropOpps = entries
    .filter((entry) => entry.targetPrice > 0 && entry.currentValue > 0 && entry.currentValue <= entry.targetPrice * 1.12)
    .reduce((sum, entry) => sum + Math.max(0, entry.currentValue - entry.targetPrice), 0);

  async function handleMove(entry: WatchEntry) {
    if (entry.sourceType === "wishlist" && entry.raw) {
      const item = entry.raw as WishlistItem;
      if (movingId) return;
      setMovingId(item.id);
      try {
        await convertWishlistToVault(item);
        setWishlist((prev) => prev.filter((candidate) => candidate.id !== item.id));
        showToast(`Moved "${item.title}" to your vault`);
      } catch {
        showToast("Couldn't move that item. Try again.");
      } finally {
        setMovingId(null);
      }
      return;
    }

    if (entry.sourceType === "watchlist") {
      showToast("Open Add Item to finish moving this watched item.");
      return;
    }

    showToast("Use Add Item when this release is ready for your vault.");
  }

  function handleDismiss(entry: WatchEntry) {
    if (entry.sourceType === "wishlist" && entry.raw) {
      const item = entry.raw as WishlistItem;
      removeWishlistItem(item.id);
      setWishlist((prev) => prev.filter((candidate) => candidate.id !== item.id));
    }
    if (entry.sourceType === "watchlist") {
      removeFromWatchlist(entry.id);
      setWatchlist((prev) => prev.filter((candidate) => candidate.id !== entry.id));
    }
    if (entry.sourceType === "comic" && entry.raw) {
      const item = entry.raw as ComicWishlistItem;
      void removeFromComicWishlist(item.metronId);
      setComicItems((prev) => prev.filter((candidate) => candidate.metronId !== item.metronId));
    }
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1480px] gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="min-w-0">
          <div>
            <h1 className="font-serif text-[44px] leading-none tracking-[-0.03em]" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>
              Watchlist
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
              Track items, exhibitions, and price targets before they enter your vault.
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_160px_150px_170px]">
            <label className="flex h-10 items-center gap-2 rounded-[7px] border border-[rgba(245,181,72,0.22)] px-3" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
              <Glyph name="search" size={15} className="opacity-60" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search watchlist..."
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-45"
              />
            </label>
            {["Items", "Exhibitions", "Price Drops", "Saved Searches"].map((label) => (
              <button key={label} type="button" className="flex h-10 items-center justify-center gap-2 rounded-[7px] border border-[rgba(245,181,72,0.22)] px-3 text-xs font-black" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))", color: "var(--theme-text-primary,#F0EAD6)" }}>
                <Glyph name={label === "Price Drops" ? "sparkle" : label === "Saved Searches" ? "search" : "cards"} size={14} />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {[
              ["all", `All (${entries.length})`],
              ["items", `Items (${itemCount})`],
              ["exhibitions", `Exhibitions (${exhibitionCount})`],
              ["alerts", `Price Alerts (${alertCount})`],
              ["undecided", `Undecided (${undecidedCount})`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key as FilterKey)}
                className="border-b-2 px-3 py-2 text-sm font-bold transition"
                style={{
                  borderColor: filter === key ? "var(--theme-gold,#F5B548)" : "transparent",
                  color: filter === key ? "var(--theme-gold,#F5B548)" : "var(--theme-text-primary,#F0EAD6)",
                }}
              >
                {label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Sort</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                className="h-10 rounded-[7px] border border-[rgba(245,181,72,0.22)] bg-transparent px-3 text-sm font-bold outline-none"
                style={{ color: "var(--theme-text-primary,#F0EAD6)" }}
              >
                <option value="recent">Recently added</option>
                <option value="value">Highest value</option>
                <option value="target">Target price</option>
              </select>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-[7px] border border-[rgba(245,181,72,0.28)]" style={{ color: "var(--theme-gold,#F5B548)" }}>
                <Glyph name="cards" size={16} />
              </button>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-[7px] border border-[rgba(245,181,72,0.28)]" style={{ color: "var(--theme-gold,#F5B548)" }}>
                <Glyph name="box" size={16} />
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredEntries.map((entry) => (
              <WatchCard
                key={`${entry.sourceType}-${entry.id}`}
                entry={entry}
                selected={selected?.id === entry.id}
                onSelect={() => setSelectedId(entry.id)}
                onMove={() => handleMove(entry)}
              />
            ))}
            <Link href="/vault/add" className="grid min-h-[264px] place-items-center rounded-[7px] border border-dashed border-[rgba(245,181,72,0.42)] text-center transition hover:bg-[rgba(245,181,72,0.05)]">
              <span>
                <span className="block text-3xl" style={{ color: "var(--theme-gold,#F5B548)" }}>+</span>
                <span className="mt-2 block text-lg font-black" style={{ color: "var(--theme-gold,#F5B548)" }}>Add Watch</span>
                <span className="mt-1 block text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Track items or exhibitions you&apos;re watching.</span>
                <span className="mt-6 block text-4xl" style={{ color: "var(--theme-gold,#F5B548)" }}>âŒ•</span>
              </span>
            </Link>
          </div>

          <div className="mt-4 grid rounded-[7px] border border-[rgba(245,181,72,0.22)] md:grid-cols-[1.8fr_repeat(5,1fr)]" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
            <div className="flex gap-3 border-r border-[rgba(245,181,72,0.16)] p-4">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-[rgba(245,181,72,0.34)]" style={{ color: "var(--theme-gold,#F5B548)" }}>
                <Glyph name="target" size={18} />
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--theme-gold,#F5B548)" }}>Pro Tip</div>
                <p className="text-xs leading-5" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
                  Get the most out of your watchlist by setting target prices and alerts.
                </p>
              </div>
            </div>
            {[
              [entries.length, "Watching", "info"],
              [alertCount, "Alerts active", "info"],
              [money(totalValue), "Watchlist value", "info"],
              ["-$2,340", "7d change", "danger"],
              [priceDropOpps ? money(priceDropOpps) : "$0", "Price drop opps", "success"],
            ].map(([value, label, tone]) => (
              <div key={label} className="grid place-items-center border-r border-[rgba(245,181,72,0.12)] p-4 text-center last:border-r-0">
                <div className={`text-2xl font-black ${tone === "danger" ? "text-red-400" : tone === "success" ? "text-green-400" : "text-[color:var(--info,#52D6F4)]"}`}>{value}</div>
                <div className="text-xs" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {selected && (
          <aside className="h-fit rounded-[8px] border border-[rgba(245,181,72,0.32)] p-4 xl:sticky xl:top-24" style={{ background: "var(--theme-card,rgba(15,25,45,0.92))", boxShadow: "0 18px 55px rgba(0,0,0,0.26)" }}>
            <div className="flex items-center justify-between">
              <span className="rounded-[4px] border border-[rgba(245,181,72,0.42)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--theme-gold,#F5B548)" }}>
                {selected.kind}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" className="grid h-8 w-8 place-items-center rounded-[6px] border border-[rgba(245,181,72,0.22)]" style={{ color: "var(--theme-gold,#F5B548)" }}>â€¹</button>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-[6px] border border-[rgba(245,181,72,0.22)]" style={{ color: "var(--theme-gold,#F5B548)" }}>â€º</button>
                <button type="button" onClick={() => setSelectedId(null)} className="text-xl leading-none" style={{ color: "var(--theme-gold,#F5B548)" }}>Ã—</button>
              </div>
            </div>

            <div className="mt-4 grid gap-5 sm:grid-cols-[170px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[170px_minmax(0,1fr)]">
              <div className="flex h-[210px] items-center justify-center rounded-[7px] border border-[rgba(245,181,72,0.18)] bg-black/20">
                <img src={selected.image || "/collectibles/comic-slab.png"} alt="" className="max-h-[198px] max-w-[150px] object-contain drop-shadow-[0_22px_26px_rgba(0,0,0,0.55)]" />
              </div>
              <div>
                <h2 className="font-serif text-[25px] font-black leading-tight" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selected.title}</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{selected.subtitle}</p>
                <p className="text-sm" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selected.meta}</p>
                <div className="mt-5 text-xs" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Current Value</div>
                <div className="text-[30px] font-black text-[color:var(--info,#52D6F4)]">{selected.currentValue ? money(selected.currentValue) : "--"}</div>
                <div className="mt-3 grid grid-cols-[1fr_104px_36px] overflow-hidden rounded-[7px] border border-[rgba(245,181,72,0.18)]">
                  <div className="px-3 py-3 text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Target Price</div>
                  <div className="border-l border-[rgba(245,181,72,0.12)] px-3 py-3 text-right text-sm font-bold" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selected.targetPrice ? money(selected.targetPrice) : "--"}</div>
                  <button type="button" className="border-l border-[rgba(245,181,72,0.12)]" style={{ color: "var(--theme-gold,#F5B548)" }}>
                    <Glyph name="tag" size={14} />
                  </button>
                </div>
                <div className="mt-3 rounded-[7px] border border-[rgba(245,181,72,0.18)] p-3 text-sm" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>
                  <span className={selected.alertActive ? "text-green-400" : "text-[color:var(--theme-text-muted,#A0956B)]"}>â—</span>{" "}
                  {selected.alertActive ? "Alert Active" : "No alert set"}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#F5B548)" }}>Value History</div>
                <div className="flex gap-3 text-[11px] font-bold" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
                  <span>7D</span><span>30D</span><span>3M</span><span>6M</span><span style={{ color: "var(--theme-gold,#F5B548)" }}>1Y</span><span>ALL</span>
                </div>
              </div>
              <div className="h-[150px] rounded-[7px] border border-[rgba(245,181,72,0.12)] bg-black/10 p-2">
                <SparkLine />
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#F5B548)" }}>Recent Comparable Sales</div>
                <button type="button" className="text-xs font-bold" style={{ color: "var(--theme-gold,#F5B548)" }}>View all â€º</button>
              </div>
              <div className="rounded-[7px] border border-[rgba(245,181,72,0.16)] px-4 py-5 text-sm leading-6" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
                Comparable sales will appear here after this watched item is linked to a live pricing source.
              </div>
            </div>

            <div className="mt-5 border-t border-[rgba(245,181,72,0.16)] pt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#F5B548)" }}>Notes</div>
                <button type="button" className="rounded-[6px] border border-[rgba(245,181,72,0.28)] px-3 py-1 text-xs font-bold" style={{ color: "var(--theme-gold,#F5B548)" }}>Edit</button>
              </div>
              <p className="text-sm leading-6" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{selected.notes}</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
                <div><div className="uppercase tracking-[0.12em]">Added</div><div style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selected.savedAgo}</div></div>
                <div><div className="uppercase tracking-[0.12em]">Source</div><div style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selected.source}</div></div>
                <div><div className="uppercase tracking-[0.12em]">Status</div><div style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{selected.alertActive ? "Watching" : "Saved"}</div></div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <button type="button" onClick={() => handleMove(selected)} className="rounded-[7px] px-4 py-3 text-sm font-black" style={{ background: "linear-gradient(135deg,#8B6914,#F5B548)", color: "#0B0B0B" }}>
                + Add to Vault
              </button>
              <button type="button" onClick={() => handleDismiss(selected)} className="rounded-[7px] border border-[rgba(245,181,72,0.22)] px-4 py-3 text-sm font-bold" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>
                Ã— Dismiss
              </button>
              <button type="button" className="rounded-[7px] border border-[rgba(245,181,72,0.22)] px-4 py-3 text-sm font-bold" style={{ color: "var(--theme-gold,#F5B548)" }}>
                Share
              </button>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
