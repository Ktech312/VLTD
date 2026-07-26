"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Glyph } from "@/components/ui/Glyph";
import {
  loadWishlist,
  removeWishlistItem,
  updateWishlistItem,
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
import { universePlaceholder } from "@/lib/itemPlaceholder";

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
      .join(" · ") || "Target watch",
    image: universePlaceholder(item.universe),
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
    image: item.imageFrontUrl || universePlaceholder(),
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
    image: item.imageUrl || universePlaceholder("POP_CULTURE"),
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
        borderColor: selected ? "var(--theme-gold,#C8CDD2)" : "rgba(203,208,213,0.28)",
        boxShadow: selected ? "0 0 0 1px rgba(203,208,213,0.16), 0 16px 44px rgba(0,0,0,0.22)" : "none",
      }}
    >
      <div className="mb-2">
        <span className="rounded-[4px] border border-[rgba(203,208,213,0.42)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
          {entry.kind}
        </span>
      </div>
      <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-4">
        <div className="relative flex h-[154px] items-center justify-center rounded-[7px] bg-black/25">
          <img src={entry.image || universePlaceholder()} alt="" className="max-h-[148px] max-w-[110px] object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.5)]" />
        </div>
        <div className="min-w-0">
          <div className="line-clamp-2 font-serif text-[17px] font-black leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
            {entry.title}
          </div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--theme-text-muted,#61656B)" }}>{entry.subtitle}</div>
          <div className="text-[12px]" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{entry.meta}</div>
          <div className="mt-4 text-[11px]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Current Value</div>
          <div className="text-[23px] font-black leading-tight text-[color:var(--info,#52D6F4)]">{entry.currentValue ? money(entry.currentValue) : "--"}</div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>Target Price</div>
          <div className="text-[17px] font-black" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{entry.targetPrice ? money(entry.targetPrice) : "--"}</div>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div className="flex items-center gap-4" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
          <Glyph name="sparkle" size={22} />
          <Glyph name="heart" size={24} />
        </div>
        {entry.kind === "exhibition" ? (
          <Link href="/discover" onClick={(event) => event.stopPropagation()} className="rounded-[7px] border border-[rgba(203,208,213,0.32)] px-5 py-2 text-xs font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
            View Exhibition
          </Link>
        ) : (
          <button type="button" onClick={(event) => { event.stopPropagation(); onMove(); }} className="rounded-[7px] border border-[rgba(203,208,213,0.32)] px-5 py-2 text-xs font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
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
  const [view, setView] = useState<"grid" | "list">("grid");
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

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

  // Step through the filtered list from the detail panel.
  const selectedIndex = selected ? filteredEntries.findIndex((entry) => entry.id === selected.id) : -1;
  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex >= 0 && selectedIndex < filteredEntries.length - 1;
  function step(delta: number) {
    const next = filteredEntries[selectedIndex + delta];
    if (next) {
      setSelectedId(next.id);
      setEditingTarget(false);
      setEditingNotes(false);
    }
  }

  // Target price / notes are stored on wishlist items, so they're editable there.
  const canEditSelected = selected?.sourceType === "wishlist" && Boolean(selected?.raw);

  function saveTarget() {
    if (!selected || !canEditSelected) return;
    const parsed = Number(targetDraft.replace(/[^0-9.]/g, ""));
    const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    updateWishlistItem(selected.id, { targetPrice: value });
    setWishlist(loadWishlist());
    setEditingTarget(false);
    showToast(value ? `Target price set to ${money(value)}` : "Target price cleared");
  }

  function saveNotes() {
    if (!selected || !canEditSelected) return;
    updateWishlistItem(selected.id, { notes: notesDraft.trim() });
    setWishlist(loadWishlist());
    setEditingNotes(false);
    showToast("Notes saved");
  }

  async function shareSelected() {
    if (!selected) return;
    const parts = [
      selected.title,
      selected.subtitle,
      selected.currentValue ? `Current value ${money(selected.currentValue)}` : "",
      selected.targetPrice ? `Target ${money(selected.targetPrice)}` : "",
    ].filter(Boolean);
    const text = parts.join(" — ");
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: selected.title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard");
    } catch {
      showToast("Couldn't share that item.");
    }
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1480px] gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="min-w-0">
          <div>
            <h1 className="font-serif text-[44px] leading-none tracking-[-0.03em]" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
              Watchlist
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>
              Track items, exhibitions, and price targets before they enter your vault.
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_160px_150px]">
            <label className="flex h-10 items-center gap-2 rounded-[7px] border border-[rgba(203,208,213,0.22)] px-3" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
              <Glyph name="search" size={15} className="opacity-60" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search watchlist..."
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-45"
              />
            </label>
            {([
              ["Items", "items", "cards"],
              ["Exhibitions", "exhibitions", "exhibition"],
              ["Price Drops", "alerts", "sparkle"],
            ] as const).map(([label, key, glyph]) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(active ? "all" : key)}
                  aria-pressed={active}
                  className="flex h-10 items-center justify-center gap-2 rounded-[7px] border px-3 text-xs font-black transition"
                  style={{
                    background: active ? "rgba(203,208,213,0.12)" : "var(--theme-card,rgba(15,25,45,0.85))",
                    borderColor: active ? "var(--theme-gold,#C8CDD2)" : "rgba(203,208,213,0.22)",
                    color: active ? "var(--theme-gold,#C8CDD2)" : "var(--theme-text-primary,#ECEDEF)",
                  }}
                >
                  <Glyph name={glyph} size={14} />
                  {label}
                </button>
              );
            })}
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
                  borderColor: filter === key ? "var(--theme-gold,#C8CDD2)" : "transparent",
                  color: filter === key ? "var(--theme-gold,#C8CDD2)" : "var(--theme-text-primary,#ECEDEF)",
                }}
              >
                {label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--theme-text-muted,#61656B)" }}>Sort</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                className="h-10 rounded-[7px] border border-[rgba(203,208,213,0.22)] bg-transparent px-3 text-sm font-bold outline-none"
                style={{ color: "var(--theme-text-primary,#ECEDEF)" }}
              >
                <option value="recent">Recently added</option>
                <option value="value">Highest value</option>
                <option value="target">Target price</option>
              </select>
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-pressed={view === "grid"}
                aria-label="Grid view"
                title="Grid view"
                className="grid h-10 w-10 place-items-center rounded-[7px] border transition"
                style={{
                  borderColor: view === "grid" ? "var(--theme-gold,#C8CDD2)" : "rgba(203,208,213,0.28)",
                  background: view === "grid" ? "rgba(203,208,213,0.12)" : "transparent",
                  color: "var(--theme-gold,#C8CDD2)",
                }}
              >
                <Glyph name="cards" size={16} />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                aria-label="List view"
                title="List view"
                className="grid h-10 w-10 place-items-center rounded-[7px] border transition"
                style={{
                  borderColor: view === "list" ? "var(--theme-gold,#C8CDD2)" : "rgba(203,208,213,0.28)",
                  background: view === "list" ? "rgba(203,208,213,0.12)" : "transparent",
                  color: "var(--theme-gold,#C8CDD2)",
                }}
              >
                <Glyph name="box" size={16} />
              </button>
            </div>
          </div>

          <div className={`mt-4 grid gap-3 ${view === "grid" ? "lg:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1"}`}>
            {filteredEntries.map((entry) => (
              <WatchCard
                key={`${entry.sourceType}-${entry.id}`}
                entry={entry}
                selected={selected?.id === entry.id}
                onSelect={() => setSelectedId(entry.id)}
                onMove={() => handleMove(entry)}
              />
            ))}
            <Link href="/vault/add" className="grid min-h-[264px] place-items-center rounded-[7px] border border-dashed border-[rgba(203,208,213,0.42)] text-center transition hover:bg-[rgba(203,208,213,0.05)]">
              <span>
                <span className="block text-3xl" style={{ color: "var(--theme-gold,#C8CDD2)" }}>+</span>
                <span className="mt-2 block text-lg font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Add Watch</span>
                <span className="mt-1 block text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>Track items or exhibitions you&apos;re watching.</span>
                <span className="mt-6 flex justify-center" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
                  <Glyph name="search" size={28} />
                </span>
              </span>
            </Link>
          </div>

          <div className="mt-4 grid rounded-[7px] border border-[rgba(203,208,213,0.22)] md:grid-cols-[1.8fr_repeat(5,1fr)]" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
            <div className="flex gap-3 border-r border-[rgba(203,208,213,0.16)] p-4">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-[rgba(203,208,213,0.34)]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
                <Glyph name="target" size={18} />
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Pro Tip</div>
                <p className="text-xs leading-5" style={{ color: "var(--theme-text-muted,#61656B)" }}>
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
              <div key={label} className="grid place-items-center border-r border-[rgba(203,208,213,0.12)] p-4 text-center last:border-r-0">
                <div className={`text-2xl font-black ${tone === "danger" ? "text-red-400" : tone === "success" ? "text-green-400" : "text-[color:var(--info,#52D6F4)]"}`}>{value}</div>
                <div className="text-xs" style={{ color: "var(--theme-text-muted,#61656B)" }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {selected && (
          <aside className="h-fit rounded-[8px] border border-[rgba(203,208,213,0.32)] p-4 xl:sticky xl:top-24" style={{ background: "var(--theme-card,rgba(15,25,45,0.92))", boxShadow: "0 18px 55px rgba(0,0,0,0.26)" }}>
            <div className="flex items-center justify-between">
              <span className="rounded-[4px] border border-[rgba(203,208,213,0.42)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
                {selected.kind}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={!canPrev}
                  aria-label="Previous item"
                  title="Previous item"
                  className="grid h-8 w-8 place-items-center rounded-[6px] border border-[rgba(203,208,213,0.22)] transition disabled:opacity-35"
                  style={{ color: "var(--theme-gold,#C8CDD2)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={!canNext}
                  aria-label="Next item"
                  title="Next item"
                  className="grid h-8 w-8 place-items-center rounded-[6px] border border-[rgba(203,208,213,0.22)] transition disabled:opacity-35"
                  style={{ color: "var(--theme-gold,#C8CDD2)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close details"
                  title="Close"
                  className="grid h-8 w-8 place-items-center rounded-[6px] transition"
                  style={{ color: "var(--theme-gold,#C8CDD2)" }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-5 sm:grid-cols-[170px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[170px_minmax(0,1fr)]">
              <div className="flex h-[210px] items-center justify-center rounded-[7px] border border-[rgba(203,208,213,0.18)] bg-black/20">
                <img src={selected.image || universePlaceholder()} alt="" className="max-h-[198px] max-w-[150px] object-contain drop-shadow-[0_22px_26px_rgba(0,0,0,0.55)]" />
              </div>
              <div>
                <h2 className="font-serif text-[25px] font-black leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selected.title}</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>{selected.subtitle}</p>
                <p className="text-sm" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selected.meta}</p>
                <div className="mt-5 text-xs" style={{ color: "var(--theme-text-muted,#61656B)" }}>Current Value</div>
                <div className="text-[30px] font-black text-[color:var(--info,#52D6F4)]">{selected.currentValue ? money(selected.currentValue) : "--"}</div>
                <div className="mt-3 overflow-hidden rounded-[7px] border border-[rgba(203,208,213,0.18)]">
                  {editingTarget && canEditSelected ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-2">
                      <input
                        autoFocus
                        value={targetDraft}
                        onChange={(event) => setTargetDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveTarget();
                          if (event.key === "Escape") setEditingTarget(false);
                        }}
                        inputMode="decimal"
                        placeholder="Target price"
                        className="min-w-0 rounded-[6px] border border-[rgba(203,208,213,0.28)] bg-transparent px-2 py-2 text-sm outline-none"
                        style={{ color: "var(--theme-text-primary,#ECEDEF)" }}
                      />
                      <span className="flex gap-1">
                        <button type="button" onClick={saveTarget} className="rounded-[6px] px-3 py-2 text-xs font-black" style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}>Save</button>
                        <button type="button" onClick={() => setEditingTarget(false)} className="rounded-[6px] border border-[rgba(203,208,213,0.22)] px-3 py-2 text-xs font-bold" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>Cancel</button>
                      </span>
                    </div>
                  ) : (
                    <div className={`grid ${canEditSelected ? "grid-cols-[1fr_104px_36px]" : "grid-cols-[1fr_104px]"}`}>
                      <div className="px-3 py-3 text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>Target Price</div>
                      <div className="border-l border-[rgba(203,208,213,0.12)] px-3 py-3 text-right text-sm font-bold" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selected.targetPrice ? money(selected.targetPrice) : "--"}</div>
                      {canEditSelected && (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetDraft(selected.targetPrice ? String(selected.targetPrice) : "");
                            setEditingTarget(true);
                          }}
                          aria-label="Set target price"
                          title="Set target price"
                          className="grid place-items-center border-l border-[rgba(203,208,213,0.12)] transition hover:bg-[rgba(203,208,213,0.08)]"
                          style={{ color: "var(--theme-gold,#C8CDD2)" }}
                        >
                          <Glyph name="tag" size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-3 rounded-[7px] border border-[rgba(203,208,213,0.18)] p-3 text-sm" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: selected.alertActive ? "#4ade80" : "var(--theme-text-muted,#61656B)" }}
                  />{" "}
                  {selected.alertActive ? "Alert Active" : "No alert set"}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Value History</div>
                <div className="flex gap-3 text-[11px] font-bold" style={{ color: "var(--theme-text-muted,#61656B)" }}>
                  <span>7D</span><span>30D</span><span>3M</span><span>6M</span><span style={{ color: "var(--theme-gold,#C8CDD2)" }}>1Y</span><span>ALL</span>
                </div>
              </div>
              <div className="h-[150px] rounded-[7px] border border-[rgba(203,208,213,0.12)] bg-black/10 p-2">
                <SparkLine />
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Recent Comparable Sales</div>
              </div>
              <div className="rounded-[7px] border border-[rgba(203,208,213,0.16)] px-4 py-5 text-sm leading-6" style={{ color: "var(--theme-text-muted,#61656B)" }}>
                Comparable sales will appear here after this watched item is linked to a live pricing source.
              </div>
            </div>

            <div className="mt-5 border-t border-[rgba(203,208,213,0.16)] pt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Notes</div>
                {canEditSelected && !editingNotes && (
                  <button
                    type="button"
                    onClick={() => {
                      setNotesDraft(selected.notes ?? "");
                      setEditingNotes(true);
                    }}
                    className="rounded-[6px] border border-[rgba(203,208,213,0.28)] px-3 py-1 text-xs font-bold"
                    style={{ color: "var(--theme-gold,#C8CDD2)" }}
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingNotes && canEditSelected ? (
                <div>
                  <textarea
                    autoFocus
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    rows={4}
                    placeholder="Why you're watching this, condition notes, sellers to check..."
                    className="w-full rounded-[6px] border border-[rgba(203,208,213,0.28)] bg-transparent p-2 text-sm leading-6 outline-none"
                    style={{ color: "var(--theme-text-primary,#ECEDEF)" }}
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={saveNotes} className="rounded-[6px] px-3 py-1.5 text-xs font-black" style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}>Save</button>
                    <button type="button" onClick={() => setEditingNotes(false)} className="rounded-[6px] border border-[rgba(203,208,213,0.22)] px-3 py-1.5 text-xs font-bold" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-6" style={{ color: "var(--theme-text-muted,#61656B)" }}>{selected.notes}</p>
              )}
              <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]" style={{ color: "var(--theme-text-muted,#61656B)" }}>
                <div><div className="uppercase tracking-[0.12em]">Added</div><div style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selected.savedAgo}</div></div>
                <div><div className="uppercase tracking-[0.12em]">Source</div><div style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selected.source}</div></div>
                <div><div className="uppercase tracking-[0.12em]">Status</div><div style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{selected.alertActive ? "Watching" : "Saved"}</div></div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <button type="button" onClick={() => handleMove(selected)} className="rounded-[7px] px-4 py-3 text-sm font-black" style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}>
                + Add to Vault
              </button>
              <button type="button" onClick={() => handleDismiss(selected)} className="rounded-[7px] border border-[rgba(203,208,213,0.22)] px-4 py-3 text-sm font-bold" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
                Dismiss
              </button>
              <button type="button" onClick={shareSelected} className="rounded-[7px] border border-[rgba(203,208,213,0.22)] px-4 py-3 text-sm font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
                Share
              </button>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
