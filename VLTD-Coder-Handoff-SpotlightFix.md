# VLTD — Spotlight + Active Card Fix

Three targeted changes to `src/components/VaultMuseumView.tsx`. No other files touched.

---

## Problem summary

1. **Spotlight too tall / empty** — `aspectRatio: "5/2"` wins over `maxHeight: 220` at wide containers (1200px+), making the image area 480px+ tall. Items with no image show an enormous empty dark box.
2. **Expand button doesn't work** — The `<a ↗>` lives inside the image div *before* the title/value overlay in JSX order. The title overlay renders on top and intercepts all clicks.
3. **Active carousel card glow barely visible** — `rgba(245,181,72,0.18)` is 18% opacity. The centered card looks almost identical to the others.

---

## Change 1 — Fix Spotlight image area height

**In `SpotlightCard`, find:**
```tsx
      <div
        className="relative w-full"
        style={{
          aspectRatio: "5/2",
          background: "var(--pill)",
          maxHeight: 220,
          overflow: "hidden",
        }}
      >
```

**Replace with:**
```tsx
      <div
        className="relative w-full"
        style={{
          background: "var(--pill)",
          height: 220,
          overflow: "hidden",
        }}
      >
```

Remove `aspectRatio` entirely. Fixed `height: 220` is reliable at all container widths.

---

## Change 2 — Fix Expand button (move out of image area, fix icon, fix click)

The button is currently inside the image div, buried under the title overlay. Move it to the stats row.

**In `SpotlightCard`, find and remove this entire `<a>` block (it's inside the image div):**
```tsx
        <a
          href={`/vault/item/${item.id}`}
          aria-label="Expand item"
          title="View item detail"
          className="absolute bottom-2 left-1/2 flex items-center justify-center rounded-full text-sm font-semibold"
          style={{
            backdropFilter: "blur(4px)",
            background: "rgba(59,130,246,0.85)",
            border: "2px solid rgba(255,255,255,0.25)",
            boxShadow: "0 2px 12px rgba(59,130,246,0.4)",
            color: "#fff",
            height: 32,
            textDecoration: "none",
            transform: "translateX(-50%)",
            width: 32,
          }}
        >
          ↗
        </a>
```

**Then in the stats row div (the one with `className="flex flex-wrap items-center gap-4 px-4 py-3"`), find:**
```tsx
        <a
          href={`/vault/item/${item.id}`}
          className="ml-auto text-[11px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--theme-gold, #F5B548)" }}
        >
          View details →
        </a>
```

**Replace with:**
```tsx
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
              <path d="M1 4.5V1h3.5M8.5 1H12v3.5M12 8.5V12H8.5M4.5 12H1V8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
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
```

The expand button (4-corner SVG icon) and "View details →" now live in the stats row, fully clickable, nothing overlapping them.

---

## Change 3 — Make active carousel card glow gold visibly

**In `MuseumCard`, find:**
```tsx
          boxShadow: isActive ? "0 8px 32px rgba(245,181,72,0.18)" : "none",
```

**Replace with:**
```tsx
          boxShadow: isActive
            ? "0 0 0 2px rgba(245,181,72,0.75), 0 4px 28px rgba(245,181,72,0.45)"
            : "none",
```

The first shadow is a 2px solid gold ring. The second is a warm ambient glow spreading outward. Together they make the centered card unmistakably different.

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] Spotlight image area is a fixed ~220px tall at all viewport widths
- [ ] Items with no image show a compact placeholder, not a giant empty box
- [ ] Blue expand button (4-corner icon) appears in the stats row, not floating in the image
- [ ] Clicking the expand button navigates to `/vault/item/[id]`
- [ ] "View details →" link still works alongside the button
- [ ] Centered carousel card has a visible gold ring + glow
- [ ] Non-active cards have no glow (no visual noise)

Commit: `fix: spotlight height, expand button click zone, gold active card glow`
