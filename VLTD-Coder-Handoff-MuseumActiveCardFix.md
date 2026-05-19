# VLTD — Museum Active Card Fix (v2 — replaces previous version)

One file: `src/components/VaultMuseumView.tsx`

---

## What went wrong with the previous fix

Removing the `userMovedRail` guard let IntersectionObserver fire on every card visible at page load. Card 0 (leftmost) had 100% intersection ratio and immediately overrode the Spotlight. Wrong tool for this job.

---

## The correct approach

Replace IntersectionObserver with scroll-position math. On each scroll event, find which card's center is closest to the rail's viewport center — that's the active card. On initial page load, no scroll has fired, so `onFeaturedChange` is never called, and the default Spotlight (highest-value notable item) shows undisturbed.

---

## Full rewrite of `UniverseSection`

Replace the entire `UniverseSection` function with this:

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(items.length > 3);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);

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
    setCanScrollLeft(rail.scrollLeft > 4);
    setCanScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
    const centered = findCenterIndex(rail);
    setActiveIndex(centered);
    onFeaturedChange?.(items[centered]);
  }

  useEffect(() => {
    handleScroll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    railRef.current.scrollLeft =
      dragStartScrollLeft.current - (event.clientX - dragStartX.current);
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
            {"<"}
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
            {">"}
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
```

Key changes from the broken version:
- **No IntersectionObserver** — gone entirely
- **`activeIndex` starts at `-1`** — no card is "active" on load, so no Spotlight override fires
- **`handleScroll` owns everything** — scroll → find center card by position math → set `activeIndex` → call `onFeaturedChange`
- **`useEffect` on `items.length`** — runs once after mount to initialize scroll indicators (canScrollLeft/Right), but does NOT call `onFeaturedChange` (handleScroll fires it, and no scroll has happened yet)

---

## Also fix: gold value pills on carousel cards

**In `MuseumCard`, find:**
```tsx
          <div className="absolute bottom-1.5 left-2">
            <div className="text-[11px] font-bold" style={{ color: "#F0EAD6" }}>
              {money(value)}
            </div>
          </div>
```

**Replace with:**
```tsx
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
```

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] On page load: Spotlight shows the highest-value notable item (default), no carousel card is highlighted
- [ ] Scroll the carousel rail: the card that snaps to center gets the gold ring + scale, and the Spotlight updates to that item
- [ ] Arrow buttons (‹ ›): scrolling with arrows updates the active card and Spotlight
- [ ] Drag scroll: dragging the rail updates the active card and Spotlight on release
- [ ] Carousel cards with known value show gold pill; cards with no value show nothing
- [ ] No TypeScript errors (IntersectionObserver types removed)

Commit: `fix: center-card detection via scroll math, restore gold value pills`
