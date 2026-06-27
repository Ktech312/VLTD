"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchActiveAuctions,
  getAuctionCountdown,
  type AuctionItem,
  type CountdownResult,
} from "@/lib/auctionLib";
import { getPrimaryImageUrl } from "@/lib/vaultModel";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import ProgressiveImage from "@/components/ui/ProgressiveImage";

// ── Constants ──────────────────────────────────────────────────────────────────

const UNIVERSES = [
  { key: "", label: "All" },
  { key: "SPORTS", label: "Sports" },
  { key: "TCG", label: "TCG" },
  { key: "COMICS", label: "Comics" },
  { key: "VINYL", label: "Vinyl" },
  { key: "GAMES", label: "Games" },
  { key: "TOYS", label: "Toys" },
  { key: "ART", label: "Art" },
  { key: "BOOKS", label: "Books" },
  { key: "MISC", label: "Other" },
];

const SORT_OPTIONS = [
  { value: "ending_soon", label: "Ending Soon" },
  { value: "most_bids",   label: "Most Bids" },
  { value: "bid_asc",     label: "Bid: Low → High" },
  { value: "bid_desc",    label: "Bid: High → Low" },
  { value: "recent",      label: "Recently Listed" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function parseGradingService(grade?: string) {
  if (!grade) return null;
  const g = grade.toUpperCase();
  if (g.startsWith("PSA"))  return { service: "PSA",  color: "#60a5fa", bg: "rgba(96,165,250,0.12)" };
  if (g.startsWith("BGS") || g.startsWith("BECKETT")) return { service: "BGS", color: "#34d399", bg: "rgba(52,211,153,0.12)" };
  if (g.startsWith("SGC"))  return { service: "SGC",  color: "#fb923c", bg: "rgba(251,146,60,0.12)" };
  if (g.startsWith("CGC"))  return { service: "CGC",  color: "#c084fc", bg: "rgba(192,132,252,0.12)" };
  if (g.startsWith("CSG"))  return { service: "CSG",  color: "#f472b6", bg: "rgba(244,114,182,0.12)" };
  if (/RAW|UNGRADED|NONE/i.test(g)) return { service: "Raw", color: "#94a3b8", bg: "rgba(148,163,184,0.10)" };
  return null;
}

// ── Countdown hook ─────────────────────────────────────────────────────────────

function useCountdowns(items: AuctionItem[]) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  // Re-derive every tick; useMemo on tick + items
  return useMemo(
    () => {
      const map = new Map<string, CountdownResult>();
      for (const item of items) {
        map.set(item.id, getAuctionCountdown(item.auctionEndsAt));
      }
      return map;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, tick]
  );
}

// ── Countdown chip ─────────────────────────────────────────────────────────────

function CountdownChip({ cd }: { cd: CountdownResult }) {
  if (cd.expired) {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}
      >
        Ended
      </span>
    );
  }
  // Under 1 hour → urgent red
  const urgent = cd.days === 0 && cd.hours === 0;
  const soon = cd.days === 0 && cd.hours < 4;
  const color = urgent ? "#f87171" : soon ? "#fb923c" : "var(--theme-gold)";
  const bg    = urgent ? "rgba(239,68,68,0.12)" : soon ? "rgba(251,146,60,0.12)" : "rgba(245,181,72,0.10)";

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
      style={{ background: bg, color }}
    >
      ⏱ {cd.label}
    </span>
  );
}

// ── Auction card ───────────────────────────────────────────────────────────────

function AuctionCard({ item, cd }: { item: AuctionItem; cd: CountdownResult }) {
  const imageUrl = getPrimaryImageUrl(item);
  const universeLabel = UNIVERSE_LABEL[item.universe as UniverseKey] ?? item.universe ?? "";
  const currentBid = item.auctionCurrentBid ?? item.auctionStartingBid;
  const bidCount = item.auctionBidCount ?? 0;

  return (
    <Link
      href={`/auction/${encodeURIComponent(item.id)}`}
      className="group flex flex-col rounded-2xl overflow-hidden ring-1 ring-[color:var(--border)] transition hover:ring-[color:var(--theme-gold)] hover:shadow-lg"
      style={{ background: "var(--surface)" }}
    >
      {/* Photo */}
      <div className="relative aspect-square w-full overflow-hidden bg-[color:var(--pill)]">
        {imageUrl ? (
          <ProgressiveImage
            src={imageUrl}
            alt={item.title}
            className="h-full w-full"
            imageClassName="object-cover object-center transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl opacity-30">🏷️</div>
        )}

        {/* Countdown overlay badge */}
        <div className="absolute bottom-2 left-2">
          <CountdownChip cd={cd} />
        </div>

        {/* Bid count badge top-right */}
        {bidCount > 0 && (
          <div
            className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
          >
            {bidCount} bid{bidCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-1">
          <p className="line-clamp-2 text-xs font-semibold leading-tight" style={{ color: "var(--fg)" }}>
            {item.title}
          </p>
        </div>

        {universeLabel && (
          <span className="text-[10px]" style={{ color: "var(--muted)" }}>{universeLabel}</span>
        )}

        {/* Grading chip */}
        <div className="flex flex-wrap gap-1 mt-0.5">
          {(() => {
            const svc = parseGradingService(item.grade);
            return svc ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: svc.bg, color: svc.color }}
              >
                {item.grade}
              </span>
            ) : item.grade ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--pill)", color: "var(--theme-gold)" }}
              >
                {item.grade}
              </span>
            ) : null;
          })()}
        </div>

        {/* Bid row */}
        <div className="mt-1 flex items-end justify-between gap-1">
          <div>
            <div className="text-[9px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              {bidCount === 0 ? "Starting bid" : "Current bid"}
            </div>
            <div className="text-base font-bold" style={{ color: "var(--theme-gold)" }}>
              {fmt(currentBid)}
            </div>
          </div>
          {item.buyItNowPrice && (
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Buy Now</div>
              <div className="text-xs font-semibold" style={{ color: "var(--fg)" }}>
                {fmt(item.buyItNowPrice)}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="text-center py-20">
      <div className="text-5xl mb-4">🔨</div>
      <div className="text-base font-semibold mb-2" style={{ color: "var(--fg)" }}>
        {hasFilters ? "No auctions match your filters" : "No live auctions right now"}
      </div>
      <div className="text-sm" style={{ color: "var(--muted)" }}>
        {hasFilters
          ? "Try adjusting your search or category."
          : "Check back soon — auctions go live when collectors list items from their vault."}
      </div>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-4 text-sm underline"
          style={{ color: "var(--theme-gold)" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuctionBrowsePage() {
  const [items, setItems]     = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [universe, setUniverse] = useState("");
  const [sort, setSort]       = useState("ending_soon");
  const [search, setSearch]   = useState("");

  const countdowns = useCountdowns(items);

  useEffect(() => {
    fetchActiveAuctions({ limit: 200 })
      .then((data) => { setItems(data); setLoading(false); })
      .catch((e) => { setError(String(e?.message ?? "Failed to load auctions")); setLoading(false); });
  }, []);

  const displayed = useMemo(() => {
    let list = items;
    if (universe) list = list.filter((i) => i.universe === universe);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.grade?.toLowerCase().includes(q) ||
          i.universe?.toLowerCase().includes(q)
      );
    }
    if (sort === "ending_soon") list = [...list].sort((a, b) => a.auctionEndsAt - b.auctionEndsAt);
    else if (sort === "most_bids") list = [...list].sort((a, b) => (b.auctionBidCount ?? 0) - (a.auctionBidCount ?? 0));
    else if (sort === "bid_asc")  list = [...list].sort((a, b) => (a.auctionCurrentBid ?? a.auctionStartingBid) - (b.auctionCurrentBid ?? b.auctionStartingBid));
    else if (sort === "bid_desc") list = [...list].sort((a, b) => (b.auctionCurrentBid ?? b.auctionStartingBid) - (a.auctionCurrentBid ?? a.auctionStartingBid));
    // "recent" = default order (already ordered by auctionEndsAt from the query, so reverse)
    else if (sort === "recent")   list = [...list].reverse();
    return list;
  }, [items, universe, sort, search]);

  const totalBids = useMemo(() => items.reduce((s, i) => s + (i.auctionBidCount ?? 0), 0), [items]);
  const hasFilters = !!(universe || search.trim());

  return (
    <div className="" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm" style={{ color: "var(--muted)" }}>VLTD</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Auctions</span>
          </div>

          <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
                Live Auctions
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Bid on rare collectibles before the clock runs out.
              </p>
            </div>

            {/* Stats strip */}
            {!loading && items.length > 0 && (
              <div className="flex flex-wrap gap-4 text-sm items-center" style={{ color: "var(--muted)" }}>
                <span>
                  <strong style={{ color: "var(--fg)" }}>{items.length}</strong> live auction{items.length !== 1 ? "s" : ""}
                </span>
                <span>
                  <strong style={{ color: "var(--fg)" }}>{totalBids}</strong> total bid{totalBids !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {/* Search + sort */}
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search auctions..."
              className="rounded-xl px-4 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
              style={{ background: "var(--pill)", color: "var(--fg)", minWidth: 200 }}
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
              style={{ background: "var(--pill)", color: "var(--fg)" }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Universe filter chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {UNIVERSES.map((u) => {
              const count = u.key ? items.filter((i) => i.universe === u.key).length : items.length;
              if (u.key && count === 0) return null;
              return (
                <button
                  key={u.key}
                  onClick={() => setUniverse(u.key)}
                  className="rounded-full px-3 py-1 text-sm font-medium transition"
                  style={{
                    background: universe === u.key ? "var(--theme-gold)" : "var(--pill)",
                    color: universe === u.key ? "#0B0B0B" : "var(--fg)",
                  }}
                >
                  {u.label}
                  {count > 0 && (
                    <span className="opacity-60 text-[11px]"> ({count})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Filtered count */}
          {!loading && hasFilters && displayed.length !== items.length && (
            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              Showing {displayed.length} of {items.length} auction{items.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: "var(--muted)" }}>
            Loading live auctions…
          </div>
        ) : error ? (
          <div className="text-center py-20 text-sm text-red-400">{error}</div>
        ) : displayed.length === 0 ? (
          <EmptyState
            hasFilters={hasFilters}
            onClear={() => { setSearch(""); setUniverse(""); }}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {displayed.map((item) => (
              <AuctionCard
                key={item.id}
                item={item}
                cd={countdowns.get(item.id) ?? getAuctionCountdown(item.auctionEndsAt)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      {!loading && displayed.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pb-12 text-center text-xs" style={{ color: "var(--muted)" }}>
          All bids are binding. Auctions close at the listed time. VLTD does not process payments.
        </div>
      )}
    </div>
  );
}
