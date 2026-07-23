"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 72;   // px of pull needed to trigger
const MAX_PULL  = 110;  // max visual travel

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const scrollRef     = useRef<HTMLDivElement>(null);
  const touchStartY   = useRef(0);
  const isPulling     = useRef(false);
  const router        = useRouter();

  const [pullY,      setPullY]      = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // ── Touch handlers ────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: TouchEvent) => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 2) return;          // only trigger at very top
    // Don't hijack drags inside opted-out regions (e.g. the crop editor), or
    // a crop drag reads as a pull-to-refresh and reloads the page.
    const target = e.target as Element | null;
    if (target?.closest?.("[data-no-pull-refresh]")) return;
    touchStartY.current = e.touches[0].clientY;
    isPulling.current   = true;
  }, []);

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling.current || refreshing) return;
      const el = scrollRef.current;
      if (!el || el.scrollTop > 2) {
        isPulling.current = false;
        setPullY(0);
        return;
      }
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta <= 0) { setPullY(0); return; }

      // Resistance: feels like stretching a rubber band
      const clamped = Math.min(Math.pow(delta, 0.75) * 2.2, MAX_PULL);
      setPullY(clamped);
      if (clamped > 6) e.preventDefault();        // stop scroll bleed
    },
    [refreshing]
  );

  const onTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      setPullY(THRESHOLD * 0.65);                 // settle while spinning

      try {
        const { syncVaultItemsFromSupabase } = await import("@/lib/vaultModel");
        await syncVaultItemsFromSupabase();
        router.refresh();
      } catch { /* non-fatal */ } finally {
        await new Promise((r) => setTimeout(r, 700));
        setRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  }, [pullY, router]);

  // ── Attach / detach ───────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });
    el.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  // ── Derived visual state ──────────────────────────────────────────────
  const progress   = Math.min(pullY / THRESHOLD, 1);
  const ready      = progress >= 1;
  const indicatorH = pullY > 0 || refreshing ? Math.round(pullY * 0.62) : 0;

  const spinnerBorderTop = ready || refreshing
    ? "#C9A84C"
    : `rgba(201,168,76,${(progress * 0.9 + 0.1).toFixed(2)})`;

  return (
    <div
      ref={scrollRef}
      className="vltd-content-wrap"
      style={{
        position:                  "fixed",
        top:                       "var(--topnav-h)",
        left:                      0,
        right:                     0,
        bottom:                    "calc(var(--bottomnav-h) + max(env(safe-area-inset-bottom, 0px), 0px))",
        overflowY:                 "auto",
        WebkitOverflowScrolling:   "touch",
        overscrollBehaviorY:       "contain",
      }}
    >
      {/* ── Pull indicator ── */}
      <div
        aria-hidden
        style={{
          display:        "flex",
          justifyContent: "center",
          alignItems:     "flex-end",
          height:         indicatorH,
          overflow:       "hidden",
          transition:     (!refreshing && pullY === 0) ? "height 0.28s cubic-bezier(.4,0,.2,1)" : "none",
          pointerEvents:  "none",
          paddingBottom:  indicatorH > 0 ? 8 : 0,
        }}
      >
        {(pullY > 4 || refreshing) && (
          <div
            style={{
              width:          28,
              height:         28,
              borderRadius:   "50%",
              border:         "2.5px solid rgba(255,255,255,0.12)",
              borderTopColor: spinnerBorderTop,
              transform:      refreshing ? undefined : `rotate(${Math.round(progress * 300)}deg)`,
              animation:      refreshing ? "ptr-spin 0.65s linear infinite" : "none",
              transition:     refreshing ? "none" : "border-top-color 0.15s",
              opacity:        progress > 0.15 ? 1 : progress / 0.15,
            }}
          />
        )}
      </div>

      {children}
    </div>
  );
}
