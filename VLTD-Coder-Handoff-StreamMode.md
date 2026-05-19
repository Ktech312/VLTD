# VLTD — Task 8: Content / Stream Mode

A fullscreen "presentation display" for individual vault items. Designed for collectors who livestream pack openings or haul reveals. Clean, no chrome, big value reveal, optimized for both 9:16 (TikTok/Reels/vertical stream) and 16:9 (Twitch/YouTube horizontal). Light lift — mostly a new route and a single display component.

---

## Context

Current item detail page (`/vault/item/[id]/page.tsx`) is a scrollable form-heavy view. Stream Mode is a completely different rendering of the same item data — cinematic, fullscreen, built for an audience rather than the collector editing.

No new data infrastructure needed. Reads existing VaultItem fields.

---

## Step 1 — New route: `/vault/item/[id]/present`

**File to create:** `src/app/vault/item/[id]/present/page.tsx`

```tsx
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadItems, type VaultItem } from "@/lib/vaultModel";
import StreamDisplay from "@/components/StreamDisplay";

export default function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<VaultItem | null>(null);

  useEffect(() => {
    const items = loadItems();
    const found = items.find((i) => i.id === id) ?? null;
    setItem(found);
  }, [id]);

  if (!item) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#000" }}>
        <div style={{ color: "#555", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return <StreamDisplay item={item} onClose={() => router.back()} />;
}
```

---

## Step 2 — Create `src/components/StreamDisplay.tsx`

The entire fullscreen experience lives here.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { VaultItem } from "@/lib/vaultModel";
import { UNIVERSE_LABEL } from "@/lib/taxonomy";

type AspectMode = "9x16" | "16x9" | "fill";

type Props = {
  item: VaultItem;
  onClose?: () => void;
};

function effectiveValue(item: VaultItem): number {
  return (
    item.valueMedian ??
    item.currentValue ??
    item.estimatedValue ??
    0
  );
}

function formatMoney(n: number) {
  if (!n) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function universeLabel(item: VaultItem) {
  const k = item.universe?.toUpperCase();
  if (!k) return item.categoryLabel ?? "";
  return (UNIVERSE_LABEL as Record<string, string>)[k] ?? k;
}

export default function StreamDisplay({ item, onClose }: Props) {
  const [aspectMode, setAspectMode] = useState<AspectMode>("fill");
  const [revealed, setRevealed] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const imageUrl = item.imageFrontUrl ?? item.imageBackUrl;
  const value = effectiveValue(item);
  const formattedValue = formatMoney(value);

  // Auto-hide controls after 3s of no interaction
  function resetControlsTimer() {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setShowControls(true);
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }

  useEffect(() => {
    resetControlsTimer();
    return () => { if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aspectStyle: React.CSSProperties =
    aspectMode === "9x16"
      ? { width: "min(100vw, calc(100vh * 9 / 16))", height: "100vh", margin: "0 auto" }
      : aspectMode === "16x9"
      ? { width: "100vw", height: "min(100vh, calc(100vw * 9 / 16))", marginTop: "auto", marginBottom: "auto" }
      : { width: "100vw", height: "100vh" };

  const metaLine = [
    universeLabel(item),
    item.categoryLabel,
    item.number ? `#${item.number}` : null,
    item.grade,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden select-none"
      style={{ background: "#000" }}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
      onClick={() => !revealed && setRevealed(true)}
    >
      {/* Main display area */}
      <div
        className="relative flex flex-col"
        style={{ ...aspectStyle, overflow: "hidden" }}
      >
        {/* Background — blurred image or solid */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(40px) brightness(0.3) saturate(1.4)",
              transform: "scale(1.1)",
              zIndex: 0,
            }}
          />
        )}
        {!imageUrl && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(ellipse at center, #1a1a2e 0%, #000 100%)",
              zIndex: 0,
            }}
          />
        )}

        {/* Content */}
        <div
          className="relative flex flex-col items-center justify-center flex-1 px-8 py-12 gap-6"
          style={{ zIndex: 1 }}
        >
          {/* Item image — center hero */}
          {imageUrl ? (
            <div
              style={{
                flex: "0 0 auto",
                maxHeight: "55%",
                display: "flex",
                alignItems: "center",
                transition: "transform 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s",
                transform: revealed ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
                opacity: revealed ? 1 : 0.6,
                filter: revealed ? "drop-shadow(0 20px 60px rgba(0,0,0,0.8))" : "drop-shadow(0 8px 24px rgba(0,0,0,0.6))",
              }}
            >
              <img
                src={imageUrl}
                alt={item.title}
                style={{
                  maxHeight: "100%",
                  maxWidth: "min(340px, 80vw)",
                  objectFit: "contain",
                  borderRadius: 12,
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 200,
                height: 280,
                borderRadius: 16,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 48 }}>📦</span>
            </div>
          )}

          {/* Text reveal */}
          <div
            className="text-center space-y-2"
            style={{
              transition: "opacity 0.5s, transform 0.5s",
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0)" : "translateY(16px)",
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: "clamp(20px, 4vw, 32px)",
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                textShadow: "0 2px 20px rgba(0,0,0,0.8)",
              }}
            >
              {item.title}
            </div>
            {item.subtitle && (
              <div style={{ fontSize: "clamp(14px, 2.5vw, 18px)", color: "rgba(255,255,255,0.65)" }}>
                {item.subtitle}
              </div>
            )}

            {/* Meta chips */}
            {metaLine && (
              <div style={{ fontSize: "clamp(11px, 1.8vw, 14px)", color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                {metaLine}
              </div>
            )}

            {/* Value — gold reveal */}
            {formattedValue && (
              <div
                style={{
                  fontSize: "clamp(28px, 6vw, 52px)",
                  fontWeight: 900,
                  color: "#F5B548",
                  letterSpacing: "-0.02em",
                  textShadow: "0 0 40px rgba(245,181,72,0.5)",
                  marginTop: 8,
                  transition: "transform 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s, opacity 0.5s 0.2s",
                  opacity: revealed ? 1 : 0,
                  transform: revealed ? "scale(1)" : "scale(0.7)",
                }}
              >
                {formattedValue}
              </div>
            )}
          </div>

          {/* Tap to reveal prompt */}
          {!revealed && (
            <div
              style={{
                position: "absolute",
                bottom: 80,
                left: "50%",
                transform: "translateX(-50%)",
                color: "rgba(255,255,255,0.4)",
                fontSize: 14,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                animation: "pulse 2s ease-in-out infinite",
              }}
            >
              Tap to reveal
            </div>
          )}

          {/* VLTD watermark */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              right: 20,
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.2)",
              textTransform: "uppercase",
            }}
          >
            VLTD
          </div>
        </div>
      </div>

      {/* Controls overlay — fades out */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          pointerEvents: showControls ? "auto" : "none",
          transition: "opacity 0.4s",
          opacity: showControls ? 1 : 0,
        }}
      >
        {/* Top bar */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
          }}
        >
          {/* Aspect mode toggle */}
          <div className="flex gap-2">
            {(["fill", "9x16", "16x9"] as AspectMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={(e) => { e.stopPropagation(); setAspectMode(mode); resetControlsTimer(); }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  background: aspectMode === mode ? "rgba(245,181,72,0.9)" : "rgba(255,255,255,0.15)",
                  color: aspectMode === mode ? "#000" : "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {mode === "fill" ? "Full" : mode}
              </button>
            ))}
          </div>

          {/* Close */}
          {onClose && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 99,
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Bottom: Reset reveal */}
        {revealed && (
          <div
            className="absolute bottom-8 left-1/2"
            style={{ transform: "translateX(-50%)" }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setRevealed(false); resetControlsTimer(); }}
              style={{
                padding: "8px 20px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                background: "rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
            >
              Reset Reveal
            </button>
          </div>
        )}
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
```

---

## Step 3 — "Present" button on item detail

**File:** `src/app/vault/item/[id]/page.tsx`

Add a link near the top action buttons:

```tsx
import Link from "next/link";

// In the action buttons section:
<Link
  href={`/vault/item/${item.id}/present`}
  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition"
  style={{ background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }}
>
  🎬 Stream
</Link>
```

---

## Step 4 — Haul Mode integration (pair with HaulMode handoff)

In `HaulReviewSheet.tsx`, after a user taps an item card during review, give them a "Present this item" option that opens the StreamDisplay inline:

```tsx
// Inside HaulReviewSheet, when an item card is tapped:
const [presentingItem, setPresentingItem] = useState<HaulItem | null>(null);

// In the item card:
<button
  type="button"
  onClick={() => setPresentingItem(item)}
  className="text-[11px] font-semibold"
  style={{ color: "var(--theme-gold, #F5B548)" }}
>
  🎬 Present
</button>

// Modal overlay:
{presentingItem && (
  <StreamDisplay
    item={/* reconstruct VaultItem from HaulItem id via loadItems() */}
    onClose={() => setPresentingItem(null)}
  />
)}
```

---

## Files changed summary

| File | Change |
|------|--------|
| `src/app/vault/item/[id]/present/page.tsx` | New route — loads item by id, renders StreamDisplay |
| `src/components/StreamDisplay.tsx` | New — fullscreen cinematic display, tap-to-reveal, aspect toggle |
| `src/app/vault/item/[id]/page.tsx` | "🎬 Stream" link button |
| `src/components/HaulReviewSheet.tsx` | "Present" button per item in end-of-haul review |

---

## Verify

```bash
npx tsc --noEmit
npx eslint src/components/StreamDisplay.tsx src/app/vault/item/\[id\]/present/page.tsx --max-warnings=0
npm run build
```

Test checklist:
- [ ] "🎬 Stream" button visible on item detail page
- [ ] Navigates to `/vault/item/[id]/present` — fullscreen black background
- [ ] Item image renders centered, slightly dim before reveal
- [ ] "Tap to reveal" pulse prompt visible before tap
- [ ] First tap: image scales up with spring animation, title/grade slide in, value pops gold
- [ ] Value number shows with gold glow
- [ ] "Reset Reveal" button appears after reveal, resets to pre-tap state
- [ ] Aspect controls work: Full, 9×16, 16×9 — layout adjusts, blurred background stays full
- [ ] Controls auto-hide after 3 seconds, reappear on mouse/touch
- [ ] Close button (×) returns to item detail
- [ ] Items with no image show a placeholder box — no crash
- [ ] Items with no value skip the value line — no "undefined" or $0 shown
- [ ] Present route accessible directly via URL (page reload works)

Commit: `feat: stream mode — fullscreen cinematic item reveal for content creators`
