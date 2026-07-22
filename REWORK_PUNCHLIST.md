# VLTD Rework Punch-List

Audit date: 2026-07-18

Two things were checked:

1. **The 10 desktop mockups** in `C:\Users\EK\.codex\generated_images\019e6d3a-5dd3-7ed1-be13-942347ebb5c9\`
   (`vltd-concept-01..20`, desktop + mobile for each page).
2. **The code**, scanned for controls that render but do nothing (buttons with no
   handler, links going nowhere).

The dead-control findings below are **verified from the code** — high confidence.
The visual match to each mockup is **not** verified (the preview browser isn't
signed in, so the logged-in pages can't be viewed yet).

---

## Page status

| # | Mockup | Route | Visual rework | Controls working |
|---|--------|-------|---------------|------------------|
| 1 | Home | `/` + `/dashboard` | not verified | not audited |
| 2 | Vault | `/vault` | not verified | clean in scan |
| 3 | Discover | `/discover` | not verified | **6 dead** |
| 4 | Exhibitions | `/museum` | not verified | 2 to verify |
| 5 | Insights | `/portfolio` | partially done | clean in scan |
| 6 | Watchlist | **`/wishlist`** (naming mismatch) | not verified | **9 dead** |
| 7 | Goals | `/goals` | not verified | **4 dead** |
| 8 | Learn | `/learn` | **DONE** | **all working** |
| 9 | Activity | `/activity` | not verified | **2 dead + feature unwired** |
| 10 | Capture | `/capture` | not verified | clean in scan |

---

## Dead controls (confirmed in code)

These render but have no handler — clicking them does nothing.

### `/wishlist` — 9
- L357 — filter pills (rendered from a label list, no handler)
- L397, L400 — two icon buttons (sort / view toggle)
- L460, L461 — `‹` `›` previous/next arrows
- L479 — unlabeled icon button
- L505 — "View all ›"
- L515 — "Edit"
- L532 — "Share"

### `/discover` — 6
- L323 — category dropdown pill
- L375, L387, L399 — "View all" (three separate rows)
- L495 — "Share"
- L496 — "Report"

### `/goals` — 4
- L452 — "⋯" row menu
- L514 — goal row button
- L527 — "View all ›"
- L544 — "Share goal"

### `/activity` — 2
- L458 — "Filters"
- L512 — "Load more"

### To verify (may be intentional)
- `src/components/gallery/GalleryLayout.tsx` L142, L215 — small icon buttons

### Confirmed NOT bugs
- `src/app/account/page.tsx` L447 — `disabled` on purpose (paid feature)
- `src/components/ThemeToggle.tsx` L14 — pre-mount placeholder, replaced on mount

---

## Half-built feature: value-change activity

`src/lib/activityEvents.ts` exists and `/activity` reads from it, but:

- **No migration** — there is no `activity_events` table in `supabase/migrations/`.
- **Nothing writes to it** — `addActivityEvent()` is exported but never called.

So the "value refreshed / before → after" activity will always be empty. To make
it real, three things are needed:

1. A migration creating `activity_events` (owner-only RLS, same convention as
   `saved_articles` / `wishlist`).
2. `addActivityEvent()` called at the exact moment a value is refreshed, so old
   value, new value, source, and confidence are captured.
3. Nothing else — `/activity` already reads and renders it.

---

## Naming mismatch

The mockups and their nav call it **Watchlist**, but the app route is
**`/wishlist`** (and there is a separate `watchlistModel.ts`). Decide on one name
so the nav, route, and model agree.

---

## Suggested order

1. **Wishlist** — most dead controls (9), and it's a core feature.
2. **Discover** — 6 dead, and it's a main nav destination.
3. **Goals** — 4 dead.
4. **Activity** — 2 dead + wire the `activity_events` table and write calls.
5. Then the visual pass on remaining pages vs their mockups.

`/learn` is the reference for "done": rebuilt to its mockup, and every control
(Save, newsletter, article links) is real and verified.
