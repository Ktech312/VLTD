# Batch 11 closeout (Watchlist, Market, Favorites: invented or wrong numbers and broken links: RC-23), 2026-10-21

Commits `0b9a57e` and earlier in the batch. Scripts in `repair-batch-6/scripts/`: `rb35-watchlist-market.cjs` (RB35), `rb36-exhibition-counts.cjs` (RB36); the SQL for the Market's asking price is `repair-batch-6/sql/2-public-view-asking-price.sql` (tested 11 of 11 in a local Postgres; **not applied**). QA rows are temporary and restored; the exhibition layout and item privacy changed for RB36 were put back.

| Row(s) | What changed | Check |
|---|---|---|
| DIS-144, DIS-145 | A wish with only a target shows Current Value "--" (it showed the target x 1.18); a watched item shows Target Price "--" (it showed 86% of its value) | RB35-001, 002 |
| DIS-146, DIS-147 | "Watchlist value" is the sum of the real values of watched items; "Alerts active" and the Price Alerts chip are 0 (no price alert can be set here) | RB35-003 |
| DIS-149 | "Recently added" is newest first across wishlist and watched items | RB35-004 |
| DIS-234, 235, 236 | Market cards name the seller (public name) and link to `/v/<seller profile id>` (they linked to `/v/undefined` and ended in a raw database error) | RB35-005 |
| DIS-238 | The universe pills come from what is really listed and add up to All | RB35-007 |
| DIS-240, 241 | Price sort has no NaN; items with no price sort last in either direction | RB35-008 |
| DIS-233, DIS-242 (partly) | Cards say "asking" or "value" next to the amount, never a bare value as if it were a price; the total adds the amounts shown. **The seller's real asking price needs the public items view to carry it: SQL file 2.** The page reads it as soon as it exists | RB35-006, 009 |
| DIS-213 | Favorites counts what a visitor can see now (counted like Discover), not the number saved when it was favourited | RB36-003 (stale 99 and a private item named only in the room's own list: shows 5) |
| DIS-085 | Discover, when the public item read fails, counts only items the exhibition itself published | RB36-004 |

**Still open in RC-23: DIS-233 and DIS-242** (they need the asking price from the public view: [SQL-RUN-ME.md](../repair-batch-6/SQL-RUN-ME.md), file 2). After you run it I re-run `rb35` (it detects the column and then expects "asking" amounts).
