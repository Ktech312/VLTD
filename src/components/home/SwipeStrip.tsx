"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";

/**
 * A row of cards that browses three ways: the arrow buttons, the left/right arrow keys (when the row has focus), and a
 * swipe or drag on touch (native scrolling with snap points, so nothing is hijacked and the page never scrolls sideways).
 * The arrows sit in a small header row beside the caption (never over the cards) and are disabled at either end instead of vanishing.
 */
export default function SwipeStrip({ label, caption, children }: { label: string; caption?: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  const count = Children.count(children);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, count]);

  const page = (dir: 1 | -1, fraction = 0.85) => {
    const el = ref.current;
    if (!el) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * fraction), behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="flex items-center justify-between gap-3 px-3 pt-2.5">
        <div className="min-w-0 text-[12px]" style={{ color: "var(--theme-text-secondary, #9BA0A6)" }}>{caption}</div>
        {count > 1 ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <PillButton onClick={() => page(-1)} disabled={edge.start} ariaLabel="Previous items" title="Previous items" className="w-11 px-0! md:w-9">
              <AppIcon name="back" size={18} />
            </PillButton>
            <PillButton onClick={() => page(1)} disabled={edge.end} ariaLabel="Next items" title="Next items" className="w-11 px-0! md:w-9">
              <AppIcon name="next" size={18} />
            </PillButton>
          </div>
        ) : null}
      </div>
      <div
        ref={ref}
        tabIndex={0}
        aria-label={`${label}. Use the left and right arrow keys, the arrow buttons, or swipe.`}
        onScroll={update}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); page(1, 0.5); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); page(-1, 0.5); }
        }}
        className="flex snap-x snap-mandatory scroll-px-3 gap-2 overflow-x-auto px-3 pb-3 pt-2 [scrollbar-width:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--pill-active-ring)] [&::-webkit-scrollbar]:hidden"
        style={{ overscrollBehaviorX: "contain" }}
      >
        {children}
      </div>
    </div>
  );
}
