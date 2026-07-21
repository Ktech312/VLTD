# Events page — punch-list (`src/app/events/page.tsx`)

Read-only review, no changes made. The page is a strong visual build and already
uses line-icons (not emoji). But several things "look done" and aren't wired.
Grouped by type, with rough effort.

## A. Dead controls — visual only, no behavior (make them work OR hide them)
1. **Featured hero carousel arrows** (‹ ›) — no `onClick`, no carousel logic. Either
   wire them to page through featured/upcoming events, or remove. *(small)*
2. **Mini-calendar prev/next arrows** — static; don't change month. Wire month
   navigation or remove the arrows. *(small)*
3. **Filter buttons "All Universes / All Locations / Date Range"** — purely
   decorative; they don't filter anything. Only the Event-Type dropdown filters.
   Wire them (universe from `relevant_universes`, location from city/state, a real
   date-range) or remove them. *(medium)*
4. **"Saved Events" button** in the filter row — no `onClick` (the count badge does
   work). Wire it to show the saved list. *(small)*
5. **"View all" / "Manage Saved Events" / "View All Events"** — dead links. Wire or
   remove. *(small)*

## B. Fake/placeholder data shown as real
6. **"At a glance" stats** ("130K+ attendees / 350+ exhibitors") — hard-coded per
   *category* in `statFor()`, not real per-event data. Every convention shows the
   same numbers. Add real fields to `collector_events` or drop the stat tiles. *(medium)*
7. **"Why collectors go"** (Exclusive releases / Signings / Vintage finds) —
   identical hard-coded text on every event. Make per-event or remove. *(small)*
8. **5 "fallback preview" events** render when the `collector_events` table is empty
   or errors (SDCC, Dallas Card Show, etc.). A tester with an empty table sees fake
   events. Replace with a real empty state, or ensure the table is seeded. *(small)*

## C. Data model
9. **Category is guessed from keywords** (`categoryFor()`) because `collector_events`
   has no category column — only geography (`event_type`: local/national/intl). An
   event can be mislabeled. Add a real `category` column (convention/card_show/
   auction/drop/gallery/music) so labels are accurate. *(migration + admin field)*
10. **Saved events are localStorage-only** (`vltd_saved_event_ids_v1`) — per-device,
    don't follow the user across devices. Move to a server table like the other
    lists (goals/wishlist/watchlist). *(migration + model, mirrors existing pattern)*

## D. Works well — leave alone
- **SerpApi event search** (`/api/events/search`) is functional.
- **Event-Type dropdown** filter works.
- **Save toggles** persist (locally).
- Visual design + lucide line-icons are on-theme.

## Suggested order
1. Wire-or-hide the dead controls (A) — quick, removes the "broken" feel for testers.
2. Real stats + category column (B6, C9) — needs a small schema addition.
3. Saved-events backend (C10) — one table, mirrors the goals/wishlist pattern.
