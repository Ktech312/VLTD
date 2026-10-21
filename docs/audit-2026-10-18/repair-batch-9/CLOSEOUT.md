# Batch 9 closeout (failed loads shown as empty: RC-21; plain Goals defects: RC-20 part), 2026-10-21

Commits `d5a7ec7`, `3064380`, `1e7c19f`, `b8a2aa6` (production). Scripts in `repair-batch-6/scripts/`: `rb30-failed-loads.cjs` (RB30), `rb31-goals.cjs` (RB31), `rb32-saved-copy.cjs` (RB32), `rb33-search-states.cjs` (RB33). The failure is made by blocking the browser's requests to the data service; QA data only. First-run failures are kept; test mistakes (timing: the pages wait up to 20 s before saying so; CSS capitals; a wrong Search button; a check run before deploy finished) have correction rows ITM-741..744 (and ITM-742 for RB31).

## RC-21: a failed load is never presented as an empty collection (all 26 rows)
Shared pieces already existed (`useCloudRefresh`, `StaleDataNotice`, `LoadErrorCard`); they now cover the remaining pages. Until the account answers, an empty list is "Loading…" and after a failed answer (or 20 s without one) it is "We couldn't load your X just now" with Retry. With saved items on screen the amber "Showing saved data—couldn't refresh" notice appears instead.

| Page | Rows | Check |
|---|---|---|
| Insights `/portfolio` | VLT-434, VLT-437 | RB30-021, RB32-007 |
| Activity, Alerts | VLT-485, VLT-484, ACC-647, ACC-748, ACC-599, ACC-738 | RB30-022, 023 |
| Goals | GIN-067, GIN-069 | RB30-024, RB32-008 |
| Insurance report, Inventory schedule, Weekly report, Printable packet | GIN-193, GIN-196, GIN-197, GIN-188 | RB30-025..028 |
| Vault summary figures (hidden while the load failed and nothing is saved) | VLT-343 | RB30-030 |
| Home | VLT-086 | RB32-009 |
| Discover (plain message, Try again; no raw "Query error") | DIS-086 | RB30-039, 040 |
| Upcoming (initial load and search) | DIS-267, DIS-268 | RB30-037, 038, RB33-004 |
| Watchlist no-match / empty-filter messages | DIS-159, DIS-154 | RB33-005, 006 |
| Clubs: a missing or malformed club says so; a failed read says so | DIS-359, DIS-360, CRW-005, CRW-006 | RB30-033..035 |
| Stream page for an item that is not in the account | ITM-615 | RB30-029, 036 |

Also fixed by the same change: the Alerts feed now reports when a source (follows, comments, own bug reports) could not be read instead of silently contributing nothing.

## RC-20 (part): the plain Goals defects
GIN-001 (a direct visit now counts the account's items, not only what this browser held), GIN-013 (Recent sorts newest first), GIN-029..033 (the row and panel button said "View set" / "Review items" but silently added a wishlist entry: it now says "Add missing to Wishlist", adds once, confirms, and is disabled with an explanation when the goal is complete), GIN-041 (Delete asks first), GIN-237 (View all lists every owned matching item; heading counts owned items), GIN-025 (the panel is labelled "Completed Goals": goals carry no completion date, so "this year" cannot be computed). RB31-030..037, all pass.

**Still open in RC-20 (12 rows): GIN-004, 005, 006, 015, 016, 018 to 023, 026.** They all come from one cause: the goal's type (value, sell, insurance, exhibition, completion) is guessed from words in its name, and a goal stores no type, dollar target or exhibition link, so a "value" goal counts items as dollars and "Bedroom" becomes an Exhibition goal. Fixing that means adding an explicit goal type (and for value goals a dollar target) to the goal, which is a product and schema decision, so it is held for you.
