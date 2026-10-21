# Batch 13 closeout (links that lead somewhere real: RC-24; buttons that do what they say: RC-26), 2026-10-21

Commits `3e9b484`, `849753f`, `5e6354f`, `ce87bf8`. Scripts in `repair-batch-6/scripts/`: `rb39-links-labels.cjs` (RB39), `rb40-recheck.cjs` (RB40), `rb41-labels.cjs` (RB41). The first runs of RB39 had two test problems (a sort order saved by earlier runs counted as a filter; the Watchlist message was read after its toast had gone). Those first-run failures are kept and superseded by correction rows; RB40 re-checks them against production.

## RC-24: 15 of 16 rows closed
| Row(s) | What changed | Check |
|---|---|---|
| VLT-364, VLT-366 | The Insights breakdown is headed by what its rows are (categories) and each row opens the Vault searched for that category (the rows opened an empty page titled "Misc") | RB39 |
| VLT-368 | "View all movers" opens the Vault sorted by gain | RB39 |
| VLT-377, VLT-378 | "View all" and the dashed "+ Add note" tile lead to a real list (both opened the plain Vault) | RB39 |
| VLT-409 | A universe page opens on the whole universe, not only the last 30 days | RB39 |
| VLT-228, VLT-420 | An unknown universe says "not found" (it showed Misc) | RB39 |
| VLT-273, VLT-274, VLT-275 | An empty universe page says "Nothing in this universe yet" with a way to add or go back, whatever sort order is saved | RB39, RB40 |
| VLT-422, VLT-428, GIN-146, GIN-152 | "Open Exhibitions" opens Exhibitions (it opened the plain Vault) | RB39, RB41 |

**Open: VLT-385** (Insights Goals widget reads "9 of 2,000" for a collection-value goal). It is the same root as the Goals decision in RC-20: a goal needs an explicit type (count vs value) before a figure can be right. Decision for you.

## RC-26: 19 of 24 rows closed (17 here, ACC-808 and ACC-817 under RC-28)
| Row(s) | What changed | Check |
|---|---|---|
| EXH-027 | "View public page" opens the public page | RB39 |
| EXH-028 | "Duplicate" makes a private copy (same items and layout, new link); it respects the exhibition limit | RB39 |
| EXH-029 | The third button used to say "Export PDF" and opened the editor; it now says "Open editor" | RB41 |
| DIS-170 | A target price that is not an amount is refused with a message and the old target is kept | RB40 |
| DIS-176 | "+ Add to Vault" on a watched item opens Add Item | RB41 |
| DIS-198, DIS-203 | The Flip links open the deck (`/discover?flip=1`) | RB39 |
| ITM-243, ITM-625 | "Add to Insurance" is now "Insurance Documents" (it opens the document export) | RB41 |
| ACC-460, ACC-706 | Sign out everywhere asks first and stays put on Cancel | RB39 |
| ACC-868, CRW-010 | `/auth/confirmed` without a link no longer says the email is confirmed | RB39 |
| ADD-199 | "Unlock All" is now "Clear Unlocked Fields" (it clears the fields that are not locked) | RB41 |
| ITM-220 | The Share panel says nobody else can open the link when the profile is private | RB41 |
| ACC-359, ACC-403 | "View public profile" is only offered when the profile is public | RB39 |

**Open (decisions or product rules, nothing guessed):**
- **DIS-166**: the Watchlist "+ Add Watch" tile goes to Add Item. A real "watch" picker is a new feature.
- **ACC-375, ACC-441, ACC-721**: the "Universes displayed" preference says it controls home, Vault and Discover, and does not. Either it should filter those pages, or the setting should be relabelled. Decision for you.
- **VLT-073**: the seasonal-theme banner's "Yes" changes nothing visible (the seasonal look is already applied before the choice). Decision for you: apply the theme only after Yes, or drop the question.
