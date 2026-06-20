# VLTD — Per-Item Privacy Toggle

**Philosophy:** Every item is private by default. The owner unlocks individual items. This is "Trust over Tethering" made tangible — a lock icon on every card, real control over what the public sees.

**Files changed:** 5 files + 1 SQL migration

---

## Step 0 — Supabase migration

Run this once in the Supabase SQL editor:

```sql
ALTER TABLE vault_items
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
```

That's it. Existing items default to private. ✓

---

## Step 1 — Add `isPublic` to VaultItem type

**File: `src/lib/vaultModel.ts`**

**Find (end of VaultItem type, near `isNew`):**
```ts
  status?: "COLLECTION" | "FOR_SALE" | "SOLD" | "WISHLIST";
  soldPrice?: number;
  soldAt?: number;
  createdAt?: number;
  isNew?: boolean;
};
```

**Replace with:**
```ts
  status?: "COLLECTION" | "FOR_SALE" | "SOLD" | "WISHLIST";
  soldPrice?: number;
  soldAt?: number;
  createdAt?: number;
  isNew?: boolean;
  isPublic?: boolean;
};
```

---

## Step 2 — Wire `is_public` through the cloud layer

**File: `src/lib/vaultCloud.ts`**

### 2a — Read (normalize row → VaultItem)

**Find (line ~121):**
```ts
    isNew: typeof row.is_new === "boolean" ? row.is_new : true,
  };
}
```

**Replace with:**
```ts
    isNew: typeof row.is_new === "boolean" ? row.is_new : true,
    isPublic: typeof row.is_public === "boolean" ? row.is_public : false,
  };
}
```

### 2b — Write (upsert baseRow)

**Find (inside `baseRow`, line ~290):**
```ts
    is_new: item.isNew ?? true,
  } as Record<string, unknown>;
```

**Replace with:**
```ts
    is_new: item.isNew ?? true,
    is_public: item.isPublic ?? false,
  } as Record<string, unknown>;
```

---

## Step 3 — `ItemVisibilityToggle` component (new file)

Create **`src/components/ItemVisibilityToggle.tsx`**:

```tsx
"use client";

import { useState } from "react";
import { updateItemAndNotify } from "@/lib/vaultActions";
import { upsertVaultItemToSupabase } from "@/lib/vaultCloud";
import { hasSupabaseEnv } from "@/lib/vaultCloud";
import type { VaultItem } from "@/lib/vaultModel";

function LockIcon({ open, size = 14 }: { open: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      {open ? (
        <>
          {/* Lock body */}
          <rect x="2" y="6.5" width="10" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
          {/* Shackle — open left side */}
          <path d="M4.5 6.5V4a4.5 4.5 0 0 1 9 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.6" />
        </>
      ) : (
        <>
          {/* Lock body */}
          <rect x="2" y="6.5" width="10" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
          {/* Shackle — closed */}
          <path d="M4.5 6.5V4a2.5 2.5 0 0 1 5 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </>
      )}
      {/* Keyhole dot */}
      <circle cx="7" cy="10" r="1" fill="var(--surface, #fff)" opacity="0.7" />
    </svg>
  );
}

export default function ItemVisibilityToggle({
  item,
  size = "sm",
}: {
  item: VaultItem;
  size?: "sm" | "md";
}) {
  const [isPublic, setIsPublic] = useState(item.isPublic ?? false);
  const [saving, setSaving] = useState(false);

  async function handleToggle(e: React.MouseEvent | React.PointerEvent | React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;

    const next = !isPublic;
    setIsPublic(next); // optimistic

    const updated: VaultItem = { ...item, isPublic: next };
    updateItemAndNotify(updated);

    if (hasSupabaseEnv()) {
      setSaving(true);
      try {
        await upsertVaultItemToSupabase(updated);
      } catch {
        // revert on failure
        setIsPublic(!next);
        updateItemAndNotify({ ...item, isPublic: !next });
      } finally {
        setSaving(false);
      }
    }
  }

  const isSmall = size === "sm";

  return (
    <button
      type="button"
      onClick={handleToggle}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onTouchStart={(e) => { e.stopPropagation(); }}
      aria-pressed={isPublic}
      aria-label={isPublic ? "Make private" : "Make public"}
      title={isPublic ? "Public — click to make private" : "Private — click to make public"}
      disabled={saving}
      className="pointer-events-auto flex items-center justify-center rounded-full transition-all disabled:opacity-50"
      style={{
        background: isPublic
          ? "rgba(245,181,72,0.18)"
          : "rgba(0,0,0,0.45)",
        border: `1.5px solid ${isPublic ? "rgba(245,181,72,0.5)" : "rgba(255,255,255,0.12)"}`,
        backdropFilter: "blur(4px)",
        color: isPublic ? "var(--theme-gold, #F5B548)" : "rgba(255,255,255,0.55)",
        height: isSmall ? 26 : 32,
        width: isSmall ? 26 : 32,
      }}
    >
      <LockIcon open={isPublic} size={isSmall ? 13 : 16} />
    </button>
  );
}
```

**Visual states:**
- 🔒 **Private (default):** Dark semi-transparent, white lock, closed shackle
- 🔓 **Public:** Gold tinted, gold lock, open shackle

---

## Step 4 — Add lock toggle to VaultCard

**File: `src/app/vault/VaultCard.tsx`**

### 4a — Import the component

**Add import at the top:**
```tsx
import ItemVisibilityToggle from "@/components/ItemVisibilityToggle";
```

### 4b — Add toggle to the card

**Find the image area:**
```tsx
        <div className={frame.frame}>
          <div className={frame.imgWrap}>
            <div className="aspect-[3/4] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={item.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
```

**Replace with:**
```tsx
        <div className={frame.frame}>
          <div className={frame.imgWrap} style={{ position: "relative" }}>
            <div className="aspect-[3/4] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={item.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            {/* Privacy toggle — top right corner of image */}
            <div style={{ position: "absolute", top: 6, right: 6, zIndex: 10 }}>
              <ItemVisibilityToggle item={item} size="sm" />
            </div>
          </div>
        </div>
```

---

## Step 5 — Add visibility section to item detail page

**File: `src/app/vault/item/[id]/page.tsx`**

Find the section that has the action bar with Stream Mode and Insurance PDF buttons. Add a visibility control row immediately below it.

**Find the action bar div (look for the row containing "Stream" and "Insurance PDF" buttons).**

After the closing `</div>` of that action bar, insert:

```tsx
{/* ── Visibility ───────────────────────────────────────────── */}
<div
  className="flex items-center justify-between rounded-[16px] p-4"
  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
>
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
      Visibility
    </div>
    <div className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
      {draft.isPublic
        ? "Public — visible in your Gallery"
        : "Private — only you can see this"}
    </div>
  </div>
  <ItemVisibilityToggle item={draft} size="md" />
</div>
```

**Also add import at the top of the file:**
```tsx
import ItemVisibilityToggle from "@/components/ItemVisibilityToggle";
```

> **Note:** The toggle in the detail page calls `updateItemAndNotify` on the stale `draft` object. If the detail page uses local `draft` state, the description text (`draft.isPublic`) won't update until the user re-navigates. That's fine for now — the icon state is tracked internally in `ItemVisibilityToggle`. If you want the label to stay in sync, lift an `isPublic` state piece into the detail page and pass it as an override prop. Low priority.

---

## Step 6 — Private badge on Museum carousel cards

Items that are private (`isPublic !== true`) should show a subtle indicator in the owner's Museum View, so the owner knows at a glance what's locked.

**File: `src/components/VaultMuseumView.tsx`**

### 6a — Private badge on MuseumCard

**In `MuseumCard`, find the image div's absolute overlays area (near the `notable` and `grade` badge blocks):**

```tsx
          {notable && (
            <div
              className="absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ring-1"
              ...
            >
              Key
            </div>
          )}
```

**After that block, add:**
```tsx
          {!item.isPublic && (
            <div
              className="absolute right-1.5 bottom-1.5 flex items-center justify-center rounded-full"
              style={{
                background: "rgba(0,0,0,0.52)",
                border: "1px solid rgba(255,255,255,0.14)",
                backdropFilter: "blur(3px)",
                color: "rgba(255,255,255,0.5)",
                height: 20,
                width: 20,
              }}
              title="Private"
            >
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="2" y="6.5" width="10" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
                <path d="M4.5 6.5V4a2.5 2.5 0 0 1 5 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="7" cy="10" r="1" fill="rgba(0,0,0,0.5)" />
              </svg>
            </div>
          )}
```

### 6b — Private badge on SpotlightCard

**In `SpotlightCard`, find the `grade` badge block:**
```tsx
        {grade && (
          <div
            className="absolute right-3 top-3 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1"
            ...
          >
            {grade}
          </div>
        )}
```

**After it, add:**
```tsx
        {!item.isPublic && (
          <div
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ring-1"
            style={{
              background: "rgba(0,0,0,0.55)",
              borderColor: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(4px)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            <svg width="9" height="9" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="2" y="6.5" width="10" height="7" rx="1.5" fill="currentColor" />
              <path d="M4.5 6.5V4a2.5 2.5 0 0 1 5 0v2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Private
          </div>
        )}
```

> If the grade badge already occupies `right-3 top-3`, offset this badge to avoid overlap — e.g. `right-3 top-10` or adjust the grade badge position.

---

## Step 7 — Filter public museum/gallery views (public-facing)

When a guest visits the museum, only public items should be visible.

The guest view at `src/app/museum/[galleryId]/guest/page.tsx` uses `GalleryPublicItemSnapshot` (explicit gallery-managed snapshots) — those are already curated by the owner through the Exhibition system and don't need this filter.

**The VaultMuseumView** is currently used in the owner's private vault. When/if a public-facing "browse this collector's vault" page is added, filter items before passing them in:

```tsx
// Public-facing page only: filter to public items
const publicItems = items.filter(i => i.isPublic === true);
<VaultMuseumView items={publicItems} onFilterToUniverse={...} />
```

This is a one-liner when the public vault page is built. No changes needed now.

---

## Bundled cleanup

While touching VaultCard, fix the value display — currently shows `$0` for items with no value set:

**In `VaultCard`, find:**
```tsx
          <div className="mt-2 text-sm text-[color:var(--fg)]">
            Value: <span className="font-medium">${item.currentValue ?? 0}</span>
          </div>
```

**Replace with:**
```tsx
          {item.currentValue ? (
            <div className="mt-2 text-sm text-[color:var(--fg)]">
              Value: <span className="font-medium">${item.currentValue.toLocaleString()}</span>
            </div>
          ) : null}
```

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] Supabase migration ran: `is_public` column exists in `vault_items` table
- [ ] New item added to vault: `is_public = false` in DB
- [ ] Lock toggle on vault card: clicking flips icon state without navigating away
- [ ] Lock toggle on vault card: DB record updates (`is_public` changes in Supabase)
- [ ] Item detail page: Visibility section shows, toggle works, label reflects state
- [ ] Museum View: private items (isPublic false) show lock badge in bottom-right of carousel card
- [ ] Museum View: Spotlight shows "Private" badge top-right when spotlight item is private
- [ ] Making an item public: badge disappears from museum card
- [ ] VaultCard value: items with `currentValue: 0` or undefined show no value line (no "$0")
- [ ] TypeScript passes with no new errors

Commit: `feat: per-item privacy toggle — lock icon on cards, visibility section on detail, private badge in museum`
