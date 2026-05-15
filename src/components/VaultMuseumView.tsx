"use client";

// VaultMuseumView.tsx
// Renders the "Museum" browse mode: spotlight hero + universe carousel rails.
// Drop-in alongside the existing GalleryWall view in VaultInner.tsx.

import { isNotable, notableReason } from "@/lib/itemIntelligence";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import type { VaultItem as ModelItem } from "@/lib/vaultModel";
import { itemTotalCost, itemCurrentValue, itemProfit } from "@/lib/portfolioMetrics";

// ─── helpers ─────────────────────────────────────────────────────────────────

function money(n: number) {
  if (!Number.isFinite(n) || n === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function gainColor(n: number) {
  if (n > 0) return "var(--gain-positive, #4ade80)";
  if (n < 0) return "var(--gain-negative, #f87171)";
  return "var(--muted)";
}

function museumImgSrc(i: ModelItem): string {
  return i.imageFrontUrl || "";
}

function itemUniverseKey(i: ModelItem): UniverseKey {
  return ((i.universe ?? "MISC") as UniverseKey);
}

function itemGradeShort(i: ModelItem): string | null {
  const g = i.grade?.trim();
  if (!g) return null;
  // truncate long grades to ~10 chars for badge
  return g.length > 10 ? g.slice(0, 10) : g;
}

// ─── Spotlight hero card ──────────────────────────────────────────────────────

function SpotlightCard({ item }: { item: ModelItem }) {
  const grade = itemGradeShort(item);
  const cost = itemTotalCost(item);
  const value = itemCurrentValue(item);
  const gain = itemProfit(item);
  const notable = isNotable(item);
  const reason = notable ? notableReason(item) : null;
  const imgSrc = museumImgSrc(item);
  const universeName = UNIVERSE_LABEL[itemUniverseKey(item)] ?? "Collection";
  const label = item.categoryLabel ?? universeName;

  return (
    <a
      href={`/vault/item/${item.id}`}
      className="block group"
      draggable={false}
    >
      <div
        className="rounded-[20px] overflow-hidden ring-1 ring-[color:var(--border)] transition-all duration-300 group-hover:ring-[color:var(--theme-gold-border,rgba(245,181,72,0.4))]"
        style={{ background: "var(--surface)" }}
      >
        {/* Image section */}
        <div className="relative w-full" style={{ aspectRatio: "16/9", overflow: "hidden", background: "var(--pill)" }}>
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div
                className="text-[11px] font-bold uppercase tracking-[0.28em]"
                style={{ color: "var(--muted2)" }}
              >
                {label}
              </div>
            </div>
          )}

          {/* Dark gradient overlay for readability */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(transparent 40%, rgba(0,0,0,0.72) 100%)" }}
          />

          {/* Notable badge — top left */}
          {notable && reason && (
            <div
              className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ring-1"
              style={{
                background: "var(--theme-gold-subtle, rgba(245,181,72,0.15))",
                color: "var(--theme-gold, #F5B548)",
                borderColor: "var(--theme-gold-border, rgba(245,181,72,0.4))",
              }}
            >
              ★ Key Item
            </div>
          )}

          {/* Grade badge — top right */}
          {grade && (
            <div
              className="absolute right-3 top-3 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1"
              style={{
                background: "rgba(10,8,0,0.8)",
                color: "var(--theme-gold, #F5B548)",
                borderColor: "var(--theme-gold-border, rgba(245,181,72,0.45))",
              }}
            >
              {grade}
            </div>
          )}

          {/* Value overlay — bottom left */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                {label}
              </div>
              <div className="mt-0.5 text-lg font-bold leading-tight" style={{ color: "#F0EAD6" }}>
                {item.title}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                Value
              </div>
              <div className="text-xl font-bold" style={{ color: "var(--theme-gold, #F5B548)" }}>
                {money(value)}
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div
          className="flex items-center gap-4 px-4 py-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {cost > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
                Cost Basis
              </div>
              <div className="mt-0.5 text-sm font-semibold" style={{ color: "var(--fg)" }}>
                {money(cost)}
              </div>
            </div>
          )}
          {cost > 0 && value > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
                Gain / Loss
              </div>
              <div
                className="mt-0.5 text-sm font-semibold"
                style={{ color: gainColor(gain) }}
              >
                {gain >= 0 ? "+" : ""}
                {money(gain)}
              </div>
            </div>
          )}
          {notable && reason && (
            <div className="ml-auto text-right">
              <div className="text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
                Notable
              </div>
              <div className="mt-0.5 text-xs" style={{ color: "var(--theme-gold, #F5B548)" }}>
                {reason}
              </div>
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

// ─── Museum carousel card ─────────────────────────────────────────────────────

function MuseumCard({ item }: { item: ModelItem }) {
  const grade = itemGradeShort(item);
  const value = itemCurrentValue(item);
  const notable = isNotable(item);
  const imgSrc = museumImgSrc(item);

  return (
    <a
      href={`/vault/item/${item.id}`}
      className="block group flex-shrink-0"
      style={{ width: "130px" }}
      draggable={false}
    >
      <div
        className="overflow-hidden rounded-[14px] ring-1 transition-all duration-300 group-hover:ring-[color:var(--theme-gold-border,rgba(245,181,72,0.4))]"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Image */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: "3/4", background: "var(--pill)" }}
        >
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div
                className="text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: "var(--muted2)" }}
              >
                VLTD
              </div>
            </div>
          )}

          {/* Gradient overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(transparent 50%, rgba(0,0,0,0.75) 100%)" }}
          />

          {/* Notable star — top left */}
          {notable && (
            <div
              className="absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ring-1"
              style={{
                background: "rgba(245,181,72,0.15)",
                color: "var(--theme-gold, #F5B548)",
                borderColor: "rgba(245,181,72,0.4)",
              }}
            >
              ★
            </div>
          )}

          {/* Grade badge — top right */}
          {grade && (
            <div
              className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ring-1"
              style={{
                background: "rgba(10,8,0,0.82)",
                color: "var(--theme-gold, #F5B548)",
                borderColor: "rgba(245,181,72,0.4)",
              }}
            >
              {grade}
            </div>
          )}

          {/* Value overlay — bottom */}
          <div className="absolute bottom-1.5 left-2">
            <div className="text-[11px] font-bold" style={{ color: "#F0EAD6" }}>
              {money(value)}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="px-2.5 pb-2.5 pt-2">
          <div
            className="line-clamp-1 text-[11px] font-semibold"
            style={{ color: "var(--fg)" }}
          >
            {item.title}
          </div>
          {(item.subtitle || item.number || item.grade) && (
            <div
              className="mt-0.5 line-clamp-1 text-[10px]"
              style={{ color: "var(--muted)" }}
            >
              {[item.subtitle, item.number, item.grade].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

// ─── Universe section rail ────────────────────────────────────────────────────

function UniverseSection({
  universeKey,
  items,
  onViewAll,
}: {
  universeKey: UniverseKey;
  items: ModelItem[];
  onViewAll: (u: UniverseKey) => void;
}) {
  const label = UNIVERSE_LABEL[universeKey] ?? universeKey;
  const totalValue = items.reduce((sum, i) => sum + itemCurrentValue(i), 0);

  return (
    <div>
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--theme-gold, #F5B548)", opacity: 0.7 }}
          />
          <span className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
            {label}
          </span>
          <span className="text-[11px]" style={{ color: "var(--muted2)" }}>
            {items.length} items
          </span>
          {totalValue > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
              style={{
                background: "var(--theme-gold-subtle, rgba(245,181,72,0.08))",
                color: "var(--theme-gold, #F5B548)",
                borderColor: "var(--theme-gold-border, rgba(245,181,72,0.25))",
              }}
            >
              {money(totalValue)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onViewAll(universeKey)}
          className="text-[11px] transition-opacity hover:opacity-80"
          style={{ color: "var(--theme-gold, #F5B548)" }}
        >
          See all →
        </button>
      </div>

      {/* Horizontal scroll rail */}
      <div
        className="flex gap-3 overflow-x-auto pb-1"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {items.map((item) => (
          <MuseumCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ─── Main museum view ─────────────────────────────────────────────────────────

const UNIVERSE_ORDER: UniverseKey[] = [
  "TCG",
  "SPORTS",
  "POP_CULTURE",
  "MUSIC",
  "GAMES",
  "JEWELRY_APPAREL",
  "MISC",
];

export default function VaultMuseumView({
  items,
  onFilterToUniverse,
}: {
  items: ModelItem[];
  /** Called when user taps "See all →" on a universe section */
  onFilterToUniverse: (u: UniverseKey) => void;
}) {
  // Pick the spotlight item: first Notable by value, then simply highest-value
  const spotlight = (() => {
    const notableItems = items.filter(isNotable);
    if (notableItems.length > 0) {
      return notableItems.reduce((best, i) =>
        itemCurrentValue(i) > itemCurrentValue(best) ? i : best
      );
    }
    if (items.length === 0) return null;
    return items.reduce((best, i) =>
      itemCurrentValue(i) > itemCurrentValue(best) ? i : best
    );
  })();

  // Group remaining items by universe (spotlight excluded from its section)
  const universeGroups = (() => {
    const groups: Partial<Record<UniverseKey, ModelItem[]>> = {};
    for (const item of items) {
      const u = itemUniverseKey(item);
      if (!groups[u]) groups[u] = [];
      groups[u]!.push(item);
    }
    return groups;
  })();

  // Ordered list of universes that have items
  const orderedUniverses = UNIVERSE_ORDER.filter((u) => (universeGroups[u]?.length ?? 0) > 0);

  if (items.length === 0) return null;

  return (
    <div className="space-y-8">
      {/* Spotlight */}
      {spotlight && (
        <div>
          <div className="mb-3 flex items-center gap-2 px-0.5">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--theme-gold, #F5B548)" }}
            />
            <span className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
              Spotlight
            </span>
            {isNotable(spotlight) && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold ring-1"
                style={{
                  background: "var(--theme-gold-subtle, rgba(245,181,72,0.1))",
                  color: "var(--theme-gold, #F5B548)",
                  borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))",
                }}
              >
                ★ Key Item
              </span>
            )}
          </div>
          <SpotlightCard item={spotlight} />
        </div>
      )}

      {/* Universe sections */}
      {orderedUniverses.map((u) => {
        const sectionItems = universeGroups[u] ?? [];
        return (
          <UniverseSection
            key={u}
            universeKey={u}
            items={sectionItems}
            onViewAll={onFilterToUniverse}
          />
        );
      })}
    </div>
  );
}
