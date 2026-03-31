// Path: src/components/UniverseRail.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UNIVERSE_ICON, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

export default function UniverseRail({
  value,
  onChange,
  counts,
}: {
  value: UniverseKey | "ALL";
  onChange: (v: UniverseKey | "ALL") => void;
  counts?: Partial<Record<UniverseKey, number>>;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);

  const universes: (UniverseKey | "ALL")[] = useMemo(
    () => ["ALL", "POP_CULTURE", "SPORTS", "TCG", "GAMES", "MUSIC", "JEWELRY_APPAREL", "MISC"],
    []
  );

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;

    // small epsilon to avoid flicker due to fractional pixels
    const x = el.scrollLeft;
    const eps = 2;

    setCanScrollLeft(x > eps);
    setCanScrollRight(x < max - eps);
  }

  useEffect(() => {
    updateScrollState();

    const el = railRef.current;
    if (!el) return;

    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  // When selection changes, ensure the active pill is visible (mobile win).
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;

    const active = el.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;

    // Use nearest to avoid annoying jumps
    active.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [value]);

  return (
    <div className="mt-2">
      {/* Mobile wins:
          - snap scrolling so it feels "native"
          - hide scrollbar (still scrollable)
          - larger tap targets (>=44px)
          - edge fade that only shows when there is more to scroll
          - auto-scroll active pill into view
      */}
      <div className="relative">
        {/* edge fades (only when needed) */}
        {canScrollLeft ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[color:var(--bg)] to-transparent" />
        ) : null}
        {canScrollRight ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[color:var(--bg)] to-transparent" />
        ) : null}

        <div
          ref={railRef}
          className={[
            "flex gap-2 overflow-x-auto pb-2",
            "snap-x snap-mandatory",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "overscroll-x-contain",
            // space so fades don't cover content (only matters when fades are visible)
            "pr-6 pl-6",
          ].join(" ")}
          role="tablist"
          aria-label="Universe filter"
        >
          {universes.map((u) => {
            const active = value === u;
            const label = u === "ALL" ? "All" : UNIVERSE_LABEL[u];
            const icon = u === "ALL" ? "✨" : UNIVERSE_ICON[u];
            const count = u === "ALL" ? undefined : counts?.[u];

            return (
              <button
                key={u}
                type="button"
                role="tab"
                aria-selected={active}
                data-active={active ? "true" : "false"}
                onClick={() => onChange(u)}
                className={[
                  "snap-start",
                  // ✅ mobile tap target + comfortable pill sizing
                  "inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-2xl px-4",
                  // ✅ prevent iOS zoom + nice density on desktop
                  "text-[16px] sm:text-sm font-medium ring-1 transition select-none active:scale-[0.98]",
                  // ✅ slightly larger hit area without changing visual height
                  "py-2",
                  active
                    ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)] font-semibold"
                    : "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                ].join(" ")}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="font-medium">{label}</span>

                {typeof count === "number" && (
                  <span
                    className={[
                      "ml-1 rounded-full px-2 py-0.5 text-xs ring-1",
                      active
                        ? "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--border)]"
                        : "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--border)]",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}