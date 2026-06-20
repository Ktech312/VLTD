# VLTD — Museum Carousel UX Fixes

Five issues visible in the live screenshot, all in `src/components/VaultMuseumView.tsx`.

---

## Issue summary

1. Carousel items are clipped at the top by parent overflow
2. Cards are different heights — title section varies
3. The centered card in the rail should be visually featured and update the Spotlight above
4. Tapping/clicking the image area accidentally opens item detail during scroll — only the title area should navigate
5. SpotlightCard needs: image carousel (if multiple images) + an Expand button

---

## Fix 1 — Cards clipped at top

The scroll rail has no top padding and the parent section has implicit `overflow: hidden`. The card border/shadow is being clipped.

**Find in `UniverseSection`:**
```tsx
      <div
        className="flex gap-3 overflow-x-auto pb-1"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
```

**Replace with:**
```tsx
      <div
        className="flex gap-3 overflow-x-auto pb-3 pt-2"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          overflowY: "visible",
        }}
      >
```

Also add `overflow: visible` to the wrapping `<div>` that contains the rail (the `<div>` returned by `UniverseSection`):

```tsx
// Change the outer UniverseSection return div from:
    <div>

// To:
    <div style={{ overflowX: "visible", overflowY: "visible" }}>
```

---

## Fix 2 — Uniform card sizes

`MuseumCard` currently lets the title section grow based on content, making cards different heights. Add a fixed total height and a fixed-height title section.

**Replace the entire `MuseumCard` component** with this version. Key changes:
- Fixed card width `140px`
- Image section is `height: 168px` (fixed, not aspect-ratio-based so no height variance)
- Title section is `height: 48px` fixed — content clips cleanly with `line-clamp`
- `isActive` prop controls the featured/centered state
- Image area does NOT navigate — only the title section does

```tsx
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
        width: 140,
        transition: "transform 0.25s cubic-bezier(0.34,1.2,0.64,1)",
        transform: isActive ? "scale(1.08) translateY(-4px)" : "scale(1)",
        zIndex: isActive ? 2 : 1,
        position: "relative",
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
            ? "0 8px 32px rgba(245,181,72,0.18)"
            : "none",
        }}
      >
        {/* ── Image area — NO navigation on click ── */}
        <div
          className="relative w-full overflow-hidden"
          style={{ height: 168, background: "var(--pill)", cursor: "default" }}
          onClick={(e) => e.preventDefault()}
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

          {/* Gradient overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(transparent 50%, rgba(0,0,0,0.78) 100%)" }}
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

        {/* ── Title area — THIS is the clickable navigation zone ── */}
        <a
          href={`/vault/item/${item.id}`}
          className="block"
          draggable={false}
          style={{
            height: 48,
            padding: "6px 10px 8px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
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
        </a>
      </div>
    </div>
  );
}
```

---

## Fix 3 — Center-snap carousel with active item detection

Rewrite `UniverseSection` to:
- Snap cards to center position
- Detect which card is centered using IntersectionObserver
- Pass `isActive` to the centered card
- Update the Spotlight via an `onFeaturedChange` callback

Add `useRef`, `useState`, and `useEffect` to the imports at the top of the file if they aren't already there:
```tsx
import { useRef, useState, useEffect } from "react";
```

**Replace the entire `UniverseSection` component:**

```tsx
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Detect which card is most centered in the viewport
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the card with the highest intersection ratio
        let bestRatio = 0;
        let bestIndex = activeIndex;
        entries.forEach((entry) => {
          const idx = cardRefs.current.indexOf(entry.target as HTMLDivElement);
          if (idx >= 0 && entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIndex = idx;
          }
        });
        if (bestRatio > 0.5) {
          setActiveIndex(bestIndex);
          onFeaturedChange?.(items[bestIndex]);
        }
      },
      { root: rail, threshold: [0.5, 0.75, 1.0] }
    );

    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Arrow scroll
  function scrollBy(px: number) {
    railRef.current?.scrollBy({ left: px, behavior: "smooth" });
  }

  function handleScroll() {
    const rail = railRef.current;
    if (!rail) return;
    setCanScrollLeft(rail.scrollLeft > 4);
    setCanScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
  }

  // Mouse drag-to-scroll
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const rail = railRef.current;
    if (!rail) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartScrollLeft.current = rail.scrollLeft;
    rail.style.cursor = "grabbing";
    rail.style.userSelect = "none";
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDragging.current || !railRef.current) return;
    railRef.current.scrollLeft = dragStartScrollLeft.current - (e.clientX - dragStartX.current);
  }

  function onMouseUpOrLeave() {
    isDragging.current = false;
    if (railRef.current) {
      railRef.current.style.cursor = "grab";
      railRef.current.style.userSelect = "";
    }
  }

  return (
    <div style={{ overflow: "visible" }}>
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

        <div className="flex items-center gap-1.5">
          {/* Left arrow */}
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollBy(-300)}
            disabled={!canScrollLeft}
            style={{
              width: 28, height: 28, borderRadius: 99,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: canScrollLeft ? "var(--fg)" : "var(--muted2)",
              cursor: canScrollLeft ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
              opacity: canScrollLeft ? 1 : 0.35,
              transition: "opacity 0.2s",
            }}
          >‹</button>

          {/* Right arrow */}
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollBy(300)}
            disabled={!canScrollRight}
            style={{
              width: 28, height: 28, borderRadius: 99,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: canScrollRight ? "var(--fg)" : "var(--muted2)",
              cursor: canScrollRight ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
              opacity: canScrollRight ? 1 : 0.35,
              transition: "opacity 0.2s",
            }}
          >›</button>

          <button
            type="button"
            onClick={() => onViewAll(universeKey)}
            className="text-[11px] transition-opacity hover:opacity-80"
            style={{ color: "var(--theme-gold, #F5B548)", marginLeft: 4 }}
          >
            See all →
          </button>
        </div>
      </div>

      {/* Horizontal scroll rail — snaps to center */}
      <div
        ref={railRef}
        onScroll={handleScroll}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUpOrLeave}
        onMouseLeave={onMouseUpOrLeave}
        className="flex gap-3 overflow-x-auto pb-3 pt-2"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          scrollSnapType: "x mandatory",
          cursor: "grab",
          overflowY: "visible",
        }}
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            ref={(el) => { cardRefs.current[i] = el; }}
            style={{ scrollSnapAlign: "center", flexShrink: 0 }}
          >
            <MuseumCard item={item} isActive={i === activeIndex} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Fix 4 — Spotlight: image carousel + Expand button

Update `SpotlightCard` to cycle through all item images and show an Expand button.

`VaultMuseumView` passes `items` to `SpotlightCard`, so `SpotlightCard` needs to also receive the full image list.

First, update the helper `museumImgSrc` to instead return all image URLs:

**Add this helper below the existing `museumImgSrc` function:**
```tsx
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
```

**Replace the entire `SpotlightCard` component:**

```tsx
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

  // Auto-advance image every 4s if multiple images
  useEffect(() => {
    if (allImages.length <= 1) return;
    const timer = setInterval(() => {
      setImgIndex((prev) => (prev + 1) % allImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [allImages.length]);

  const currentImg = allImages[imgIndex] ?? "";

  return (
    <div
      className="rounded-[20px] overflow-hidden ring-1 ring-[color:var(--border)]"
      style={{ background: "var(--surface)" }}
    >
      {/* Image section */}
      <div
        className="relative w-full"
        style={{ aspectRatio: "5/2", maxHeight: 220, overflow: "hidden", background: "var(--pill)" }}
      >
        {currentImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={currentImg}
            src={currentImg}
            alt={item.title}
            className="h-full w-full object-cover transition-opacity duration-500"
            style={{ opacity: 1 }}
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

        {/* Dark gradient overlay */}
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

        {/* Image dot indicators — bottom center (only if multiple images) */}
        {allImages.length > 1 && (
          <div
            className="absolute bottom-10 left-1/2 flex gap-1"
            style={{ transform: "translateX(-50%)" }}
          >
            {allImages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setImgIndex(i)}
                style={{
                  width: i === imgIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 99,
                  background: i === imgIndex ? "#F5B548" : "rgba(255,255,255,0.35)",
                  border: "none",
                  cursor: "pointer",
                  transition: "width 0.2s, background 0.2s",
                  padding: 0,
                }}
              />
            ))}
          </div>
        )}

        {/* ── Expand button — blue circle, centered at bottom of image ── */}
        <div
          className="absolute bottom-2 left-1/2"
          style={{ transform: "translateX(-50%)" }}
        >
          <a
            href={`/vault/item/${item.id}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 99,
              background: "rgba(59,130,246,0.85)",
              color: "#fff",
              textDecoration: "none",
              border: "2px solid rgba(255,255,255,0.25)",
              boxShadow: "0 2px 12px rgba(59,130,246,0.4)",
              fontSize: 14,
              fontWeight: 600,
              backdropFilter: "blur(4px)",
            }}
            aria-label="Expand item"
            title="View item detail"
          >
            ↗
          </a>
        </div>

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
              style={{ color: gain >= 0 ? "var(--gain-positive, #4ade80)" : "var(--gain-negative, #f87171)" }}
            >
              {gain >= 0 ? "+" : ""}{money(gain)}
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

        {/* Expand link in stats row too */}
        <a
          href={`/vault/item/${item.id}`}
          className="ml-auto text-[11px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--theme-gold, #F5B548)" }}
        >
          View details →
        </a>
      </div>
    </div>
  );
}
```

---

## Fix 5 — Wire `onFeaturedChange` in the main view

In `VaultMuseumView`, add state for the dynamic spotlight item and pass the callback to each `UniverseSection`.

**Find the `VaultMuseumView` export function and add state:**
```tsx
export default function VaultMuseumView({
  items,
  onFilterToUniverse,
}: {
  items: ModelItem[];
  onFilterToUniverse: (u: UniverseKey) => void;
}) {
  // Add this:
  const [featuredOverride, setFeaturedOverride] = useState<ModelItem | null>(null);
```

**Find the spotlight derivation block:**
```tsx
  const spotlight = (() => {
    const notableItems = items.filter(isNotable);
    ...
  })();
```

**Replace with:**
```tsx
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

  const spotlight = featuredOverride ?? defaultSpotlight;
```

**Find each `UniverseSection` usage in the return JSX:**
```tsx
          <UniverseSection
            key={u}
            universeKey={u}
            items={sectionItems}
            onViewAll={onFilterToUniverse}
          />
```

**Replace with:**
```tsx
          <UniverseSection
            key={u}
            universeKey={u}
            items={sectionItems}
            onViewAll={onFilterToUniverse}
            onFeaturedChange={setFeaturedOverride}
          />
```

---

## Files changed

| File | Changes |
|------|---------|
| `src/components/VaultMuseumView.tsx` | Add `useState`/`useEffect`/`useRef` imports; rewrite `MuseumCard` (uniform size, image no-click, title-only navigation, `isActive` prop); rewrite `UniverseSection` (scroll-snap, IntersectionObserver active detection, arrows, drag-scroll, `onFeaturedChange` callback); rewrite `SpotlightCard` (image carousel, dot indicators, Expand button, image cycling); wire `featuredOverride` state in `VaultMuseumView` |

---

## Verify

```bash
npx tsc --noEmit
npx eslint src/components/VaultMuseumView.tsx --max-warnings=0
npm run build
```

Test checklist:
- [ ] Carousel card tops are NOT clipped — full card shadow/border visible above rail
- [ ] All cards are the same height — image area 168px, title section 48px, no variation
- [ ] Scrolling the carousel: the card closest to center pops up slightly (scale 1.08, gold border, slight shadow)
- [ ] When a card becomes active, the Spotlight section above updates to show that item
- [ ] Clicking/tapping the IMAGE area of a carousel card: nothing happens, no navigation
- [ ] Clicking/tapping the TITLE area of a carousel card: navigates to item detail ✓
- [ ] Drag-scrolling with mouse works without accidentally triggering navigation
- [ ] Left/right arrow buttons work, grey out at ends
- [ ] Spotlight: if item has multiple images, they cycle automatically every 4 seconds
- [ ] Spotlight: dot indicators appear when multiple images, tapping a dot jumps to that image
- [ ] Spotlight: blue Expand button (↗) appears centered at bottom of image — tapping it navigates to item detail
- [ ] Spotlight: "View details →" link also works in the stats row below
- [ ] Items with no image still render correctly — placeholder, no crash
- [ ] No TypeScript errors from the new props

Commit: `fix: museum carousel — clip fix, uniform cards, center-snap active state, image-only no-click, spotlight image carousel + expand button`
