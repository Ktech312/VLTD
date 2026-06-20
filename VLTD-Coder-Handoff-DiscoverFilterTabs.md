# VLTD — Wire Discover Page Filter Tabs + Search

**Philosophy:** The Discover page already fetches real galleries from Supabase. The filter tabs and search input are built in the UI — they just don't do anything. Two additions: make the tabs filter by category, make the search filter by title. Both are client-side — no extra Supabase calls.

**Files changed:** 1 (`src/app/discover/page.tsx`)

---

## Current state

- `activeTab` state exists and updates on click — never applied to displayed data
- `query` state exists and updates on keystroke — never applied to displayed data
- `galleries` is fetched from Supabase (PUBLIC + ACTIVE, sorted by analytics_views desc)
- `featuredGalleries = galleries.slice(0, 6)` — raw slice, no filtering

---

## Step 1 — Expand the gallery fetch to include filterable fields

The current select:
```ts
.select("id,title,cover_image,profile_id,analytics_views")
```

Replace with:
```ts
.select("id,title,description,cover_image,theme_pack,profile_id,analytics_views")
```

Update the `PublicGallery` type to match:

```ts
type PublicGallery = {
  id: string;
  title: string;
  description: string;
  cover_image: string;
  theme_pack: string;
  profile_id: string;
  analytics_views: number;
};
```

---

## Step 2 — Add a category inference function

Add this function above the `DiscoverPage` component:

```ts
function inferGalleryCategory(gallery: PublicGallery): string {
  const text = [gallery.title, gallery.description, gallery.theme_pack]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ");

  if (/pokemon|magic|yugioh|tcg|card|slab|foil|single/.test(text)) return "TCG";
  if (/sports|rookie|jersey|autograph|memorabilia|baseball|basketball|football|hockey/.test(text)) return "Sports";
  if (/vinyl|album|music|record|artist|instrument/.test(text)) return "Music";
  if (/watch|watches|jewelry|apparel|streetwear|luxury|sneaker/.test(text)) return "Accessories";
  if (/comic|marvel|dc|figure|toy|manga|poster|prop|art toy/.test(text)) return "Pop Culture";
  if (/game|console|nintendo|playstation|xbox|arcade|cartridge/.test(text)) return "Games";

  return "Misc";
}
```

---

## Step 3 — Add a tab-to-category mapping

Add this constant above the component:

```ts
const TAB_CATEGORY_MAP: Record<string, string | null> = {
  "For You":   null,           // no filter — show everything
  "Trending":  null,           // no filter — already sorted by views
  "Art Toys":  "Pop Culture",
  "Sneakers":  "Accessories",
  "Watches":   "Accessories",
  "Comics":    "Pop Culture",
  "All":       null,
};
```

---

## Step 4 — Apply filtering to featuredGalleries

Replace this line:
```ts
const featuredGalleries = galleries.slice(0, 6);
```

With:
```ts
const featuredGalleries = useMemo(() => {
  const q = query.trim().toLowerCase();
  const categoryFilter = TAB_CATEGORY_MAP[activeTab] ?? null;

  return galleries
    .filter((g) => {
      if (categoryFilter && inferGalleryCategory(g) !== categoryFilter) return false;
      if (q) {
        const text = [g.title, g.description].filter(Boolean).join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    })
    .slice(0, 6);
}, [galleries, activeTab, query]);
```

Add `useMemo` to the import at the top — it's already imported (`useEffect, useState` are there; add `useMemo`):

```ts
import { useEffect, useMemo, useState } from "react";
```

Also add the constant `TAB_CATEGORY_MAP` and `inferGalleryCategory` imports aren't needed — they're defined locally in this file.

---

## Step 5 — Add a filtered empty state

Currently the empty state only shows when `galleries.length === 0` (no real data). With filtering, we need a second empty state for "no matches" — find the `featuredGalleries.length > 0` check in the Featured Museums section and add a branch:

Find:
```tsx
) : featuredGalleries.length > 0 ? (
  <div className="grid gap-4 sm:grid-cols-3">
    {featuredGalleries.map((gallery) => ( ... ))}
  </div>
) : (
  <div /* existing "Be the first" empty state */ />
```

Replace the inner conditional with:
```tsx
) : featuredGalleries.length > 0 ? (
  <div className="grid gap-4 sm:grid-cols-3">
    {featuredGalleries.map((gallery) => ( ... ))}
  </div>
) : galleries.length > 0 ? (
  /* Filtered empty state — data exists but tab/search has no matches */
  <div
    className="rounded-[18px] p-8 text-center"
    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
  >
    <div className="font-semibold" style={{ color: "var(--fg)" }}>
      No {activeTab === "All" || activeTab === "For You" || activeTab === "Trending" ? "" : activeTab} collections yet.
    </div>
    <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
      Try a different category or clear your search.
    </div>
    <button
      type="button"
      onClick={() => { setActiveTab("All"); }}
      className="mt-4 inline-flex items-center rounded-full px-5 py-2 text-sm font-bold transition"
      style={{ border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.3))", color: "var(--theme-gold, #F5B548)" }}
    >
      Show All
    </button>
  </div>
) : (
  /* Original "Be the first" empty state (no data at all) */
  <div
    className="rounded-[18px] p-8 text-center"
    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
  >
    <div className="mb-2 text-3xl">🏛</div>
    <div className="font-semibold" style={{ color: "var(--fg)" }}>Be the first to share your collection</div>
    <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
      No public museums yet. Create yours and inspire other collectors.
    </div>
    <Link
      href="/museum/new"
      className="mt-4 inline-flex items-center rounded-full px-5 py-2 text-sm font-bold transition"
      style={{ background: "var(--theme-gold, #F5B548)", color: "#0B0B0B" }}
    >
      Create Museum
    </Link>
  </div>
)}
```

---

## Step 6 — Apply the same filter to the Trending Exhibitions scroll row

The Trending row currently shows `galleries` (all fetched). Apply the same filter:

Find:
```tsx
{galleries.map((gallery) => (
  <Link key={gallery.id} href="/museum" ...>
```

Replace `galleries` with `filteredGalleries` where:
```ts
const filteredGalleries = useMemo(() => {
  const q = query.trim().toLowerCase();
  const categoryFilter = TAB_CATEGORY_MAP[activeTab] ?? null;
  return galleries.filter((g) => {
    if (categoryFilter && inferGalleryCategory(g) !== categoryFilter) return false;
    if (q) {
      const text = [g.title, g.description].filter(Boolean).join(" ").toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
}, [galleries, activeTab, query]);
```

Actually, to keep it DRY, define `filteredGalleries` once and derive `featuredGalleries` from it:

```ts
const filteredGalleries = useMemo(() => {
  const q = query.trim().toLowerCase();
  const categoryFilter = TAB_CATEGORY_MAP[activeTab] ?? null;
  return galleries.filter((g) => {
    if (categoryFilter && inferGalleryCategory(g) !== categoryFilter) return false;
    if (q) {
      const text = [g.title, g.description].filter(Boolean).join(" ").toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
}, [galleries, activeTab, query]);

const featuredGalleries = filteredGalleries.slice(0, 6);
```

Then use `filteredGalleries` in the Trending row (instead of `galleries`), and `featuredGalleries` in the Featured Museums grid.

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] Default load: "For You" tab active, all galleries shown
- [ ] Click "Comics" tab → only galleries with Pop Culture category shown; Trending row also filters
- [ ] Click "Watches" or "Sneakers" → Accessories-category galleries only
- [ ] Click "All" → all galleries shown again
- [ ] Type in search box → filters both sections in real time
- [ ] Search + tab combined → both filters apply together
- [ ] No results → "filtered empty state" shows with "Show All" button; clicking it resets to All tab
- [ ] No data at all → original "Be the first" empty state
- [ ] TypeScript passes with no new errors

Commit: `feat: wire discover page filter tabs and search — real category filtering and query filter on both gallery sections`
