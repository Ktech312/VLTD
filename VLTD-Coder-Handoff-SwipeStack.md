# VLTD — SwipeStack Wiring Handoff

`src/components/SwipeStack.tsx` is already written. This doc covers exactly where to wire it in — two integration points.

---

## What's already done

| File | Status |
|------|--------|
| `src/components/SwipeStack.tsx` | ✅ Written — ready to use |

---

## Integration 1 — Public Gallery (visitor browses a collector's vault)

This is the "dating app" mode: visitor swipes right to want an item, left to skip.

### Where it goes

The public gallery lives at (or near) `/gallery/[userId]` or `/[username]`. Find the page that renders a collector's public items. It likely maps over items and renders a grid or list. Add a view toggle so visitors can switch to SwipeStack mode.

### Step 1 — Install the imports

```typescript
import SwipeStack from "@/components/SwipeStack";
import { addWishlistItem } from "@/lib/wishlistModel"; // or however you add to wishlist
```

### Step 2 — Add view mode state

```typescript
const [galleryMode, setGalleryMode] = useState<"grid" | "swipe">("grid");
```

### Step 3 — Add the toggle button

Next to whatever grid/list toggle already exists:

```tsx
<button
  type="button"
  onClick={() => setGalleryMode(galleryMode === "grid" ? "swipe" : "grid")}
  className="rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition"
  style={
    galleryMode === "swipe"
      ? {
          background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
          color: "var(--theme-gold, #F5B548)",
          borderColor: "var(--theme-gold-border, rgba(245,181,72,0.4))",
        }
      : {
          background: "var(--surface)",
          color: "var(--muted)",
          borderColor: "var(--border)",
        }
  }
>
  {galleryMode === "swipe" ? "✦ Swipe Mode" : "✦ Swipe"}
</button>
```

### Step 4 — Render SwipeStack when active

```tsx
{galleryMode === "swipe" ? (
  <div className="mx-auto max-w-sm px-4 pt-4">
    <SwipeStack
      items={publicItems}           // the collector's public VaultItems
      mode="gallery"
      onWant={(item) => {
        // Add to the visitor's own wishlist
        addWishlistItem({
          id: crypto.randomUUID(),
          title: item.title,
          targetPrice: item.currentValue ?? undefined,
          notes: `Spotted in ${collectorName}'s vault`,
          createdAt: Date.now(),
          universe: item.universe,
          category: item.category,
        });
        // Optional: toast notification
      }}
      onSkip={(item) => {
        // No-op or analytics ping
      }}
      onOpen={(item) => {
        // Navigate to item detail
        router.push(`/gallery/${userId}/item/${item.id}`);
      }}
      onEnd={() => {
        // Stack exhausted — go back to grid or show message
        setGalleryMode("grid");
      }}
    />
  </div>
) : (
  // ... existing grid render
)}
```

---

## Integration 2 — Private Vault Browse (owner flips through their own items)

This is the "flip through your collection" mode — faster than scrolling 80 items.

### Where it goes

`src/app/vault/VaultInner.tsx` — already has `filtered` items and a `viewMode` state (from the Museum View handoff). Add `"swipe"` as a third view mode.

### Step 1 — Import

```typescript
import SwipeStack from "@/components/SwipeStack";
```

### Step 2 — Extend viewMode type

Find:
```typescript
const [viewMode, setViewMode] = useState<"shelf" | "museum">("museum");
```

Change to:
```typescript
const [viewMode, setViewMode] = useState<"shelf" | "museum" | "swipe">("museum");
```

### Step 3 — Add Swipe button to the toggle

Find the Museum/Shelf toggle (the pill with two buttons). Add a third button:

```tsx
<button
  type="button"
  onClick={() => setViewMode("swipe")}
  className={[
    "rounded-full px-3 py-1 text-[11px] font-semibold transition",
    viewMode === "swipe"
      ? "bg-[color:var(--theme-gold-subtle,rgba(245,181,72,0.12))] text-[color:var(--theme-gold,#F5B548)]"
      : "text-[color:var(--muted)]",
  ].join(" ")}
>
  Flip
</button>
```

### Step 4 — Add Swipe branch to the conditional render

Find the `{filtered.length > 0 && ...}` section (from Museum View handoff — the one with `viewMode === "museum"` ternary). Extend it to three branches:

```tsx
{filtered.length > 0 && (
  <section className="mt-6">
    {viewMode === "swipe" ? (
      <div className="mx-auto max-w-sm">
        <SwipeStack
          items={filtered}
          mode="vault"
          onOpen={(item) => {
            router.push(`/vault/item/${item.id}`);
          }}
        />
      </div>
    ) : viewMode === "museum" ? (
      <VaultMuseumView
        items={filtered}
        onFilterToUniverse={(u) => {
          setUFilter(u);
          pushFilters({ u, c: "ALL", s: "ALL" });
        }}
      />
    ) : (
      <GalleryWall backgroundImage={museumBackgroundImage} backgroundMode={museumBackgroundMode}>
        {shelfRows.map((row, rowIndex) => (
          <ShelfRow key={`row-${rowIndex}`} shelfIndex={rowIndex}>
            {row.map((i) => (
              <VaultCard
                key={i.id}
                href={`/vault/item/${i.id}`}
                frameStyle={frameStyle}
                imgSrc={museumImgSrc(i)}
                title={i.title}
                metaLabel={itemLabel(i)}
                subtitleLine={`${i.subtitle ?? ""} ${i.number ?? ""} ${i.grade ? `• ${i.grade}` : ""}`.trim()}
                valueLine={
                  <>
                    Value: <span className="font-medium">${i.currentValue ?? 0}</span> • Cost: ${i.purchasePrice ?? 0}
                  </>
                }
              />
            ))}
          </ShelfRow>
        ))}
      </GalleryWall>
    )}
  </section>
)}
```

### Step 5 — Persist the third view mode

Find the `useEffect` that writes `viewMode` to localStorage. It already handles this — no change needed as long as the type is widened in Step 2.

---

## Verify

```bash
npx tsc --noEmit
npx eslint src/components/SwipeStack.tsx --max-warnings=0
npm run build
```

Test checklist:
- [ ] Gallery mode: swipe right triggers `onWant` with correct item
- [ ] Gallery mode: swipe left triggers `onSkip`
- [ ] Gallery mode: tap triggers `onOpen`
- [ ] Gallery mode: undo shows previous card (does NOT un-add from wishlist — that's a separate remove flow)
- [ ] Gallery mode: stack exhausted shows empty state, calls `onEnd`
- [ ] Vault mode: left/right swipe and button nav advance index
- [ ] Vault mode: prev disabled at index 0, next disabled at last item
- [ ] Vault mode: tap triggers `onOpen`
- [ ] Works on touch (mobile) and mouse (desktop)
- [ ] Card snaps back if drag released under threshold

Commit: `feat: swipe stack — gallery want/skip + vault flip browse`

---

## Notes for future polish

- **Undo in gallery mode** — the undo button steps `index` back but does **not** remove the item from the wishlist. To make full undo work, pass an `onUndo` prop and call your `removeWishlistItem()` from it.
- **Preloading** — `CardFace` uses `loading="eager"` on the top card and `loading="lazy"` on depth cards. For smoother transitions, you can preload the next card's image by reading `items[index + 1]?.imageFrontUrl`.
- **Animation tuning** — `SWIPE_THRESHOLD`, `ROTATION_MAX`, `FLY_DURATION`, and `SNAP_DURATION` are all constants at the top of SwipeStack.tsx. Adjust freely.
- **Public gallery auth** — `onWant` fires regardless of whether the visitor is logged in. Wrap the call with an auth check and redirect to sign-up if needed.
