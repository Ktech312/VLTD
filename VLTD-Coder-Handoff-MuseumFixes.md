# VLTD — Museum View Fixes + Item Detail Cleanup

User feedback from live app testing. Four problems, two files.

---

## Problem 1 — Spotlight hero is too large

**File:** `src/components/VaultMuseumView.tsx`

`SpotlightCard` uses `aspectRatio: "16/9"` which makes the image area a massive banner. Change to `5/2` and add a `maxHeight` cap so it doesn't dominate the whole viewport.

**Find this in `SpotlightCard`:**
```tsx
<div className="relative w-full" style={{ aspectRatio: "16/9", overflow: "hidden", background: "var(--pill)" }}>
```

**Replace with:**
```tsx
<div className="relative w-full" style={{ aspectRatio: "5/2", maxHeight: 220, overflow: "hidden", background: "var(--pill)" }}>
```

That's the only change for Problem 1.

---

## Problem 2 — Carousel arrows don't work + no drag-scroll

**File:** `src/components/VaultMuseumView.tsx`

The current `UniverseSection` carousel has no arrow buttons and no drag-to-scroll. Rewrite it to add both.

Add these imports at the top of the file if not already present:
```tsx
import { useRef, useState } from "react";
```

Replace the entire `UniverseSection` component with this:

```tsx
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
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Arrow scroll — 260px per click (2 cards)
  function scrollBy(px: number) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: px, behavior: "smooth" });
  }

  // Update arrow visibility after scroll
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
    const dx = e.clientX - dragStartX.current;
    railRef.current.scrollLeft = dragStartScrollLeft.current - dx;
  }

  function onMouseUpOrLeave() {
    isDragging.current = false;
    if (railRef.current) {
      railRef.current.style.cursor = "grab";
      railRef.current.style.userSelect = "";
    }
  }

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

        <div className="flex items-center gap-1.5">
          {/* Left arrow */}
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollBy(-260)}
            disabled={!canScrollLeft}
            style={{
              width: 28,
              height: 28,
              borderRadius: 99,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: canScrollLeft ? "var(--fg)" : "var(--muted2)",
              cursor: canScrollLeft ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              opacity: canScrollLeft ? 1 : 0.35,
              transition: "opacity 0.2s",
            }}
          >
            ‹
          </button>

          {/* Right arrow */}
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollBy(260)}
            disabled={!canScrollRight}
            style={{
              width: 28,
              height: 28,
              borderRadius: 99,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: canScrollRight ? "var(--fg)" : "var(--muted2)",
              cursor: canScrollRight ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              opacity: canScrollRight ? 1 : 0.35,
              transition: "opacity 0.2s",
            }}
          >
            ›
          </button>

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

      {/* Horizontal scroll rail */}
      <div
        ref={railRef}
        onScroll={handleScroll}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUpOrLeave}
        onMouseLeave={onMouseUpOrLeave}
        className="flex gap-3 overflow-x-auto pb-1"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          cursor: "grab",
        }}
      >
        {items.map((item) => (
          <MuseumCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
```

---

## Problem 3 — Remove the Share Image section

**File:** `src/app/vault/item/[id]/page.tsx`

The entire `SHARE IMAGE` section is taking up space and isn't ready for production. Remove it entirely.

**Remove this block** (it starts right after the closing `</Section>` of `ITEM SUMMARY`):

```tsx
            <div className="mt-5">
              <Section title="SHARE IMAGE">
                <div className="space-y-3 text-sm">
                  <div className="text-[color:var(--muted)]">Generate a branded 1080×1080 PNG for social posts.</div>


                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 rounded-xl bg-black/10 px-3 py-2 ring-1 ring-white/8">
                      <span className="text-sm">Watermark</span>
                      <input
                        type="checkbox"
                        checked={shareIncludeWatermark}
                        onChange={(event) => setShareIncludeWatermark(event.target.checked)}
                        className="h-4 w-4 accent-cyan-400"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 rounded-xl bg-black/10 px-3 py-2 ring-1 ring-white/8">
                      <span className="text-sm">Username</span>
                      <input
                        type="checkbox"
                        checked={shareIncludeUsername}
                        onChange={(event) => setShareIncludeUsername(event.target.checked)}
                        className="h-4 w-4 accent-cyan-400"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 rounded-xl bg-black/10 px-3 py-2 ring-1 ring-white/8">
                      <span className="text-sm">Financials</span>
                      <input
                        type="checkbox"
                        checked={shareIncludeFinancials}
                        onChange={(event) => setShareIncludeFinancials(event.target.checked)}
                        className="h-4 w-4 accent-cyan-400"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 rounded-xl bg-black/10 px-3 py-2 ring-1 ring-white/8">
                      <span className="text-sm">Direct share</span>
                      <input
                        type="checkbox"
                        checked={shareUseDeviceSheet}
                        onChange={(event) => setShareUseDeviceSheet(event.target.checked)}
                        className="h-4 w-4 accent-cyan-400"
                      />
                    </label>
                  </div>

                  {shareIncludeUsername ? (
                    <div className="rounded-xl bg-black/10 px-3 py-2 text-xs text-[color:var(--muted)] ring-1 ring-white/8">
                      Username pulled from profile: <span className="text-[color:var(--fg)]">{shareResolvedUsername ? `@${shareResolvedUsername.replace(/^@+/, "")}` : "No profile username found"}</span>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleShareImage()}
                    disabled={isGeneratingShare}
                    className="inline-flex h-10 w-full items-center justify-center rounded-full bg-gold/15 px-4 text-sm font-medium text-cyan-100 ring-1 ring-gold/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGeneratingShare ? "Generating..." : "Share / Download PNG"}
                  </button>

                  {shareMessage ? <div className="text-xs text-[color:var(--muted)]">{shareMessage}</div> : null}
                </div>
              </Section>
            </div>
```

After removing it, also clean up all the now-unused state variables and the `handleShareImage` function and the `loadShareUsername` useEffect. Remove these from the file:

**State vars to remove** (around lines 177–183):
```tsx
  const [shareIncludeWatermark, setShareIncludeWatermark] = useState(true);
  const [shareIncludeUsername, setShareIncludeUsername] = useState(true);
  const [shareIncludeFinancials, setShareIncludeFinancials] = useState(true);
  const [shareResolvedUsername, setShareResolvedUsername] = useState("");
  const [shareUseDeviceSheet, setShareUseDeviceSheet] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
```

**useEffect to remove** — the one that calls `loadShareUsername()` (starts with `let isActive = true;` and reads from Supabase to resolve a username for sharing). It's only needed by the Share Image section.

**Functions to remove:**
- `downloadDataUrl` — only called by `handleShareImage`
- `handleShareImage` — the whole async function

**Import to remove:**
```tsx
import { generateShareImage } from "@/lib/generateShareImage";
```

> **Note:** Leave the `getStoredActiveProfileId` import in place — it's also used in `persist()`.

---

## Problem 4 — Item detail layout cleanup

**File:** `src/app/vault/item/[id]/page.tsx`

The right column currently has `ITEM SUMMARY` which repeats the page title and shows financial data. Clean it up:

**1. Remove the duplicate title and subtitle** from inside `ITEM SUMMARY`. Find this block inside the `ITEM SUMMARY` Section and remove the first two divs (the title repeat and the subtitle/number/grade line):

```tsx
              <div className="text-3xl font-semibold leading-tight">{item.title}</div>
              <div className="mt-2 text-sm text-[color:var(--muted)]">
                {item.subtitle || "Collector piece"}
                {item.number ? ` • ${item.number}` : ""}
                {item.grade ? ` • ${item.grade}` : ""}
              </div>
```

Remove both those divs. The section should start directly with the `<div className="mt-5 border-t...">` detail grid (remove the `mt-5` and `border-t` from that div too since there's no longer content above it — change it to `<div className="pt-1">`).

**2. Clean up the verbose media upload message.** Find this block inside the `MEDIA` section:

```tsx
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <div className="text-[color:var(--muted)]">
                    {uploading ? "Uploading..." : "Primary image sync is cloud-first. Local fallback stays on this device if Supabase blocks writes."}
                  </div>
                  {mediaMessage ? <div className="text-[color:var(--fg)]">{mediaMessage}</div> : null}
                </div>
```

Replace with:
```tsx
                {(uploading || mediaMessage) && (
                  <div className="mt-3 text-sm text-[color:var(--muted)]">
                    {uploading ? "Uploading..." : mediaMessage}
                  </div>
                )}
```

**3. Add Stream Mode and Insurance PDF action buttons** to the top action bar so users can access these features from the item detail page. Find the `← Vault` link block:

```tsx
            <div className="mt-4">
              <Link href="/vault" className="inline-flex h-10 items-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium ring-1 ring-[color:var(--border)]">
                ← Vault
              </Link>
            </div>
```

Replace with:
```tsx
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href="/vault"
                className="inline-flex h-10 items-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium ring-1 ring-[color:var(--border)]"
              >
                ← Vault
              </Link>
              <Link
                href={`/vault/item/${item.id}/present`}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ring-1 transition"
                style={{ background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }}
              >
                🎬 Stream
              </Link>
              <InsurancePdfButton items={[item]} variant="icon" />
            </div>
```

Add the import at the top of the file if it's not already there:
```tsx
import InsurancePdfButton from "@/components/InsurancePdfButton";
```

> The `variant="icon"` prop should render just the icon/minimal version of the button. If `InsurancePdfButton` doesn't support a `variant` prop yet, just use the default: `<InsurancePdfButton items={[item]} />`.

---

## Files changed summary

| File | Change |
|------|--------|
| `src/components/VaultMuseumView.tsx` | Spotlight aspectRatio 16/9 → 5/2 with maxHeight 220px |
| `src/components/VaultMuseumView.tsx` | UniverseSection rewrite: left/right arrow buttons, mouse drag-to-scroll |
| `src/app/vault/item/[id]/page.tsx` | Remove entire SHARE IMAGE section + all its state/handlers/imports |
| `src/app/vault/item/[id]/page.tsx` | ITEM SUMMARY: remove duplicate title/subtitle block |
| `src/app/vault/item/[id]/page.tsx` | Media upload message: simplify verbose text |
| `src/app/vault/item/[id]/page.tsx` | Action bar: add Stream + Insurance PDF buttons |

---

## Verify

```bash
npx tsc --noEmit
npx eslint src/components/VaultMuseumView.tsx src/app/vault/item/\[id\]/page.tsx --max-warnings=0
npm run build
```

Test checklist:
- [ ] Museum view spotlight is noticeably shorter — not a massive banner
- [ ] Carousel left arrow is disabled (greyed) at the start — enabled once scrolled right
- [ ] Clicking right arrow scrolls the rail smoothly ~2 cards worth
- [ ] Clicking left arrow scrolls back
- [ ] Mouse click-and-drag on carousel rail scrolls left/right
- [ ] Arrow states update correctly after drag-scroll too
- [ ] Item detail: no `SHARE IMAGE` section visible anywhere
- [ ] No TypeScript errors from removed share state vars / functions
- [ ] Item detail right column: no duplicate title at the top of ITEM SUMMARY
- [ ] Media section: no verbose Supabase message shown when there's nothing to report
- [ ] `🎬 Stream` and insurance PDF buttons visible in the top action bar
- [ ] `🎬 Stream` button navigates to `/vault/item/[id]/present` — fullscreen stream mode opens

Commit: `fix: museum spotlight size, carousel arrows + drag-scroll, remove share image section, item detail cleanup`
