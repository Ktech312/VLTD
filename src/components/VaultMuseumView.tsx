"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { LockKeyhole } from "lucide-react";
import { isNotable, notableReason } from "@/lib/itemIntelligence";
import { itemCurrentValue, itemProfit, itemTotalCost } from "@/lib/portfolioMetrics";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import type { VaultItem as ModelItem } from "@/lib/vaultModel";

function money(n: number) {
  if (!Number.isFinite(n) || n === 0) return "-";
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

function museumAllImages(i: ModelItem): string[] {
  const urls: string[] = [];
  if (i.imageFrontUrl) urls.push(i.imageFrontUrl);
  if (i.imageBackUrl && i.imageBackUrl !== i.imageFrontUrl) urls.push(i.imageBackUrl);
  if (Array.isArray(i.images)) {
    for (const img of i.images) {
      const u = img?.url || img?.storageKey || "";
      if (u && !urls.includes(u)) urls.push(u);
    }
  }
  return urls.filter(Boolean);
}

function itemUniverseKey(i: ModelItem): UniverseKey {
  return (i.universe ?? "MISC") as UniverseKey;
}

function itemGradeShort(i: ModelItem): string | null {
  const g = i.grade?.trim();
  if (!g) return null;
  return g.length > 10 ? g.slice(0, 10) : g;
}

function PrivateBadge({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={[
        "pointer-events-none inline-flex items-center gap-1 rounded-full bg-black/68 font-bold uppercase tracking-[0.1em] text-white/72 ring-1 ring-white/14 backdrop-blur",
        compact ? "px-1.5 py-0.5 text-[8px]" : "px-2.5 py-1 text-[10px]",
      ].join(" ")}
      title="Private item"
    >
      <LockKeyhole size={compact ? 10 : 12} strokeWidth={2.2} aria-hidden="true" />
      Private
    </div>
  );
}

function SpotlightCard({ item }: { item: ModelItem }) {
  const grade = itemGradeShort(item);
  const cost = itemTotalCost(item);
  const value = itemCurrentValue(item);
  const gain = itemProfit(item);
  const notable = isNotable(item);
  const reason = notable ? notableReason(item) : null;
  const allImages = museumAllImages(item);
  const universeName = UNIVERSE_LABEL[itemUniverseKey(item)] ?? "Collection";
  const label = item.categoryLabel ?? universeName;
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    if (allImages.length <= 1) return;
    const timer = window.setInterval(() => {
      setImgIndex((prev) => (prev + 1) % allImages.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [allImages.length]);

  const currentImg = allImages[imgIndex] ?? "";

  return (
    <div
      className="overflow-hidden rounded-[20px] ring-1 ring-[color:var(--border)]"
      style={{ background: "var(--surface)" }}
    >
      <div
        className="relative w-full"
        style={{
          background: "var(--pill)",
          height: 220,
          overflow: "hidden",
        }}
      >
        {currentImg ? (
          <div className="absolute inset-0 flex items-center justify-center px-5 pb-14 pt-4">
            <div className="relative flex h-full max-h-[184px] w-full max-w-[190px] items-center justify-center">
              {allImages.length > 1 &&
                allImages.slice(1, 3).map((src, i) => (
                  <div
                    key={`${src}-${i}`}
                    className="absolute inset-0 overflow-hidden rounded-[16px] ring-1"
                    style={{
                      background: "var(--pill)",
                      borderColor: "rgba(245,181,72,0.18)",
                      boxShadow: "0 8px 22px rgba(0,0,0,0.28)",
                      opacity: i === 0 ? 0.62 : 0.38,
                      transform: `translate(${(i + 1) * 10}px, ${-(i + 1) * 7}px) rotate(${(i + 1) * 2}deg)`,
                      zIndex: i + 1,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-contain"
                      loading="lazy"
                      draggable={false}
                    />
                  </div>
                ))}
              <div
                className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-[16px] ring-1"
                style={{
                  background: "rgba(10,16,30,0.72)",
                  borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))",
                  boxShadow: "0 16px 40px rgba(0,0,0,0.36)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={currentImg}
                  src={currentImg}
                  alt={item.title}
                  className="h-full w-full object-contain transition-opacity duration-500"
                  loading="lazy"
                  draggable={false}
                />
              </div>
            </div>
          </div>
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

        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(transparent 40%, rgba(0,0,0,0.72) 100%)" }}
        />

        {notable && reason && (
          <div
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ring-1"
            style={{
              background: "var(--theme-gold-subtle, rgba(245,181,72,0.15))",
              borderColor: "var(--theme-gold-border, rgba(245,181,72,0.4))",
              color: "var(--theme-gold, #F5B548)",
            }}
          >
            Key Item
          </div>
        )}

        {!item.isPublic ? (
          <div className="absolute left-3 top-12">
            <PrivateBadge />
          </div>
        ) : null}

        {grade && (
          <div
            className="absolute right-3 top-3 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1"
            style={{
              background: "rgba(10,8,0,0.8)",
              borderColor: "var(--theme-gold-border, rgba(245,181,72,0.45))",
              color: "var(--theme-gold, #F5B548)",
            }}
          >
            {grade}
          </div>
        )}

        {allImages.length > 1 && (
          <div className="absolute bottom-10 left-1/2 flex gap-1" style={{ transform: "translateX(-50%)" }}>
            {allImages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show image ${i + 1}`}
                onClick={() => setImgIndex(i)}
                style={{
                  background: i === imgIndex ? "#F5B548" : "rgba(255,255,255,0.35)",
                  border: "none",
                  borderRadius: 99,
                  cursor: "pointer",
                  height: 6,
                  padding: 0,
                  transition: "width 0.2s, background 0.2s",
                  width: i === imgIndex ? 16 : 6,
                }}
              />
            ))}
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="min-w-0 pr-12">
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>
              {label}
            </div>
            <div className="mt-0.5 truncate text-lg font-bold leading-tight" style={{ color: "#F0EAD6" }}>
              {item.title}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>
              Value
            </div>
            <div className="text-xl font-bold" style={{ color: "var(--theme-gold, #F5B548)" }}>
              {money(value)}
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-4 px-4 py-3"
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
            <div className="mt-0.5 text-sm font-semibold" style={{ color: gainColor(gain) }}>
              {gain >= 0 ? "+" : ""}
              {money(gain)}
            </div>
          </div>
        )}
        {notable && reason && (
          <div>
            <div className="text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
              Notable
            </div>
            <div className="mt-0.5 text-xs" style={{ color: "var(--theme-gold, #F5B548)" }}>
              {reason}
            </div>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/vault/item/${item.id}`}
            aria-label="Open item detail"
            className="flex items-center justify-center rounded-full transition-opacity hover:opacity-90"
            style={{
              background: "rgba(59,130,246,0.9)",
              border: "1.5px solid rgba(255,255,255,0.22)",
              boxShadow: "0 2px 10px rgba(59,130,246,0.45)",
              color: "#fff",
              flexShrink: 0,
              height: 28,
              textDecoration: "none",
              width: 28,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path
                d="M1 4.5V1h3.5M8.5 1H12v3.5M12 8.5V12H8.5M4.5 12H1V8.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <a
            href={`/vault/item/${item.id}`}
            className="text-[11px] font-semibold transition-opacity hover:opacity-80"
            style={{ color: "var(--theme-gold, #F5B548)" }}
          >
            View details →
          </a>
        </div>
      </div>
    </div>
  );
}

function MuseumCard({
  item,
  isActive = false,
}: {
  item: ModelItem;
  isActive?: boolean;
}) {
  const grade = itemGradeShort(item);
  const value = itemCurrentValue(item);
  const notable = isNotable(item);
  const imgSrc = museumImgSrc(item);

  return (
    <div
      className="flex-shrink-0 select-none"
      style={{
        position: "relative",
        transform: isActive ? "translateY(-10px) scale(1.07)" : "translateY(0) scale(1)",
        transformOrigin: "center center",
        transition: "transform 0.25s cubic-bezier(0.34,1.2,0.64,1)",
        width: 140,
        zIndex: isActive ? 2 : 1,
      }}
      draggable={false}
    >
      <div
        className="overflow-hidden rounded-[14px] ring-1 transition-all duration-300"
        style={{
          background: "var(--surface)",
          borderColor: isActive
            ? "var(--theme-gold-border, rgba(245,181,72,0.55))"
            : "var(--border)",
          boxShadow: isActive
            ? "0 0 0 2px rgba(245,181,72,0.75), 0 4px 28px rgba(245,181,72,0.45)"
            : "none",
        }}
      >
        <div
          className="relative w-full overflow-hidden"
          style={{ background: "var(--pill)", cursor: "default", height: 168 }}
          onClick={(event) => event.preventDefault()}
        >
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
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

          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(transparent 50%, rgba(0,0,0,0.78) 100%)" }}
          />

          {notable && (
            <div
              className="absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ring-1"
              style={{
                background: "rgba(245,181,72,0.15)",
                borderColor: "rgba(245,181,72,0.4)",
                color: "var(--theme-gold, #F5B548)",
              }}
            >
              Key
            </div>
          )}

          {!item.isPublic ? (
            <div className="absolute bottom-1.5 right-1.5">
              <PrivateBadge compact />
            </div>
          ) : null}

          {grade && (
            <div
              className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ring-1"
              style={{
                background: "rgba(10,8,0,0.82)",
                borderColor: "rgba(245,181,72,0.4)",
                color: "var(--theme-gold, #F5B548)",
              }}
            >
              {grade}
            </div>
          )}

          {value > 0 && (
            <div
              className="absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1"
              style={{
                background: "rgba(245,181,72,0.18)",
                borderColor: "rgba(245,181,72,0.45)",
                color: "var(--theme-gold, #F5B548)",
              }}
            >
              {money(value)}
            </div>
          )}
        </div>

        <a
          href={`/vault/item/${item.id}`}
          className="block"
          draggable={false}
          style={{
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            height: 48,
            justifyContent: "center",
            padding: "6px 10px 8px",
          }}
        >
          <div className="line-clamp-1 text-[11px] font-semibold" style={{ color: "var(--fg)" }}>
            {item.title}
          </div>
          {(item.subtitle || item.number || item.grade) && (
            <div className="mt-0.5 line-clamp-1 text-[10px]" style={{ color: "var(--muted)" }}>
              {[item.subtitle, item.number, item.grade].filter(Boolean).join(" · ")}
            </div>
          )}
        </a>
      </div>
    </div>
  );
}

function UniverseSection({
  universeKey,
  items,
  onViewAll,
  onFeaturedChange,
}: {
  universeKey: UniverseKey;
  items: ModelItem[];
  onViewAll: (u: UniverseKey) => void;
  onFeaturedChange?: (item: ModelItem) => void;
}) {
  const label = UNIVERSE_LABEL[universeKey] ?? universeKey;
  const totalValue = items.reduce((sum, i) => sum + itemCurrentValue(i), 0);
  const railRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(items.length > 3);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);

  function updateScrollControls(rail: HTMLDivElement) {
    setCanScrollLeft(rail.scrollLeft > 4);
    setCanScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
  }

  function findCenterIndex(rail: HTMLDivElement): number {
    const railCenter = rail.scrollLeft + rail.clientWidth / 2;
    let bestIndex = 0;
    let bestDistance = Infinity;

    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - railCenter);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    });

    return bestIndex;
  }

  function handleScroll() {
    const rail = railRef.current;
    if (!rail) return;
    updateScrollControls(rail);
    const centered = findCenterIndex(rail);
    setActiveIndex(centered);
    onFeaturedChange?.(items[centered]);
  }

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updateScrollControls(rail);
    return () => {
      cardRefs.current = [];
    };
  }, [items.length]);

  function scrollRailBy(px: number) {
    railRef.current?.scrollBy({ left: px, behavior: "smooth" });
  }

  function onMouseDown(event: MouseEvent<HTMLDivElement>) {
    const rail = railRef.current;
    if (!rail) return;
    isDragging.current = true;
    dragStartX.current = event.clientX;
    dragStartScrollLeft.current = rail.scrollLeft;
    rail.style.cursor = "grabbing";
    rail.style.userSelect = "none";
  }

  function onMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!isDragging.current || !railRef.current) return;
    railRef.current.scrollLeft = dragStartScrollLeft.current - (event.clientX - dragStartX.current);
  }

  function onMouseUpOrLeave() {
    isDragging.current = false;
    if (railRef.current) {
      railRef.current.style.cursor = "grab";
      railRef.current.style.userSelect = "";
    }
  }

  return (
    <div style={{ overflowX: "visible", overflowY: "visible" }}>
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
                borderColor: "var(--theme-gold-border, rgba(245,181,72,0.25))",
                color: "var(--theme-gold, #F5B548)",
              }}
            >
              {money(totalValue)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollRailBy(-300)}
            disabled={!canScrollLeft}
            className="flex h-7 w-7 items-center justify-center rounded-full text-sm ring-1 transition-opacity"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: canScrollLeft ? "var(--fg)" : "var(--muted2)",
              cursor: canScrollLeft ? "pointer" : "default",
              opacity: canScrollLeft ? 1 : 0.35,
            }}
          >
            <ChevronLeft size={15} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollRailBy(300)}
            disabled={!canScrollRight}
            className="flex h-7 w-7 items-center justify-center rounded-full text-sm ring-1 transition-opacity"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: canScrollRight ? "var(--fg)" : "var(--muted2)",
              cursor: canScrollRight ? "pointer" : "default",
              opacity: canScrollRight ? 1 : 0.35,
            }}
          >
            <ChevronRight size={15} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onViewAll(universeKey)}
            className="text-[11px] transition-opacity hover:opacity-80"
            style={{ color: "var(--theme-gold, #F5B548)" }}
          >
            See all →
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        onScroll={handleScroll}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUpOrLeave}
        onMouseLeave={onMouseUpOrLeave}
        className="flex gap-3 overflow-x-auto pb-3 pt-2"
        style={{
          cursor: "grab",
          msOverflowStyle: "none",
          overflowY: "visible",
          scrollbarWidth: "none",
          scrollSnapType: "x mandatory",
        }}
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            style={{ flexShrink: 0, scrollSnapAlign: "center" }}
          >
            <MuseumCard item={item} isActive={i === activeIndex} />
          </div>
        ))}
      </div>
    </div>
  );
}

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
  onFilterToUniverse: (u: UniverseKey) => void;
}) {
  const [featuredOverride, setFeaturedOverride] = useState<ModelItem | null>(null);

  const defaultSpotlight = (() => {
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

  const validFeaturedOverride =
    featuredOverride && items.some((item) => item.id === featuredOverride.id)
      ? featuredOverride
      : null;
  const spotlight = validFeaturedOverride ?? defaultSpotlight;

  const universeGroups = (() => {
    const groups: Partial<Record<UniverseKey, ModelItem[]>> = {};
    for (const item of items) {
      const u = itemUniverseKey(item);
      if (!groups[u]) groups[u] = [];
      groups[u]!.push(item);
    }
    return groups;
  })();

  const orderedUniverses = UNIVERSE_ORDER.filter((u) => (universeGroups[u]?.length ?? 0) > 0);

  if (items.length === 0) return null;

  return (
    <div className="space-y-8">
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
                  borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))",
                  color: "var(--theme-gold, #F5B548)",
                }}
              >
                Key Item
              </span>
            )}
          </div>
          <SpotlightCard key={spotlight.id} item={spotlight} />
        </div>
      )}

      {orderedUniverses.map((u) => {
        const sectionItems = universeGroups[u] ?? [];
        return (
          <UniverseSection
            key={u}
            universeKey={u}
            items={sectionItems}
            onViewAll={onFilterToUniverse}
            onFeaturedChange={setFeaturedOverride}
          />
        );
      })}
    </div>
  );
}
