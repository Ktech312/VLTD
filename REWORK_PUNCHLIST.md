# VLTD Rework Punch-List

Audit: 2026-07-18. Dead-control pass completed the same night.

---

## ONE THING TO DO

Run this migration in Supabase (same as you did for the Learn one):

**`supabase/migrations/20260718_activity_events.sql`**

Until it runs, value-change history still works on the device you're using but
won't sync across devices. Everything else below works right now.

---

## Done — every dead control is now wired

A code scan found 21 controls that rendered but did nothing. All are fixed.
Re-scanning now returns **zero** dead controls (the only two hits left are a
deliberately disabled paid feature on Account and a theme-toggle placeholder
that swaps in on load).

### Wishlist (`/wishlist`) — 9 fixed
- Top filter buttons (Items / Exhibitions / Price Drops) now filter. Removed
  "Saved Searches" — no such feature exists.
- Grid/list toggle switches the layout.
- Detail panel prev/next step through the list; disabled at the ends.
- Target price is editable and saves.
- Notes are editable and save.
- Share shares/copies the item summary.
- Removed "View all" on Comparable Sales — nothing to show until a pricing
  source is linked.

### Discover (`/discover`) — 6 fixed
- Four fake dropdowns replaced with two real controls: Universe filter and
  Sort (recommended / most viewed / most items / newest / A–Z). Dropped
  "Value range" and "Exhibition Grade" — galleries carry no value or grade
  data, so they could only ever be decorative.
- All three "View all" buttons expand their section.
- Share shares/copies the room's public link.
- Report files a real report into the `bug_reports` inbox you already read.
- Bonus: "Trending", "New This Week", and "Notable Items" were all arbitrary
  slices of the same list. Now `created_at` is fetched, so they are genuinely
  sorted by views, last 7 days, and item count.

### Goals (`/goals`) — 4 fixed
- Suggested Action navigates to the right place for the goal type.
- "View all" expands the item thumbnails.
- "Share goal" shares/copies name + progress.
- Removed the "..." menu — its actions already exist as buttons below it.

### Activity (`/activity`) — 2 fixed + the feature finished
- "Load more" really pages (20 at a time, shows how many are left).
- Removed the decorative "Filters" button; the real filter tabs sit below it.
- **Wrote the missing `activity_events` migration** (it never existed).
- **Wired the missing write call**: `saveItem()` now logs a real before/after
  "valued" event whenever an item's value changes. That's the one funnel every
  save path goes through, so it captures old value, new value, and source.

### Gallery
- Removed two per-item "Comment" buttons. Comments are exhibition-level only,
  so item comments could never work; one was also a button nested inside a
  link (invalid HTML).

### Garbled text fixed
Seven lines rendered literal junk to users (`â€¹`, `â€º`, `Ã—`, `âŒ•`, `â—`) from
double-encoded characters, on Wishlist and Goals. All gone; the app now scans
clean for this.

---

## Still open

1. **Visual match to the mockups is unverified.** The 10 desktop mockups in
   `C:\Users\EK\.codex\generated_images\019e6d3a-5dd3-7ed1-be13-942347ebb5c9\`
   were reviewed, but the logged-in pages (Vault, Insights, Goals, Capture,
   Home, Exhibitions) can't be viewed without signing in, so how closely each
   matches its design hasn't been checked. Learn is the one confirmed done.

2. **Naming mismatch.** The mockups and nav say **Watchlist**; the route is
   **`/wishlist`**, and a separate `watchlistModel.ts` exists. Pick one name.

3. **No item-level comments.** If you want collectors to comment on individual
   items (not just an exhibition), that's a real feature to build.

4. **Comparable sales** on the Wishlist detail panel needs a pricing source
   before it can show anything.
