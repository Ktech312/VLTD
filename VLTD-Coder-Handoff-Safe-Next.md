# VLTD — Safe Next Coder Handoff
**5 tasks, zero questions. Each spec has exact file paths, exact type changes, and ready-to-paste code.**

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Supabase.  
Styling convention: use CSS variables (`var(--surface)`, `var(--border)`, `var(--muted)`, `var(--theme-gold)`, etc.) — match the pattern in `CostToSellPanel.tsx` and `WishlistCard.tsx`. No hard-coded colors.

---

## TASK 1 — Data Export / Vault Portability

**What:** Add an "Export" button to the vault that lets users download their full collection as CSV or JSON. Counter-positioning against Beckett's locked data. This is a zero-dependency feature — all data is already in localStorage.

---

### Step 1 — Create `src/lib/vaultExport.ts` (new file)

```typescript
// src/lib/vaultExport.ts
import { downloadCsv } from "@/lib/exportCsv";
import { loadItems, type VaultItem } from "@/lib/vaultModel";

// Column order for CSV export
const CSV_COLUMNS: (keyof VaultItem)[] = [
  "id",
  "universe",
  "category",
  "title",
  "subtitle",
  "number",
  "grade",
  "certNumber",
  "serialNumber",
  "purchasePrice",
  "purchaseTax",
  "purchaseShipping",
  "purchaseFees",
  "currentValue",
  "estimatedValue",
  "priceConfidence",
  "purchaseSource",
  "valueSource",
  "status",
  "soldPrice",
  "soldAt",
  "notes",
  "createdAt",
];

export function exportVaultCsv() {
  const items = loadItems();
  downloadCsv("vltd-vault-export.csv", items as any[], CSV_COLUMNS as string[]);
}

export function exportVaultJson() {
  const items = loadItems();
  const json = JSON.stringify({ exportedAt: Date.now(), version: 1, items }, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vltd-vault-export.json";
  a.click();
  URL.revokeObjectURL(url);
}
```

---

### Step 2 — Create `src/components/VaultExportButton.tsx` (new file)

```tsx
// src/components/VaultExportButton.tsx
"use client";

import { useState } from "react";
import { exportVaultCsv, exportVaultJson } from "@/lib/vaultExport";

export default function VaultExportButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:brightness-110"
        style={{ background: "var(--pill)", color: "var(--muted)" }}
      >
        Export ↓
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 z-20 mt-2 w-44 rounded-2xl p-2 shadow-xl ring-1 ring-[color:var(--border)]"
            style={{ background: "var(--surface)" }}
          >
            <button
              type="button"
              onClick={() => { exportVaultCsv(); setOpen(false); }}
              className="w-full rounded-xl px-4 py-2.5 text-left text-sm transition hover:brightness-110"
              style={{ color: "var(--fg)" }}
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => { exportVaultJson(); setOpen(false); }}
              className="w-full rounded-xl px-4 py-2.5 text-left text-sm transition hover:brightness-110"
              style={{ color: "var(--fg)" }}
            >
              Download JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

### Step 3 — Add button to vault header

**File:** `src/app/vault/VaultClient.tsx` (or wherever the vault header lives — search for the `+ Add Item` button and put `VaultExportButton` right next to it)

```tsx
// Add import at top:
import VaultExportButton from "@/components/VaultExportButton";

// Find the header row that contains the "+ Add Item" button. Add VaultExportButton next to it:
// Before:
<Link href="/vault/add">+ Add Item</Link>

// After:
<div className="flex items-center gap-2">
  <VaultExportButton />
  <Link href="/vault/add">+ Add Item</Link>
</div>
```

---

### Step 4 — Done. No API, no external dependency. XLSX is available if you also want an Excel export — call `exportToXlsx("vltd-vault-export.xlsx", items)` from `src/lib/exportXlsx.ts`.

---

---

## TASK 2 — Notable / Key Item Detection (Rules-Based First Pass)

**What:** Flag items that are likely high-significance based on keywords in existing fields (title, subtitle, grade, notes). Show a "Notable" badge on VaultCard and item detail. No external API needed.

---

### Step 1 — Add `isNotable()` to `src/lib/itemIntelligence.ts`

Append this to the bottom of the existing file (don't change anything above):

```typescript
// ── Notable / Key Item Detection ─────────────────────────────────────────────

const NOTABLE_KEYWORDS = [
  // Grade indicators
  "psa 10", "psa 9", "bgs 9.5", "bgs 10", "cgc 9.8", "cgc 9.9", "cgc 10",
  "sgc 10", "graded", "gem mint", "perfect",
  // Print-run / edition
  "1st edition", "first edition", "first print", "1st print",
  "limited edition", "limited run", "1/1", "numbered",
  "gold label", "black label",
  // Card/comic significance
  "rookie", "rc", "auto", "autograph", "refractor",
  "prizm", "superfractor",
  "key issue", "1st appearance", "first appearance",
  "origin", "death of",
  // General rarity
  "error", "misprint", "variant", "prototype", "proof",
  "factory sealed", "sealed", "mint in box", "mib",
];

const NOTABLE_VALUE_THRESHOLD = 100; // flag anything over $100 current value

/**
 * Returns true if the item is likely a notable / key collectible,
 * based on rules — no external API required.
 */
export function isNotable(item: VaultItem): boolean {
  const searchable = [
    item.title ?? "",
    item.subtitle ?? "",
    item.grade ?? "",
    item.notes ?? "",
    item.certNumber ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const keywordMatch = NOTABLE_KEYWORDS.some((kw) => searchable.includes(kw));

  const highValue =
    typeof item.currentValue === "number" &&
    item.currentValue >= NOTABLE_VALUE_THRESHOLD;

  return keywordMatch || highValue;
}

/**
 * Returns a short label for why an item is notable, for display in a badge tooltip.
 */
export function notableReason(item: VaultItem): string {
  const reasons: string[] = [];
  const searchable = [item.title ?? "", item.subtitle ?? "", item.grade ?? "", item.notes ?? ""]
    .join(" ")
    .toLowerCase();

  if (searchable.includes("1st edition") || searchable.includes("first edition")) reasons.push("1st Edition");
  if (searchable.includes("rookie") || searchable.includes(" rc ")) reasons.push("Rookie");
  if (searchable.includes("autograph") || searchable.includes(" auto")) reasons.push("Autograph");
  if (/psa\s*10|bgs\s*9\.5|cgc\s*9\.8/.test(searchable)) reasons.push("High Grade");
  if (searchable.includes("1/1")) reasons.push("1/1");
  if (typeof item.currentValue === "number" && item.currentValue >= NOTABLE_VALUE_THRESHOLD) {
    reasons.push(`$${Math.round(item.currentValue).toLocaleString()}`);
  }

  return reasons.length > 0 ? reasons.join(" · ") : "Notable";
}
```

---

### Step 2 — Create `src/components/NotableBadge.tsx` (new file)

```tsx
// src/components/NotableBadge.tsx
export default function NotableBadge({ reason }: { reason?: string }) {
  return (
    <span
      title={reason ?? "Notable item"}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ring-1"
      style={{
        background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
        color: "var(--theme-gold, #F5B548)",
        borderColor: "var(--theme-gold-border, rgba(245,181,72,0.3))",
      }}
    >
      ★ Key
    </span>
  );
}
```

---

### Step 3 — Add badge to VaultCard

**File:** `src/app/vault/VaultCard.tsx`

```tsx
// Add imports at top:
import { isNotable, notableReason } from "@/lib/itemIntelligence";
import NotableBadge from "@/components/NotableBadge";

// Inside the card JSX, near the title/grade display, add:
{isNotable(item) && <NotableBadge reason={notableReason(item)} />}
```

---

### Step 4 — Add badge to item detail page

**File:** `src/app/vault/item/[id]/page.tsx` (search for where `title` or `grade` is rendered at the top of the detail view)

```tsx
// Add imports:
import { isNotable, notableReason } from "@/lib/itemIntelligence";
import NotableBadge from "@/components/NotableBadge";

// Near the item title in the detail header:
{isNotable(item) && <NotableBadge reason={notableReason(item)} />}
```

---

### Step 5 (optional bonus) — Filter by notable in vault list

In the vault filter controls (wherever category/universe filters live), add a "Key Items" toggle that filters `items.filter(isNotable)`. The `isNotable` function is pure and fast — call it inline.

---

---

## TASK 3 — Variant / Edition Tracking (Structured Fields)

**What:** Add structured variant fields to VaultItem and surface them in the Add/Edit form. Lets users distinguish a 1st Edition Charizard from a Shadowless or Unlimited without burying it in notes.

---

### Step 1 — Extend `VaultItem` type in `src/lib/vaultModel.ts`

Find the `VaultItem` type definition and add these fields:

```typescript
// Add inside the VaultItem type (after serialNumber, before or after notes):
  edition?: string;           // e.g. "1st Edition", "Unlimited", "Shadowless", "Base Set"
  variant?: string;           // e.g. "Holo", "Reverse Holo", "Non-Holo", "Foil"
  printRun?: string;          // e.g. "1/250", "Artist Proof", "Test Print"
  isFirstEdition?: boolean;   // quick flag for filter / notable detection
```

Full updated type for that section (context lines shown for placement):

```typescript
  certNumber?: string;
  serialNumber?: string;
  // ── Variant / Edition ────────────────────────────────────────────────────
  edition?: string;
  variant?: string;
  printRun?: string;
  isFirstEdition?: boolean;
  // ─────────────────────────────────────────────────────────────────────────
  valueSource?: string;
```

No migration needed — new fields are optional and will be `undefined` on existing items.

---

### Step 2 — Add fields to the vault add/edit form

**File:** Find the Add/Edit form component. Search codebase for `certNumber` — it's already a form field, so the variant fields go right near it.

Run: `grep -r "certNumber" src/app --include="*.tsx" -l` to find the exact file.

Once found, add this block after the `certNumber` field:

```tsx
{/* ── Variant / Edition ───────────────────────────────────────── */}
<div className="grid gap-4 sm:grid-cols-2">
  <label className="grid gap-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">
      Edition
    </span>
    <input
      value={form.edition ?? ""}
      onChange={(e) => setForm((f) => ({ ...f, edition: e.target.value }))}
      className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
      placeholder="e.g. 1st Edition, Unlimited, Base Set"
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
    onChange={(e) => setForm((f) => ({ ...f, isFirstEdition: e.target.checked }))}
    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]"
  />
  <span className="text-sm" style={{ color: "var(--fg)" }}>
    First Edition / First Print
  </span>
</label>
```

---

### Step 3 — Show variant fields on item detail page

**File:** `src/app/vault/item/[id]/page.tsx` — find the metadata section (where `grade`, `certNumber` display).

```tsx
{/* Variant details — only render if any field is set */}
{(item.edition || item.variant || item.printRun || item.isFirstEdition) && (
  <div className="mt-4 rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
    <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">
      Edition / Variant
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {item.isFirstEdition && (
        <span className="rounded-full px-3 py-1 text-xs font-semibold ring-1"
          style={{ background: "var(--theme-gold-subtle)", color: "var(--theme-gold)", borderColor: "var(--theme-gold-border)" }}>
          1st Edition
        </span>
      )}
      {item.edition && (
        <span className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
          style={{ color: "var(--fg)" }}>
          {item.edition}
        </span>
      )}
      {item.variant && (
        <span className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
          style={{ color: "var(--fg)" }}>
          {item.variant}
        </span>
      )}
      {item.printRun && (
        <span className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
          style={{ color: "var(--fg)" }}>
          # {item.printRun}
        </span>
      )}
    </div>
  </div>
)}
```

---

### Step 4 — Update `isFirstEdition` auto-detection in `isNotable()`

Back in `src/lib/itemIntelligence.ts`, the `isNotable()` function already checks for "1st edition" text. After adding the form field, also check the boolean:

```typescript
// At the start of isNotable(), add:
if (item.isFirstEdition) return true;
```

---

---

## TASK 4 — Want List Improvements

**What:** Add `condition`, `priority`, `universe`, and `category` fields to `WishlistItem`. Update the type, the model functions, the card UI, the add flow, and the page (filter/sort). `targetPrice` and `notes` already exist — don't re-add them.

---

### Step 1 — Update `WishlistItem` type in `src/lib/wishlistModel.ts`

**Current type:**
```typescript
export type WishlistItem = {
  id: string;
  title: string;
  targetPrice?: number;
  notes?: string;
  createdAt: number;
};
```

**Updated type:**
```typescript
export type WishlistItem = {
  id: string;
  title: string;
  targetPrice?: number;        // already exists
  notes?: string;              // already exists
  createdAt: number;
  // ── New fields ──────────────────
  universe?: string;           // e.g. "TCG", "SPORTS", "POP_CULTURE"
  category?: string;           // e.g. "Trading Cards", "Comics"
  condition?: "any" | "raw" | "graded" | "nm" | "ex";
  priority?: "low" | "medium" | "high";
};
```

No migration needed — new fields are optional, existing items just won't have them.

---

### Step 2 — Update `addWishlistItem()` in `src/lib/wishlistModel.ts`

Find the `addWishlistItem` function. It currently takes some subset of WishlistItem fields. Update its parameter type to accept the new fields:

```typescript
// Before (approximate — match whatever signature exists):
export function addWishlistItem(title: string, targetPrice?: number, notes?: string): WishlistItem

// After:
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

If there are call sites that use the old positional signature, update them to pass an object: `addWishlistItem({ title, targetPrice, notes })`.

---

### Step 3 — Replace `src/components/WishlistCard.tsx`

Full replacement — this is the complete file:

```tsx
// src/components/WishlistCard.tsx
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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
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
        <div className="mt-0.5 text-sm" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
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
        <div className="mt-1.5 text-xs" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
          Condition: {CONDITION_LABELS[item.condition] ?? item.condition}
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <div
          className="mt-2 rounded-xl p-2.5 text-xs leading-relaxed"
          style={{ background: "var(--pill, rgba(255,255,255,0.04))", color: "var(--muted)" }}
        >
          {item.notes}
        </div>
      )}
    </div>
  );
}
```

---

### Step 4 — Update `src/app/wishlist/page.tsx`

Add sort + filter controls above the grid. Full replacement:

```tsx
// src/app/wishlist/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { loadWishlist, type WishlistItem } from "@/lib/wishlistModel";
import WishlistCard from "@/components/WishlistCard";

function IconHeart({ size = 24, style }: { size?: number; style?: Record<string, string | number> }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
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

    // Filter
    if (filterPriority !== "all") {
      list = list.filter((i) => i.priority === filterPriority);
    }

    // Sort
    if (sort === "price-asc") {
      list.sort((a, b) => (a.targetPrice ?? Infinity) - (b.targetPrice ?? Infinity));
    } else if (sort === "price-desc") {
      list.sort((a, b) => (b.targetPrice ?? -Infinity) - (a.targetPrice ?? -Infinity));
    } else if (sort === "priority") {
      const order = { high: 0, medium: 1, low: 2, undefined: 3 };
      list.sort((a, b) => (order[a.priority ?? "undefined"] ?? 3) - (order[b.priority ?? "undefined"] ?? 3));
    } else {
      // newest
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
            <h1 className="text-2xl font-black tracking-[-0.04em]" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
              Wishlist
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
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

        {/* Controls */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {/* Sort */}
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

            {/* Priority filter */}
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

            <span className="self-center text-xs" style={{ color: "var(--muted)" }}>
              {sorted.length} item{sorted.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 ? (
          <div className="rounded-[24px] border p-8 text-center" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--theme-gold-subtle, rgba(245,181,72,0.10))", border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.25))" }}>
              <IconHeart size={24} style={{ color: "var(--theme-gold, #F5B548)" }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
              Your wishlist is empty
            </h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              Save items you&apos;re eyeing to track prices and build toward your next acquisition.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/vault/add" className="rounded-full px-5 py-2 text-sm font-semibold transition" style={{ background: "linear-gradient(135deg, #8B6914 0%, #C8941F 25%, #F5B548 50%, #FFE08A 70%, #C8941F 100%)", color: "#0B0B0B" }}>
                Browse &amp; Add Items
              </Link>
              <Link href="/vault" className="rounded-full border px-5 py-2 text-sm font-semibold transition" style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.30))", color: "var(--theme-gold, #F5B548)" }}>
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

### Step 5 — Update Add flow to pass new fields

Find where items are added to the wishlist (the `AddToWishlistButton.tsx` or the vault add form's wishlist toggle). Update any `addWishlistItem()` calls to pass the new fields using the object signature from Step 2. Example:

```typescript
// Before:
addWishlistItem(title, targetPrice, notes)

// After:
addWishlistItem({ title, targetPrice, notes, universe: item.universe, category: item.category })
```

---

---

## TASK 5 — Portfolio-Level Net Proceeds

**What:** Show "If I sold everything today, what would I net?" at the portfolio level. Reuses the same fee logic from `CostToSellPanel.tsx`. No new API calls.

---

### Step 1 — Add `getNetProceedsEstimate()` to `src/lib/portfolioMetrics.ts`

Append to the bottom of the existing file:

```typescript
// ── Portfolio-level Net Proceeds ──────────────────────────────────────────────

export type NetProceedsResult = {
  totalCurrentValue: number;
  totalCostBasis: number;
  estimatedFees: number;
  estimatedShipping: number;
  netProceeds: number;
  netGainLoss: number;
  netRoi: number;
  itemCount: number;
};

const PLATFORM_FEE_RATES: Record<string, number> = {
  ebay:    0.129,
  mercari: 0.100,
  whatnot: 0.088,
  pwcc:    0.200,
  discogs: 0.090,
  custom:  0.129, // default to eBay rate
};

// Estimated average shipping cost per item for a bulk "sell everything" scenario
const AVG_SHIPPING_PER_ITEM = 5;

/**
 * Estimates total net proceeds if every item in the vault were sold today
 * on a given platform, minus fees and estimated shipping.
 */
export function getNetProceedsEstimate(
  items: VaultItem[],
  platform: keyof typeof PLATFORM_FEE_RATES = "ebay"
): NetProceedsResult {
  const safeItems = safeArray(items).filter((i) => i.status !== "SOLD" && i.status !== "WISHLIST");

  const feeRate = PLATFORM_FEE_RATES[platform] ?? PLATFORM_FEE_RATES.ebay;

  const totalCurrentValue = safeItems.reduce((sum, i) => sum + itemCurrentValue(i), 0);
  const totalCostBasis = safeItems.reduce((sum, i) => sum + itemTotalCost(i), 0);
  const estimatedFees = totalCurrentValue * feeRate;
  const estimatedShipping = safeItems.length * AVG_SHIPPING_PER_ITEM;
  const netProceeds = totalCurrentValue - estimatedFees - estimatedShipping;
  const netGainLoss = netProceeds - totalCostBasis;
  const netRoi = totalCostBasis > 0 ? (netGainLoss / totalCostBasis) * 100 : 0;

  return {
    totalCurrentValue,
    totalCostBasis,
    estimatedFees,
    estimatedShipping,
    netProceeds,
    netGainLoss,
    netRoi,
    itemCount: safeItems.length,
  };
}
```

---

### Step 2 — Create `src/components/PortfolioNetProceedsPanel.tsx` (new file)

```tsx
// src/components/PortfolioNetProceedsPanel.tsx
"use client";

import { useMemo, useState } from "react";
import { getNetProceedsEstimate } from "@/lib/portfolioMetrics";
import type { VaultItem } from "@/lib/vaultModel";

type Platform = "ebay" | "mercari" | "whatnot" | "pwcc" | "discogs";

const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: "ebay",    label: "eBay" },
  { id: "mercari", label: "Mercari" },
  { id: "whatnot", label: "Whatnot" },
  { id: "pwcc",    label: "PWCC" },
  { id: "discogs", label: "Discogs" },
];

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export default function PortfolioNetProceedsPanel({ items }: { items: VaultItem[] }) {
  const [platform, setPlatform] = useState<Platform>("ebay");

  const result = useMemo(
    () => getNetProceedsEstimate(items, platform),
    [items, platform]
  );

  const isPositive = result.netGainLoss >= 0;

  return (
    <div className="rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">
        Net If Sold Today
      </div>
      <div className="mt-1 text-sm text-[color:var(--muted)]">
        Estimated proceeds across {result.itemCount} item{result.itemCount !== 1 ? "s" : ""} after platform fees + shipping
      </div>

      {/* Platform selector */}
      <div className="mt-4 flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlatform(p.id)}
            className={[
              "rounded-full px-4 py-1.5 text-sm ring-1 transition",
              platform === p.id
                ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
                : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats grid */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Current Value", value: money(result.totalCurrentValue) },
          { label: "Est. Fees",     value: money(result.estimatedFees) },
          { label: "Est. Shipping", value: money(result.estimatedShipping) },
          { label: "Net Proceeds",  value: money(result.netProceeds) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">{label}</div>
            <div className="mt-2 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {/* Net gain / loss highlight */}
      <div className="mt-3 rounded-2xl bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Net Gain / Loss vs Cost Basis</div>
            <div className={["mt-2 text-2xl font-semibold", isPositive ? "text-emerald-300" : "text-red-300"].join(" ")}>
              {money(result.netGainLoss)}
            </div>
          </div>
          <div className={["text-right text-lg font-bold", isPositive ? "text-emerald-300" : "text-red-300"].join(" ")}>
            {pct(result.netRoi)}
          </div>
        </div>
        <div className="mt-2 text-xs text-[color:var(--muted)]">
          Cost basis: {money(result.totalCostBasis)} · Shipping estimated at $5/item
        </div>
      </div>
    </div>
  );
}
```

---

### Step 3 — Add panel to `src/app/portfolio/PortfolioClient.tsx`

```tsx
// Add import at top:
import PortfolioNetProceedsPanel from "@/components/PortfolioNetProceedsPanel";

// Find the portfolio page's main content area — somewhere after the top summary metrics.
// `items` is already loaded in PortfolioClient (it calls loadItemsOrSeed()).
// Add the panel:

<PortfolioNetProceedsPanel items={items} />
```

`items` is already available — search for `loadItemsOrSeed` in `PortfolioClient.tsx` to confirm the variable name, then pass it directly.

---

### Step 4 — Done. No migration, no external API, no new dependencies.

---

---

## Quick Reference — All Touched Files

| Task | New Files | Modified Files |
|------|-----------|---------------|
| 1 – Export | `src/lib/vaultExport.ts` · `src/components/VaultExportButton.tsx` | `src/app/vault/VaultClient.tsx` |
| 2 – Notable | `src/components/NotableBadge.tsx` | `src/lib/itemIntelligence.ts` · `src/app/vault/VaultCard.tsx` · `src/app/vault/item/[id]/page.tsx` |
| 3 – Variants | _(none)_ | `src/lib/vaultModel.ts` · vault add/edit form · `src/app/vault/item/[id]/page.tsx` |
| 4 – Want List | _(none)_ | `src/lib/wishlistModel.ts` · `src/components/WishlistCard.tsx` · `src/app/wishlist/page.tsx` · `src/components/AddToWishlistButton.tsx` |
| 5 – Net Proceeds | `src/components/PortfolioNetProceedsPanel.tsx` | `src/lib/portfolioMetrics.ts` · `src/app/portfolio/PortfolioClient.tsx` |

## Dependency Order

All 5 tasks are independent — no task blocks another. Suggested order if doing them sequentially:
1. **Task 1** (Export) — fastest, purest win, zero risk
2. **Task 4** (Want List) — type-only change + UI, well-contained
3. **Task 5** (Net Proceeds) — one new function + one new component
4. **Task 2** (Notable) — rules file + badge, low risk
5. **Task 3** (Variants) — type change + form fields, touches the most UI
