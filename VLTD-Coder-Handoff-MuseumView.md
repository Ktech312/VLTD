# VLTD — Museum View Wiring: VaultInner.tsx Changes

`src/components/VaultMuseumView.tsx` is already created and ready. These are the exact changes needed to `VaultInner.tsx` to wire it in. All existing GalleryWall/ShelfRow logic is preserved — this just adds a toggle.

---

## Step 1 — Add import at top of VaultInner.tsx

Find the existing import block. Add:

```typescript
import VaultMuseumView from "@/components/VaultMuseumView";
```

---

## Step 2 — Add view mode state

Find the block of `useState` declarations near the top of the `VaultInnerContent` (or `VaultInner`) component. Add:

```typescript
const LS_VIEW_MODE = "vltd_vault_view_mode";
const [viewMode, setViewMode] = useState<"shelf" | "museum">("museum");
```

Then add a `useEffect` to persist the preference:

```typescript
useEffect(() => {
  const saved = window.localStorage.getItem(LS_VIEW_MODE);
  if (saved === "shelf" || saved === "museum") setViewMode(saved);
}, []);

useEffect(() => {
  window.localStorage.setItem(LS_VIEW_MODE, viewMode);
}, [viewMode]);
```

---

## Step 3 — Add the view mode toggle to the filter controls

Find this line (the "Showing X items" count line, around line 1216):

```tsx
<div className="mt-6 text-sm text-[color:var(--muted)]">
  Showing <span className="font-medium text-[color:var(--fg)]">{filtered.length}</span> items
</div>
```

Replace it with:

```tsx
<div className="mt-6 flex items-center justify-between gap-3">
  <div className="text-sm text-[color:var(--muted)]">
    Showing <span className="font-medium text-[color:var(--fg)]">{filtered.length}</span> items
  </div>
  <div className="flex items-center gap-1 rounded-full p-1 ring-1 ring-[color:var(--border)]"
    style={{ background: "var(--pill)" }}>
    <button
      type="button"
      onClick={() => setViewMode("museum")}
      className={[
        "rounded-full px-3 py-1 text-[11px] font-semibold transition",
        viewMode === "museum"
          ? "bg-[color:var(--theme-gold-subtle,rgba(245,181,72,0.12))] text-[color:var(--theme-gold,#F5B548)]"
          : "text-[color:var(--muted)]",
      ].join(" ")}
    >
      Museum
    </button>
    <button
      type="button"
      onClick={() => setViewMode("shelf")}
      className={[
        "rounded-full px-3 py-1 text-[11px] font-semibold transition",
        viewMode === "shelf"
          ? "bg-[color:var(--theme-gold-subtle,rgba(245,181,72,0.12))] text-[color:var(--theme-gold,#F5B548)]"
          : "text-[color:var(--muted)]",
      ].join(" ")}
    >
      Shelf
    </button>
  </div>
</div>
```

---

## Step 4 — Replace the filtered.length > 0 section

Find this block (around line 1316):

```tsx
{filtered.length > 0 && (
  <section className="mt-6">
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
  </section>
)}
```

Replace with:

```tsx
{filtered.length > 0 && (
  <section className="mt-6">
    {viewMode === "museum" ? (
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

---

## Step 5 — Verify

```bash
npx eslint src/components/VaultMuseumView.tsx src/app/vault/VaultInner.tsx --max-warnings=0
npm run build
```

Commit: `feat: museum view mode — spotlight hero + universe carousels`

---

## What the coder gets

| Thing | Where |
|-------|-------|
| `VaultMuseumView.tsx` | Already written — `src/components/VaultMuseumView.tsx` |
| Import line | Top of `VaultInner.tsx` |
| 2 state declarations + 2 useEffects | Inside the main component |
| Toggle UI | Replaces the "Showing X items" line |
| Conditional render | Replaces the `filtered.length > 0` section |

The existing Shelf view (GalleryWall + ShelfRow + VaultCard) is completely untouched. Museum view defaults to "on" — flip the `useState` default to `"shelf"` if you want shelf as default.
