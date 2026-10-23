"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { PillButton } from "@/components/ui/PillButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillSelect } from "@/components/ui/PillSelect";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchMarketItems, type MarketItem } from "@/lib/publicProfile";
import { getPrimaryImageUrl } from "@/lib/vaultModel";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { Glyph } from "@/components/ui/Glyph";


const SORT_OPTIONS = [
  { value: "recent", label: "Recently Listed" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}


// ── Grading company chip ──────────────────────────────────────────────────────
function parseGradingService(grade?: string): { service: string; color: string; bg: string } | null {
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

function listingAge(createdAt?: number): string | null {
  if (!createdAt) return null;
  const days = Math.floor((Date.now() - createdAt) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function MarketCard({ item }: { item: MarketItem }) {
  const imageUrl = getPrimaryImageUrl(item);
  const universeLabel = UNIVERSE_LABEL[item.universe as UniverseKey] ?? item.universe ?? "";
  const price = item.askingPrice ?? item.currentValue;
  const isAsking = item.askingPrice !== undefined && item.askingPrice !== null;

  return (
    <Link
      href={item.sellerProfileId ? `/v/${encodeURIComponent(item.sellerProfileId)}` : "/market"}
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
          <div className="flex h-full w-full items-center justify-center opacity-30">
            <Glyph name="key" size={34} />
          </div>
        )}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
            style={{ background: "linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)", color: "#06171d" }}>
            FOR SALE
          </span>
          {listingAge(item.createdAt) && (
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.75)" }}>
              {listingAge(item.createdAt)}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3">
        <div className="text-sm font-semibold leading-tight line-clamp-2" style={{ color: "var(--fg)" }}>
          {item.title}
        </div>
        {item.subtitle && (
          <div className="text-[11px] line-clamp-1" style={{ color: "var(--muted)" }}>
            {item.subtitle}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {universeLabel && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--pill)", color: "var(--muted)" }}>
              {universeLabel}
            </span>
          )}
          {(() => {
            const svc = parseGradingService(item.grade);
            return svc ? (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: svc.bg, color: svc.color }}>
                {svc.service}{item.grade && !item.grade.toUpperCase().startsWith(svc.service) ? "" : ` ${item.grade?.replace(new RegExp("^" + svc.service + "\s*", "i"), "")}`}
              </span>
            ) : item.grade ? (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--pill)", color: "var(--theme-gold)" }}>
                {item.grade}
              </span>
            ) : null;
          })()}
          {item.condition && !item.grade && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--pill)", color: "var(--muted)" }}>
              {item.condition}
            </span>
          )}
          {item.certNumber && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "rgba(203,208,213,0.08)", color: "var(--theme-gold)" }}
              title={`Cert #${item.certNumber}`}>
              ✓ Certified
            </span>
          )}
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            {price ? (
              <div className="text-base font-bold" style={{ color: "var(--theme-gold)" }}>
                {fmt(price)}
                <span className="ml-1 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{isAsking ? "asking" : "value"}</span>
              </div>
            ) : (
              <div className="text-sm" style={{ color: "var(--muted)" }}>Price on request</div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-base leading-none">{item.sellerAvatarEmoji ?? "🗝️"}</span>
            <span className="text-[10px] truncate max-w-[80px]" style={{ color: "var(--muted)" }}>
              {item.sellerDisplayName ?? "Collector"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function MarketPage() {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [universe, setUniverse] = useState("");
  const [sort, setSort] = useState("recent");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchMarketItems({ limit: 200 })
      .then((data) => { setItems(data); setLoading(false); })
      .catch((e) => { setError(String(e?.message ?? "Failed to load market")); setLoading(false); });
  }, []);

  const displayed = useMemo(() => {
    let list = items;
    if (universe) list = list.filter((i) => i.universe === universe);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.subtitle?.toLowerCase().includes(q) ||
          i.subject?.toLowerCase().includes(q)
      );
    }
    // Items with no price known sort after every priced item, in either direction.
    const priceOf = (i: MarketItem) => { const p = i.askingPrice ?? i.currentValue; return typeof p === "number" && Number.isFinite(p) && p > 0 ? p : null; };
    const byPrice = (dir: 1 | -1) => (a: MarketItem, b: MarketItem) => {
      const x = priceOf(a), y = priceOf(b);
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      return (x - y) * dir;
    };
    if (sort === "price_asc") list = [...list].sort(byPrice(1));
    else if (sort === "price_desc") list = [...list].sort(byPrice(-1));
    return list;
  }, [items, universe, sort, search]);

  // One pill per universe that really has listings (the old fixed list used names the data never uses, so most listings had no pill), so the pills add up to All.
  const universePills = useMemo(() => {
    const seen = [...new Set(items.map((i) => i.universe).filter((u): u is string => Boolean(u)))].sort();
    return [{ key: "", label: "All" }, ...seen.map((key) => ({ key, label: UNIVERSE_LABEL[key as UniverseKey] ?? key }))];
  }, [items]);

  // "Total asking" adds up ASKING prices only. A listing with no asking price shows its estimated value on its card, labelled "value", and is left out of this
  // total (and counted beside it) so the total never mixes what sellers ask with what items are estimated to be worth.
  const askingTotals = useMemo(() => {
    let total = 0; let without = 0;
    for (const i of displayed) {
      if (typeof i.askingPrice === "number" && Number.isFinite(i.askingPrice)) total += i.askingPrice;
      else without += 1;
    }
    return { total, without };
  }, [displayed]);
  const totalValue = askingTotals.total;

  return (
    <div className="" style={{ background: "var(--bg)" }}>
      <PageHeader
        title="Marketplace"
        titleAdornment={<PillButton size="compact" href="/discover" ariaLabel="Back to Discover"><AppIcon name="back" size={14} strokeWidth={2} /><span>Discover</span></PillButton>}
        description="Browse collectibles for sale by VLTD collectors. Contact sellers through their public vault."
        contentClassName="max-w-6xl"
      />
      <div>
        <div className="mx-auto max-w-6xl px-4">
          {!loading && items.length > 0 && (
            <div className="flex flex-wrap gap-4 text-sm" style={{ color: "var(--muted)" }}>
              <span><strong style={{ color: "var(--fg)" }}>{items.length}</strong> items listed</span>
              {displayed.length !== items.length && (
                <span><strong style={{ color: "var(--fg)" }}>{displayed.length}</strong> matching</span>
              )}
              <span data-testid="market-total-asking">Total asking: <strong style={{ color: "var(--theme-gold)" }}>{fmt(totalValue)}</strong>{askingTotals.without > 0 ? <span className="ml-1 text-[11px]">({askingTotals.without} without an asking price, not counted)</span> : null}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings..."
              className="h-11 rounded-[8px] px-3 text-[13px] ring-1 ring-[color:var(--border)] focus:outline-none md:h-9"
              style={{ background: "var(--pill)", color: "var(--fg)", minWidth: 200 }}
            />
            <PillSelect value={sort} ariaLabel="Sort listings" align="left" minWidthPx={170} onChange={(next) => setSort(next)} options={SORT_OPTIONS} />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {universePills.map((u) => {
              const count = u.key ? items.filter((i) => i.universe === u.key).length : items.length;
              if (!u.key && items.length === 0) return null;
              if (u.key && count === 0) return null;
              return (
                <PillButton key={u.key} variant={universe === u.key ? "active" : "default"} onClick={() => setUniverse(u.key)}>
                  {u.label}{count > 0 && <span className="opacity-60 text-[11px]"> ({count})</span>}
                </PillButton>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: "var(--muted)" }}>Loading market listings...</div>
        ) : error ? (
          <div className="text-center py-20 text-sm text-red-400">{error}</div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20">
            <div className="mb-3 flex justify-center" style={{ color: "var(--theme-gold)" }}><Glyph name="bag" size={40} /></div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {search || universe
                ? "No listings match your filters."
                : "No items for sale yet. Mark items as For Sale in your vault to list them here."}
            </div>
            {(search || universe) && (
              <PillButton className="mt-3" onClick={() => { setSearch(""); setUniverse(""); }}>Clear filters</PillButton>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {displayed.map((item) => (
              <MarketCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {!loading && displayed.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pb-12 text-center text-xs" style={{ color: "var(--muted)" }}>
          The Marketplace is contact-only. Click any listing to visit the seller&apos;s public vault and reach out.
          No payments are processed through VLTD.
        </div>
      )}
    </div>
  );
}
