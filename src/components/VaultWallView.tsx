"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { useResolvedVaultImage } from "@/lib/useResolvedVaultImages";
import { type VaultItem } from "@/lib/vaultModel";

/* ── Types ─────────────────────────────────────────────────────── */

type SaleInfo = { id: string; soldPrice?: number; soldAt?: number };

interface VaultWallViewProps {
  items: VaultItem[];
  saleMap: Record<string, SaleInfo | undefined>;
}

/* ── Constants ─────────────────────────────────────────────────── */

const UNIVERSE_ORDER: UniverseKey[] = [
  "POP_CULTURE", "SPORTS", "TCG", "MUSIC",
  "JEWELRY_APPAREL", "GAMES", "BUILT_BOTANY", "ART", "AUTOMOTIVE", "MISC",
];

const SHORT_LABEL: Record<UniverseKey, string> = {
  POP_CULTURE:     "Pop Culture",
  SPORTS:          "Sports",
  TCG:             "TCG",
  MUSIC:           "Music",
  JEWELRY_APPAREL: "Jewelry",
  GAMES:           "Games",
  BUILT_BOTANY:    "Botany",
  MISC:            "Misc",
  AUTOMOTIVE:      "Auto",
  ART:             "Art",
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

/* ── Small cover tile ──────────────────────────────────────────── */

function WallTile({
  item,
  isSold,
}: {
  item: VaultItem;
  isSold: boolean;
}) {
  const image = useResolvedVaultImage(item);
  const href = isSold ? `/vault/item/${item.id}?sold=1` : `/vault/item/${item.id}`;

  return (
    <Link
      href={href}
      title={item.title}
      className="group relative block overflow-hidden rounded-[6px] bg-black/30 ring-1 ring-white/8 transition hover:ring-gold/40 hover:scale-[1.04]"
      style={{ aspectRatio: "2/3" }}
    >
      {image ? (
        <ProgressiveImage
          src={image}
          alt={item.title}
          className="h-full w-full"
          imageClassName="object-cover object-center"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold uppercase tracking-widest text-white/20">
          No<br />photo
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <p className="w-full px-1 pb-1 text-center text-[9px] font-semibold text-white leading-tight line-clamp-2">
          {item.title}
        </p>
      </div>

      {isSold && (
        <span className="absolute left-1 top-1 rounded-full bg-amber-500/90 px-1 py-px text-[7px] font-bold text-black">
          SOLD
        </span>
      )}
    </Link>
  );
}

/* ── Main component ────────────────────────────────────────────── */

export default function VaultWallView({ items, saleMap }: VaultWallViewProps) {
  // Universe multi-select: empty Set = All
  const [selectedUniverses, setSelectedUniverses] = useState<Set<UniverseKey>>(new Set());
  const [cols, setCols] = useState(7);
  const [query, setQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Advanced filter state
  const [gradeFilter, setGradeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [storageFilter, setStorageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showSold, setShowSold] = useState(false);
  const [gradedOnly, setGradedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"" | "FOR_SALE" | "COLLECTION" | "AUCTION">("");

  /* Universe inference */
  function inferUniverse(item: VaultItem): UniverseKey {
    const raw = typeof item.universe === "string" ? item.universe.trim().toUpperCase() : "";
    if (raw && UNIVERSE_LABEL[raw as UniverseKey]) return raw as UniverseKey;
    return "MISC";
  }

  /* Toggle a universe pill */
  function toggleUniverse(key: UniverseKey) {
    setSelectedUniverses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  /* Filtered + sorted items */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const grade = gradeFilter.trim().toLowerCase();
    const cat = categoryFilter.trim().toLowerCase();
    const storage = storageFilter.trim().toLowerCase();
    const source = sourceFilter.trim().toLowerCase();

    return items
      .filter((item) => {
        const isSold = Boolean(saleMap[item.id]) || item.status === "SOLD";

        // Sold visibility
        if (!showSold && isSold) return false;

        // Universe multi-select (empty = show all)
        if (selectedUniverses.size > 0 && !selectedUniverses.has(inferUniverse(item))) return false;

        // Graded only
        if (gradedOnly && !item.grade) return false;

        // Status filter
        if (statusFilter && item.status !== statusFilter) return false;

        // Advanced: grade
        if (grade && !String(item.grade ?? "").toLowerCase().includes(grade)) return false;

        // Advanced: category
        if (cat) {
          const itemCat = [item.categoryLabel, item.customCategoryLabel, item.subcategoryLabel, item.category]
            .filter(Boolean).join(" ").toLowerCase();
          if (!itemCat.includes(cat)) return false;
        }

        // Advanced: storage
        if (storage && !String(item.storageLocation ?? "").toLowerCase().includes(storage)) return false;

        // Advanced: source
        if (source && !String(item.purchaseSource ?? "").toLowerCase().includes(source)) return false;

        // Main search
        if (q) {
          const text = [
            item.title, item.subtitle, item.number, item.notes,
            item.categoryLabel, item.grade, item.certNumber,
            item.storageLocation, item.purchaseSource,
          ].filter(Boolean).join(" ").toLowerCase();
          if (!text.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? "")));
  }, [items, selectedUniverses, query, gradeFilter, categoryFilter, storageFilter, sourceFilter, showSold, gradedOnly, statusFilter, saleMap]);

  /* Group by first letter */
  const grouped = useMemo(() => {
    const map: Record<string, VaultItem[]> = {};
    for (const item of filtered) {
      const first = (item.title ?? "").trim().toUpperCase()[0] ?? "#";
      const key = /[A-Z]/.test(first) ? first : "#";
      (map[key] ??= []).push(item);
    }
    return map;
  }, [filtered]);

  const activeLetters = useMemo(() => new Set(Object.keys(grouped)), [grouped]);

  function jumpTo(letter: string) {
    letterRefs.current[letter]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* Universe counts (unfiltered, for pill badges) */
  const universeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 };
    for (const item of items) {
      const isSold = Boolean(saleMap[item.id]) || item.status === "SOLD";
      if (!showSold && isSold) continue;
      const u = inferUniverse(item);
      counts[u] = (counts[u] ?? 0) + 1;
      counts.ALL++;
    }
    return counts;
  }, [items, saleMap, showSold]);

  const isAllSelected = selectedUniverses.size === 0;

  const hasAdvancedFilters = gradeFilter || categoryFilter || storageFilter || sourceFilter || gradedOnly || statusFilter;

  return (
    <div className="mt-3 max-w-[1500px] mx-auto px-3">
      {/* ── Controls bar ── */}
      <div
        className="sticky top-0 z-20 rounded-[14px] px-3 py-2.5 mb-3"
        style={{
          background: "var(--theme-card, rgba(10,18,36,0.96))",
          border: "1px solid var(--theme-border, rgba(203,208,213,0.12))",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Row 1: search + size slider + item count */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-8 rounded-full bg-white/8 px-3 text-[13px] ring-1 ring-white/12 focus:outline-none focus:ring-gold/40 w-40"
          />

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-white/40">Size</span>
            <input
              type="range"
              min={3}
              max={14}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
              className="w-28 accent-gold"
            />
            <span className="text-[11px] text-white/40 w-4">{cols}</span>
          </div>

          <span className="text-[11px] text-white/40">{filtered.length} items</span>
        </div>

        {/* Row 2: universe pills (multi-select) */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {/* All pill */}
          <button
            type="button"
            onClick={() => setSelectedUniverses(new Set())}
            className={[
              "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition",
              isAllSelected
                ? "bg-gold/20 text-gold ring-gold/40"
                : "bg-white/6 text-white/55 ring-white/12 hover:text-white/80",
            ].join(" ")}
          >
            All ({universeCounts.ALL ?? 0})
          </button>

          {UNIVERSE_ORDER.map((key) => {
            const count = universeCounts[key] ?? 0;
            if (count === 0) return null;
            const active = selectedUniverses.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleUniverse(key)}
                className={[
                  "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition",
                  active
                    ? "bg-gold/20 text-gold ring-gold/40"
                    : "bg-white/6 text-white/55 ring-white/12 hover:text-white/80",
                ].join(" ")}
              >
                {SHORT_LABEL[key]} ({count})
              </button>
            );
          })}
        </div>

        {/* Row 3: A–Z nav + Advanced toggle */}
        <div className="mt-2 flex items-center gap-1">
          <div className="flex gap-0.5 overflow-x-auto pb-0.5 flex-1" style={{ scrollbarWidth: "none" }}>
            {LETTERS.map((letter) => {
              const active = activeLetters.has(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!active}
                  onClick={() => jumpTo(letter)}
                  className={[
                    "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold transition",
                    active
                      ? "text-white/80 hover:bg-gold/20 hover:text-gold"
                      : "text-white/18 cursor-default",
                  ].join(" ")}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={[
              "ml-2 shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition flex items-center gap-1",
              showAdvanced || hasAdvancedFilters
                ? "bg-gold/20 text-gold ring-gold/40"
                : "bg-white/6 text-white/50 ring-white/12 hover:text-white/80",
            ].join(" ")}
          >
            {hasAdvancedFilters && (
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            )}
            Advanced
            <svg viewBox="0 0 10 6" className={["h-2.5 w-2.5 transition-transform", showAdvanced ? "rotate-180" : ""].join(" ")} fill="currentColor">
              <path d="M0 0l5 6 5-6z" />
            </svg>
          </button>
        </div>

        {/* Advanced panel */}
        {showAdvanced && (
          <div
            className="mt-2 rounded-[10px] p-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* Grade */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/35">Grade</label>
              <input
                type="text"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                placeholder="e.g. 9.8, PSA 10"
                className="h-7 w-full rounded-md bg-white/8 px-2 text-[12px] ring-1 ring-white/12 focus:outline-none focus:ring-gold/40"
              />
            </div>

            {/* Category */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/35">Category</label>
              <input
                type="text"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                placeholder="e.g. Comics, TCG"
                className="h-7 w-full rounded-md bg-white/8 px-2 text-[12px] ring-1 ring-white/12 focus:outline-none focus:ring-gold/40"
              />
            </div>

            {/* Storage location */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/35">Storage</label>
              <input
                type="text"
                value={storageFilter}
                onChange={(e) => setStorageFilter(e.target.value)}
                placeholder="e.g. Box A, Shelf 3"
                className="h-7 w-full rounded-md bg-white/8 px-2 text-[12px] ring-1 ring-white/12 focus:outline-none focus:ring-gold/40"
              />
            </div>

            {/* Purchase source */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/35">Source</label>
              <input
                type="text"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                placeholder="e.g. eBay, LCS"
                className="h-7 w-full rounded-md bg-white/8 px-2 text-[12px] ring-1 ring-white/12 focus:outline-none focus:ring-gold/40"
              />
            </div>

            {/* Status */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/35">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="h-7 w-full rounded-md bg-[color:var(--theme-card,#0f1a2d)] px-2 text-[12px] ring-1 ring-white/12 focus:outline-none focus:ring-gold/40"
              >
                <option value="">Any</option>
                <option value="COLLECTION">Collection</option>
                <option value="FOR_SALE">For Sale</option>
                <option value="AUCTION">Auction</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div className="flex flex-col gap-2 justify-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gradedOnly}
                  onChange={(e) => setGradedOnly(e.target.checked)}
                  className="accent-gold h-3.5 w-3.5"
                />
                <span className="text-[12px] text-white/70">Graded only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSold}
                  onChange={(e) => setShowSold(e.target.checked)}
                  className="accent-gold h-3.5 w-3.5"
                />
                <span className="text-[12px] text-white/70">Show sold items</span>
              </label>
            </div>

            {/* Clear advanced */}
            {hasAdvancedFilters && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setGradeFilter("");
                    setCategoryFilter("");
                    setStorageFilter("");
                    setSourceFilter("");
                    setGradedOnly(false);
                    setStatusFilter("");
                  }}
                  className="text-[11px] text-white/40 hover:text-white/70 underline underline-offset-2"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cover grid ── */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-[13px] text-white/30">No items match.</div>
      ) : (
        <div className="space-y-6 pb-16">
          {LETTERS.map((letter) => {
            const group = grouped[letter];
            if (!group?.length) return null;
            return (
              <div
                key={letter}
                ref={(el) => { letterRefs.current[letter] = el; }}
              >
                <div className="mb-2 text-[11px] font-bold tracking-[0.2em] text-white/30">
                  {letter}
                </div>
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {group.map((item) => (
                    <WallTile
                      key={item.id}
                      item={item}
                      isSold={Boolean(saleMap[item.id]) || item.status === "SOLD"}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
