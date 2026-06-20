# VLTD — Vault Registry: Collector Rankings

The Vault Registry is VLTD's "bragging rights" system — global and personal leaderboards that rank collectors by how deep their collection runs on a given subject (player, character, artist, set). TCDB's single most powerful retention mechanic. No competitor has this.

This handoff is split into two phases. **Ship Phase 1 first** — it requires no server changes and gives collectors their personal leaderboard immediately. Phase 2 adds global rankings via Supabase.

---

## What "subject" means

Every vault item can optionally be tagged with a **subject** — the single most meaningful identity behind that item:

| Universe | Subject examples |
|----------|-----------------|
| SPORTS | "Shohei Ohtani", "LeBron James", "Wayne Gretzky" |
| TCG | "Pikachu", "Charizard", "Blue-Eyes White Dragon" |
| POP_CULTURE | "Spider-Man", "Luke Skywalker", "The Beatles" |
| MUSIC | "David Bowie", "Kendrick Lamar", "Miles Davis" |
| GAMES | "The Legend of Zelda", "Mario", "Final Fantasy" |
| MISC | Free-form — collector sets their own |

Subject is free-text, case-normalized on read (lowercase compare, display as-entered). One item = one subject. No multi-tagging in Phase 1.

---

## Phase 1 — Personal rankings (no server required)

### Step 1 — Add `subject` to VaultItem type

**File:** `src/lib/vaultModel.ts`

In the `VaultItem` type, after `serialNumber`:

```typescript
certNumber?: string;
serialNumber?: string;
subject?: string;          // ← ADD THIS (player, character, artist, etc.)
edition?: string;
```

In `normalizeOne()`, after the `serialNumber` line:

```typescript
serialNumber: raw.serialNumber ?? undefined,
subject: typeof raw.subject === "string" && raw.subject.trim() ? raw.subject.trim() : undefined,
edition: raw.edition ?? undefined,
```

In `bulkAddState.ts` — add `subject` to wherever `serialNumber`, `edition`, `variant` are listed in the default state and reset logic. Same pattern as those fields.

In `vaultExport.ts` — add `"subject"` to the CSV columns array alongside `certNumber` and `serialNumber`.

---

### Step 2 — Add Subject field to vault add/edit form

**File:** `src/app/vault/add/page.tsx` (and the edit form if it's separate)

Find the block with `certNumber` and `serialNumber` fields. Add `subject` just before them — it's more commonly filled in:

```tsx
{/* Subject / Player / Character */}
<div>
  <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--fg)" }}>
    Subject
    <span className="ml-1 text-[11px] font-normal" style={{ color: "var(--muted2)" }}>
      optional
    </span>
  </label>
  <input
    type="text"
    value={draft.subject ?? ""}
    onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value || undefined }))}
    placeholder={
      draft.universe === "SPORTS" ? "e.g. Shohei Ohtani" :
      draft.universe === "TCG" ? "e.g. Pikachu" :
      draft.universe === "MUSIC" ? "e.g. David Bowie" :
      draft.universe === "GAMES" ? "e.g. The Legend of Zelda" :
      "Player, character, artist, franchise…"
    }
    className="w-full rounded-xl px-3 py-2.5 text-[14px] ring-1 outline-none transition"
    style={{
      background: "var(--pill)",
      color: "var(--fg)",
      borderColor: "var(--border)",
    }}
  />
  <p className="mt-1 text-[11px]" style={{ color: "var(--muted2)" }}>
    Used for rankings — "Top Shohei Ohtani collectors on VLTD"
  </p>
</div>
```

---

### Step 3 — Create the rankings logic

**New file:** `src/lib/subjectRankings.ts`

```typescript
import type { VaultItem } from "@/lib/vaultModel";

export type SubjectRank = {
  subject: string;
  count: number;       // unique items with this subject
  totalValue: number;  // sum of currentValue
};

/**
 * Compute subject rankings from a list of items (local, personal).
 * Excludes SOLD and WISHLIST items.
 * Returns subjects sorted by count desc, then totalValue desc.
 */
export function computeSubjectRankings(items: VaultItem[]): SubjectRank[] {
  const map = new Map<string, SubjectRank>();

  for (const item of items) {
    if (item.status === "SOLD" || item.status === "WISHLIST") continue;
    if (!item.subject?.trim()) continue;

    const key = item.subject.trim().toLowerCase();
    const display = item.subject.trim();
    const existing = map.get(key);

    if (existing) {
      existing.count += 1;
      existing.totalValue += item.currentValue ?? 0;
    } else {
      map.set(key, {
        subject: display,
        count: 1,
        totalValue: item.currentValue ?? 0,
      });
    }
  }

  return [...map.values()].sort((a, b) =>
    b.count !== a.count ? b.count - a.count : b.totalValue - a.totalValue
  );
}

/**
 * How many items in this collection have a subject tag.
 * Used to show "X% of your collection is tagged".
 */
export function subjectCoverage(items: VaultItem[]): { tagged: number; total: number } {
  const active = items.filter((i) => i.status !== "SOLD" && i.status !== "WISHLIST");
  return {
    tagged: active.filter((i) => !!i.subject?.trim()).length,
    total: active.length,
  };
}
```

---

### Step 4 — Build the rankings widget

**New file:** `src/components/SubjectRankingsWidget.tsx`

```tsx
"use client";

import { useMemo } from "react";
import type { VaultItem } from "@/lib/vaultModel";
import { computeSubjectRankings, subjectCoverage } from "@/lib/subjectRankings";

function money(n: number) {
  if (!n) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

export default function SubjectRankingsWidget({
  items,
  onFilter,
  maxRows = 8,
}: {
  items: VaultItem[];
  /** Called when user taps a subject — filter vault to that subject */
  onFilter?: (subject: string) => void;
  maxRows?: number;
}) {
  const rankings = useMemo(() => computeSubjectRankings(items), [items]);
  const coverage = useMemo(() => subjectCoverage(items), [items]);

  if (rankings.length === 0) {
    return (
      <div
        className="rounded-2xl p-5 ring-1 text-center"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="text-[13px] font-semibold mb-1" style={{ color: "var(--fg)" }}>
          No subjects tagged yet
        </div>
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          Add a Subject when cataloguing items — e.g. "Pikachu" or "Shohei Ohtani" — to see your collection ranked.
        </div>
      </div>
    );
  }

  const topItems = rankings.slice(0, maxRows);

  return (
    <div
      className="rounded-2xl ring-1 overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold" style={{ color: "var(--fg)" }}>
            Your Top Collections
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
            style={{
              background: "var(--theme-gold-subtle, rgba(245,181,72,0.1))",
              color: "var(--theme-gold, #F5B548)",
              borderColor: "var(--theme-gold-border, rgba(245,181,72,0.3))",
            }}
          >
            Vault Registry
          </span>
        </div>
        {coverage.total > 0 && (
          <span className="text-[11px]" style={{ color: "var(--muted2)" }}>
            {coverage.tagged}/{coverage.total} tagged
          </span>
        )}
      </div>

      {/* Rank rows */}
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {topItems.map((rank, i) => (
          <button
            key={rank.subject.toLowerCase()}
            type="button"
            onClick={() => onFilter?.(rank.subject)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-opacity hover:opacity-70 active:opacity-50"
          >
            {/* Rank number */}
            <div
              className="w-6 text-center text-[12px] font-black flex-shrink-0"
              style={{
                color: i === 0
                  ? "var(--theme-gold, #F5B548)"
                  : i === 1
                  ? "rgba(192,192,192,0.9)"
                  : i === 2
                  ? "rgba(205,127,50,0.9)"
                  : "var(--muted2)",
              }}
            >
              {i + 1}
            </div>

            {/* Subject name */}
            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-semibold truncate"
                style={{ color: "var(--fg)" }}
              >
                {rank.subject}
              </div>
            </div>

            {/* Count pill */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {rank.totalValue > 0 && (
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {money(rank.totalValue)}
                </span>
              )}
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1"
                style={{
                  background: i === 0
                    ? "var(--theme-gold-subtle, rgba(245,181,72,0.12))"
                    : "var(--pill)",
                  color: i === 0 ? "var(--theme-gold, #F5B548)" : "var(--muted)",
                  borderColor: i === 0
                    ? "var(--theme-gold-border, rgba(245,181,72,0.35))"
                    : "var(--border)",
                }}
              >
                {rank.count} {rank.count === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="text-[11px] flex-shrink-0" style={{ color: "var(--muted2)" }}>
              →
            </div>
          </button>
        ))}
      </div>

      {/* Footer — "tag more items" nudge */}
      {coverage.total > 0 && coverage.tagged < coverage.total && (
        <div
          className="px-4 py-2.5 text-center text-[11px]"
          style={{ borderTop: "1px solid var(--border)", color: "var(--muted2)" }}
        >
          {coverage.total - coverage.tagged} items without a subject tag
        </div>
      )}
    </div>
  );
}
```

---

### Step 5 — Wire widget into vault dashboard / portfolio page

The widget fits naturally on either the Vault page (below filters) or the Portfolio page (alongside other insight panels). Recommend Portfolio page for now since it already has insight panels.

**File:** `src/app/portfolio/PortfolioClient.tsx` (or wherever the portfolio insight panels live)

Add import:

```typescript
import SubjectRankingsWidget from "@/components/SubjectRankingsWidget";
```

Add the widget in the grid alongside the other panels. Pass `items` and an `onFilter` handler. If you want the filter to navigate to the vault with a subject pre-applied, use router.push with a query param:

```tsx
<SubjectRankingsWidget
  items={items}
  onFilter={(subject) => {
    router.push(`/vault?subject=${encodeURIComponent(subject)}`);
  }}
/>
```

---

### Step 6 — Add subject to vault filter bar

**File:** `src/app/vault/VaultInner.tsx`

Add a `subject` filter state:

```typescript
const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
```

Read from URL param on mount (so the portfolio widget deep-link works):

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const s = params.get("subject");
  if (s) setSubjectFilter(decodeURIComponent(s));
}, []);
```

Add to the `filtered` computation (after existing universe/category/search filters):

```typescript
.filter((item) => {
  if (!subjectFilter) return true;
  return (item.subject ?? "").toLowerCase() === subjectFilter.toLowerCase();
})
```

Add a dismissible chip to the filter display when a subject filter is active:

```tsx
{subjectFilter && (
  <div
    className="flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 text-[12px] font-semibold"
    style={{
      background: "var(--theme-gold-subtle, rgba(245,181,72,0.1))",
      color: "var(--theme-gold, #F5B548)",
      borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))",
    }}
  >
    {subjectFilter}
    <button
      type="button"
      onClick={() => setSubjectFilter(null)}
      className="ml-0.5 text-[11px] opacity-70 hover:opacity-100"
    >
      ✕
    </button>
  </div>
)}
```

---

### Step 7 — Show subject on item detail page

**File:** `src/app/vault/item/[id]/page.tsx`

After the existing variant/edition chips block, add:

```tsx
{item.subject && (
  <div className="mt-3 flex items-center gap-2">
    <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted2)" }}>
      Subject
    </span>
    <span
      className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1"
      style={{
        background: "var(--theme-gold-subtle, rgba(245,181,72,0.1))",
        color: "var(--theme-gold, #F5B548)",
        borderColor: "var(--theme-gold-border, rgba(245,181,72,0.3))",
      }}
    >
      {item.subject}
    </span>
  </div>
)}
```

---

## Phase 2 — Global rankings (Supabase, ship after launch)

> Architecture is outlined here for awareness, but do NOT implement until there are real users to rank. Empty leaderboards hurt more than they help.

### Supabase migration

```sql
-- Add subject column to vault_items table
ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS subject TEXT;
CREATE INDEX IF NOT EXISTS idx_vault_items_subject ON vault_items(subject) WHERE subject IS NOT NULL;

-- RPC: get top collectors for a subject
CREATE OR REPLACE FUNCTION get_subject_leaderboard(p_subject TEXT, p_limit INT DEFAULT 25)
RETURNS TABLE (
  profile_id UUID,
  item_count BIGINT,
  total_value NUMERIC,
  rank BIGINT
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    profile_id,
    COUNT(*) AS item_count,
    SUM(current_value) AS total_value,
    RANK() OVER (ORDER BY COUNT(*) DESC, SUM(current_value) DESC) AS rank
  FROM vault_items
  WHERE
    subject ILIKE p_subject
    AND status != 'SOLD'
    AND status != 'WISHLIST'
    AND profile_id IS NOT NULL
  GROUP BY profile_id
  ORDER BY rank
  LIMIT p_limit;
$$;

-- RPC: get a single user's rank for a subject
CREATE OR REPLACE FUNCTION get_my_subject_rank(p_subject TEXT, p_profile_id UUID)
RETURNS TABLE (rank BIGINT, item_count BIGINT, total_count BIGINT)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH ranked AS (
    SELECT
      profile_id,
      COUNT(*) AS item_count,
      RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
    FROM vault_items
    WHERE subject ILIKE p_subject AND status NOT IN ('SOLD', 'WISHLIST')
    GROUP BY profile_id
  )
  SELECT rank, item_count, (SELECT COUNT(DISTINCT profile_id) FROM ranked) AS total_count
  FROM ranked
  WHERE profile_id = p_profile_id;
$$;
```

### Phase 2 UI (post-launch)
- Public leaderboard page: `/registry/[subject]` — "Top Shohei Ohtani Collectors"
- Ranking badge on vault dashboard: "You are #4 of 312 Pikachu collectors"
- Share card: one-tap generates an image with rank, subject, item count
- Notification trigger: "Someone just tied your #1 ranking for [subject]"

---

## Verify (Phase 1)

```bash
npx tsc --noEmit
npx eslint src/lib/subjectRankings.ts src/components/SubjectRankingsWidget.tsx --max-warnings=0
npm run build
```

Test checklist:
- [ ] `subject` field saves and loads correctly from localStorage
- [ ] Subject field appears on add form with universe-appropriate placeholder
- [ ] Subject shows as chip on item detail page
- [ ] SubjectRankingsWidget shows correct count and value for tagged items
- [ ] SOLD and WISHLIST items excluded from rankings
- [ ] Tapping a subject row in the widget navigates to vault with that subject filter active
- [ ] Subject filter chip shows and can be dismissed
- [ ] CSV export includes `subject` column

Commit: `feat: vault registry — subject tagging + personal collection rankings`

---

## Files changed summary

| File | Change |
|------|--------|
| `src/lib/vaultModel.ts` | Add `subject?: string` to VaultItem type + normalizeOne() |
| `src/lib/bulkAddState.ts` | Add `subject` to default state and reset |
| `src/lib/vaultExport.ts` | Add `subject` to CSV columns |
| `src/app/vault/add/page.tsx` | Add Subject form field with universe-aware placeholder |
| `src/app/vault/item/[id]/page.tsx` | Show subject chip on detail page |
| `src/app/vault/VaultInner.tsx` | Add subjectFilter state, URL param read, filter logic, active chip |
| `src/lib/subjectRankings.ts` | **NEW** — computeSubjectRankings(), subjectCoverage() |
| `src/components/SubjectRankingsWidget.tsx` | **NEW** — ranked leaderboard widget |
| `src/app/portfolio/PortfolioClient.tsx` | Wire in SubjectRankingsWidget |
