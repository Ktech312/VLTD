# VLTD — Remaining Safe Next Tasks: Coder Handoff
**2 tasks left. All steps in exact order. Copy-paste ready.**

Stack: Next.js 16, TypeScript, Tailwind CSS v4, Supabase.
Style convention: CSS variables only — match `CostToSellPanel.tsx` / `WishlistCard.tsx`. No hard-coded colors.

---

## TASK A — Want List Improvements

### Step 1 — Update `WishlistItem` type in `src/lib/wishlistModel.ts`

Find the `WishlistItem` type. Replace it entirely:

```typescript
export type WishlistItem = {
  id: string;
  title: string;
  targetPrice?: number;        // already existed
  notes?: string;              // already existed
  createdAt: number;
  // New fields:
  universe?: string;           // e.g. "TCG", "SPORTS", "POP_CULTURE"
  category?: string;           // e.g. "Trading Cards", "Comics"
  condition?: "any" | "raw" | "graded" | "nm" | "ex";
  priority?: "low" | "medium" | "high";
};
```

No data migration needed — new fields are optional. Existing saved items just won't have them.

---

### Step 2 — Update `addWishlistItem()` in `src/lib/wishlistModel.ts`

Find the existing `addWishlistItem` function. Replace its signature and body with the object-based version:

```typescript
export function addWishlistItem(
  fields: Pick<WishlistItem, "title" | "targetPrice" | "notes" | "universe" | "category" | "condition" | "priority">
): WishlistItem {
  const item: WishlistItem = {
    id: String(Date.now()),
    createdAt: Date.now(),
    ...fields,
  };
  const list = loadWishlist();
  list.push(item);
  saveWishlist(list);
  return item;
}
```

---

### Step 3 — Fix all `addWishlistItem()` call sites

Run this in terminal to find every call site:
```bash
grep -r "addWishlistItem" src --include="*.tsx" --include="*.ts" -l
```

For each call site found, update from positional args to object syntax:
```typescript
// Before (however it was called):
addWishlistItem(title, targetPrice, notes)

// After:
addWishlistItem({ title, targetPrice, notes })

// If the item has universe/category available, pass those too:
addWishlistItem({ title, targetPrice, notes, universe: item.universe, category: item.category })
```

---

### Step 4 — Replace `src/components/WishlistCard.tsx` entirely

Full file replacement:

```tsx
"use client";

import type { WishlistItem } from "@/lib/wishlistModel";

const PRIORITY_STYLES: Record<string, { label: string; color: string }> = {
  high:   { label: "High Priority",   color: "#F56565" },
  medium: { label: "Medium Priority", color: "#F5B548" },
  low:    { label: "Low Priority",    color: "var(--muted)" },
};

const CONDITION_LABELS: Record<string, string> = {
  any:    "Any Condition",
  raw:    "Raw",
  graded: "Graded",
  nm:     "Near Mint",
  ex:     "Excellent",
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function WishlistCard({ item }: { item: WishlistItem }) {
  const priority = item.priority ? PRIORITY_STYLES[item.priority] : null;

  return (
    <div
      className="rounded-[18px] border p-4 transition hover:brightness-110"
      style={{
        background: "var(--theme-card, rgba(15,25,45,0.85))",
        borderColor: "var(--theme-border, rgba(245,181,72,0.12))",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div
          className="text-base font-semibold leading-snug"
          style={{ color: "var(--theme-text-primary, #F0EAD6)" }}
        >
          {item.title}
        </div>
        {priority && (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: priority.color }}
          >
            {priority.label}
          </span>
        )}
      </div>

      {/* Category / universe */}
      {(item.category || item.universe) && (
        <div
          className="mt-0.5 text-sm"
          style={{ color: "var(--theme-text-muted, #A0956B)" }}
        >
          {item.category ?? item.universe}
        </div>
      )}

      {/* Target price */}
      {item.targetPrice != null && (
        <div className="mt-2 text-sm font-semibold" style={{ color: "#52D6F4" }}>
          Target: {money(item.targetPrice)}
        </div>
      )}

      {/* Condition */}
      {item.condition && item.condition !== "any" && (
        <div
          className="mt-1.5 text-xs"
          style={{ color: "var(--theme-text-muted, #A0956B)" }}
        >
          Condition: {CONDITION_LABELS[item.condition] ?? item.condition}
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <div
          className="mt-2 rounded-xl p-2.5 text-xs leading-relaxed"
          style={{
            background: "var(--pill, rgba(255,255,255,0.04))",
            color: "var(--muted)",
          }}
        >
          {item.notes}
        </div>
      )}
    </div>
  );
}
```

---

### Step 5 — Replace `src/app/wishlist/page.tsx` entirely

Full file replacement (adds sort + filter controls above the grid):

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { loadWishlist, type WishlistItem } from "@/lib/wishlistModel";
import WishlistCard from "@/components/WishlistCard";

function IconHeart({
  size = 24,
  style,
}: {
  size?: number;
  style?: Record<string, string | number>;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

type SortMode = "newest" | "price-asc" | "price-desc" | "priority";

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [sort, setSort] = useState<SortMode>("newest");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  useEffect(() => {
    setItems(loadWishlist());
  }, []);

  const sorted = useMemo(() => {
    let list = [...items];

    if (filterPriority !== "all") {
      list = list.filter((i) => i.priority === filterPriority);
    }

    if (sort === "price-asc") {
      list.sort((a, b) => (a.targetPrice ?? Infinity) - (b.targetPrice ?? Infinity));
    } else if (sort === "price-desc") {
      list.sort((a, b) => (b.targetPrice ?? -Infinity) - (a.targetPrice ?? -Infinity));
    } else if (sort === "priority") {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      list.sort(
        (a, b) =>
          (order[a.priority ?? ""] ?? 3) - (order[b.priority ?? ""] ?? 3)
      );
    } else {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }

    return list;
  }, [items, sort, filterPriority]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1
              className="text-2xl font-black tracking-[-0.04em]"
              style={{ color: "var(--theme-text-primary, #F0EAD6)" }}
            >
              Wishlist
            </h1>
            <p
              className="mt-0.5 text-sm"
              style={{ color: "var(--theme-text-muted, #A0956B)" }}
            >
              Items you&apos;re watching or saving for later
            </p>
          </div>
          <Link
            href="/vault/add"
            className="rounded-full px-4 py-2 text-sm font-semibold transition"
            style={{
              background: "var(--theme-gold-subtle, rgba(245,181,72,0.10))",
              border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.30))",
              color: "var(--theme-gold, #F5B548)",
            }}
          >
            + Add Item
          </Link>
        </div>

        {/* Sort + filter controls — only shown when there are items */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="h-9 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
              style={{ color: "var(--fg)" }}
            >
              <option value="newest">Newest First</option>
              <option value="priority">Priority</option>
              <option value="price-asc">Target Price ↑</option>
              <option value="price-desc">Target Price ↓</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="h-9 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
              style={{ color: "var(--fg)" }}
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <span
              className="self-center text-xs"
              style={{ color: "var(--muted)" }}
            >
              {sorted.length} item{sorted.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 ? (
          <div
            className="rounded-[24px] border p-8 text-center"
            style={{
              background: "var(--theme-card, rgba(15,25,45,0.85))",
              borderColor: "var(--theme-border, rgba(245,181,72,0.12))",
            }}
          >
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: "var(--theme-gold-subtle, rgba(245,181,72,0.10))",
                border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.25))",
              }}
            >
              <IconHeart size={24} style={{ color: "var(--theme-gold, #F5B548)" }} />
            </div>
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--theme-text-primary, #F0EAD6)" }}
            >
              Your wishlist is empty
            </h2>
            <p
              className="mx-auto mt-2 max-w-xs text-sm leading-relaxed"
              style={{ color: "var(--theme-text-muted, #A0956B)" }}
            >
              Save items you&apos;re eyeing to track prices and build toward your next
              acquisition.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/vault/add"
                className="rounded-full px-5 py-2 text-sm font-semibold transition"
                style={{
                  background:
                    "linear-gradient(135deg, #8B6914 0%, #C8941F 25%, #F5B548 50%, #FFE08A 70%, #C8941F 100%)",
                  color: "#0B0B0B",
                }}
              >
                Browse &amp; Add Items
              </Link>
              <Link
                href="/vault"
                className="rounded-full border px-5 py-2 text-sm font-semibold transition"
                style={{
                  borderColor: "var(--theme-gold-border, rgba(245,181,72,0.30))",
                  color: "var(--theme-gold, #F5B548)",
                }}
              >
                Go to Vault
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {sorted.map((i) => (
              <WishlistCard key={i.id} item={i} />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
```

---

### Step 6 — Verify

```bash
npx eslint src/lib/wishlistModel.ts src/components/WishlistCard.tsx src/app/wishlist/page.tsx --max-warnings=0
npm run build
```

Commit: `feat: want list improvements — condition, priority, universe, category, sort/filter`

---
---

## TASK B — Variant / Edition Tracking

### Step 1 — Add 4 new fields to `VaultItem` in `src/lib/vaultModel.ts`

Find the `VaultItem` type. Locate the `certNumber` and `serialNumber` lines and insert the new block directly after them:

```typescript
  certNumber?: string;
  serialNumber?: string;
  // ── Variant / Edition ───────────────────────────────────────────────────
  edition?: string;         // e.g. "1st Edition", "Unlimited", "Shadowless"
  variant?: string;         // e.g. "Holo", "Reverse Holo", "Foil", "Non-Holo"
  printRun?: string;        // e.g. "1/1", "47/250", "Artist Proof"
  isFirstEdition?: boolean; // quick flag — also feeds Notable badge automatically
  // ────────────────────────────────────────────────────────────────────────
  valueSource?: string;
```

No migration needed — all four fields are optional.

---

### Step 2 — Update `isNotable()` in `src/lib/itemIntelligence.ts`

Find the `isNotable` function that was added in the previous commit (`ba81722`). Add one line at the very top of the function body, before any other checks:

```typescript
export function isNotable(item: VaultItem): boolean {
  if (item.isFirstEdition) return true;   // ← add this line
  // ... rest of existing function unchanged
```

---

### Step 3 — Add variant fields to the vault add/edit form

First, find the form file:
```bash
grep -r "certNumber" src/app --include="*.tsx" -l
```

Open the file returned. Find the `certNumber` input field block. Add the following JSX block directly after it:

```tsx
{/* ── Variant / Edition ───────────────────────────────────────────────── */}
<div className="grid gap-4 sm:grid-cols-2">
  <label className="grid gap-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">
      Edition
    </span>
    <input
      value={form.edition ?? ""}
      onChange={(e) => setForm((f) => ({ ...f, edition: e.target.value }))}
      className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
      placeholder="e.g. 1st Edition, Unlimited, Shadowless"
    />
  </label>

  <label className="grid gap-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">
      Variant / Finish
    </span>
    <input
      value={form.variant ?? ""}
      onChange={(e) => setForm((f) => ({ ...f, variant: e.target.value }))}
      className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
      placeholder="e.g. Holo, Reverse Holo, Foil, Non-Holo"
    />
  </label>
</div>

<label className="grid gap-1.5">
  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">
    Print Run
  </span>
  <input
    value={form.printRun ?? ""}
    onChange={(e) => setForm((f) => ({ ...f, printRun: e.target.value }))}
    className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
    placeholder="e.g. 1/1, 47/250, Artist Proof"
  />
</label>

<label className="flex items-center gap-3">
  <input
    type="checkbox"
    checked={form.isFirstEdition ?? false}
    onChange={(e) =>
      setForm((f) => ({ ...f, isFirstEdition: e.target.checked }))
    }
    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]"
  />
  <span className="text-sm" style={{ color: "var(--fg)" }}>
    First Edition / First Print
  </span>
</label>
```

---

### Step 4 — Show variant data on the item detail page

**File:** `src/app/vault/item/[id]/page.tsx`

Find the section where `grade` and `certNumber` are displayed (the metadata / spec area). Add this block after it — it only renders when at least one variant field is populated:

```tsx
{(item.edition || item.variant || item.printRun || item.isFirstEdition) && (
  <div className="mt-4 rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
    <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">
      Edition / Variant
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {item.isFirstEdition && (
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold ring-1"
          style={{
            background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
            color: "var(--theme-gold, #F5B548)",
            borderColor: "var(--theme-gold-border, rgba(245,181,72,0.3))",
          }}
        >
          1st Edition
        </span>
      )}
      {item.edition && !item.isFirstEdition && (
        <span
          className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
          style={{ color: "var(--fg)" }}
        >
          {item.edition}
        </span>
      )}
      {item.variant && (
        <span
          className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
          style={{ color: "var(--fg)" }}
        >
          {item.variant}
        </span>
      )}
      {item.printRun && (
        <span
          className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
          style={{ color: "var(--fg)" }}
        >
          # {item.printRun}
        </span>
      )}
    </div>
  </div>
)}
```

---

### Step 5 — Verify

```bash
npx eslint src/lib/vaultModel.ts src/lib/itemIntelligence.ts src/app/vault/item/[id]/page.tsx --max-warnings=0
npm run build
```

Commit: `feat: variant and edition tracking — edition, variant, printRun, isFirstEdition fields`

---
---

## Files Touched — Both Tasks

| File | Change |
|------|--------|
| `src/lib/wishlistModel.ts` | Add 4 fields to type; update `addWishlistItem()` to object signature |
| `src/components/WishlistCard.tsx` | Full replacement |
| `src/app/wishlist/page.tsx` | Full replacement (adds sort + filter) |
| Any file calling `addWishlistItem()` | Update to object arg (run grep to find them) |
| `src/lib/vaultModel.ts` | Add 4 fields to `VaultItem` type |
| `src/lib/itemIntelligence.ts` | Add `if (item.isFirstEdition) return true` at top of `isNotable()` |
| `src/app/vault/add/page.tsx` *(or wherever the form lives)* | Add 4 variant input fields after `certNumber` |
| `src/app/vault/item/[id]/page.tsx` | Add variant chip display block |
