# Repair batch 5: Vault-card value box (RB10-024) and RC-05

Date: 2026-10-20. Production https://vltd.app, synthetic QA fixture only. No real person was notified: events are plain rows, the fixture profile has 0 followers, and `exhibition_events` holds 0 rows in the account (nothing can write to it today). Nothing was sent anywhere, so there is no "simulated delivery" to distinguish; the Announce / publish checks exercise the refusal, not delivery.

## 1. Vault-card value box (RB10-024): done and verified
- **Reproduced before** (`evidence/rb11-card-first-before.json`): `abc` saved 0, `1e3` saved 13, `1,5` saved 15, `-40` saved, and typing 0 on an item with no value yet did nothing (it was compared with a hidden 0).
- **Fix** `37081c7`: the box uses the strict shared parser; refusal shows a message under the box and nothing is saved; blank leaves the value alone; an explicit 0 is saved (also on an unvalued item); the box starts blank when there is no value.
- **After on production:** 9 of 9 (RB11-001 to RB11-009): each bad input refused with a visible message and the value unchanged; `$250.50` saved; shown after reload and in a clean second browser (first card $251, second card $0).
- **Other callers of the same obsolete parser:** that function was local to the Vault list file and had exactly one caller (this box). An identical copy exists in the spreadsheet text-import screen (`src/app/vault/import/TextImportClient.tsx`, `parseMoney`). Other lenient parsers of a different shape exist in AI-draft review, auction bidding, the watchlist target and the import parsers. **Not touched** (no new audit).

## 2. RC-05: status table (three separate sections)

### A. Shipped code (verified on production)
| Defect | Reproduced before | Fix commit | After on production |
|---|---|---|---|
| Alias edits not persisting (EXH-165) | alias on + name typed: database `alias_enabled=false`; a clean browser shows it off (RB12 before) | `525438b` | saved by itself, clean browser shows it (RB12-017, RB12-019) |
| Exhibition display style (shelf style) not persisting (EXH-123, 124, 126, 127) | button "Shelf: Glass", database unchanged (no `shelfOverlayStyle`); reload in the same tab shows Glass from a local copy, a clean browser shows None | `525438b` | database holds "glass"; clean browser shows Glass (RB12-018, RB12-019) |
| Announce reports success after a refused write (EXH-179) | button "✓ Announced", 0 rows | `525438b`, `5c79c31` | never "✓ Announced" without a row: a message "Not announced: your followers were not told..." stays next to the button until the next action (RB12-020) |
| Make public reports success after a refused write (EXH-161) | "Exhibition published!" with 0 notice rows | `525438b`, `5c79c31`, `3ff509e` | the exhibition is public and the page says "Published, but followers were not notified..." (one accurate message; recorded before the page reports anything) (RB12-021) |
| Discover shows the real collector under an alias (found while inspecting; same family, not one of the five) | "by QA Real Collector Name" on the card of an alias exhibition | `d1b6293` | "by QA Alias Curator"; the real profile is not even looked up for it; an exhibition without an alias still shows the real name (RB13-001, RB13-002) |

Notes: "Exhibition display style" here means the shelf-style button (None / Glass / Metal) of the builder; nothing about the removed Shelf/Museum Vault views was touched. Three first-run RB12 rows (RB12-006, 007, 014) and RB13-003 were my own mistakes or a wrong expectation and are explained by rows RB12-022 and RB13-004; the 2.2-second disappearing message and the half-second transient success line were real defects in my first versions of the fix, now fixed.

### B. Migration-blocked (held for review; **revision 2 of the SQL package**, nothing applied)
| Defect | Why it is blocked | Held SQL (staged order in `MIGRATION-PROPOSAL-RC05.md`) |
|---|---|---|
| Follower notice (Announce, publish) refused by the account (EXH-179 / EXH-161 underlying cause) | the old insert rule is still live (`20260823_fix_exhibition_events_team_check.sql` never applied) | stage 1: `sql/1-events-authorization-and-privacy.sql` (membership AND exhibition-belongs-to-profile; one transaction) |
| Events of alias / private / guest-only / draft exhibitions would be readable by everyone once they can be written (required protection, no longer optional) | read rule is "everyone"; every row carries the profile id and exhibition id | same file: read limited to public no-alias exhibitions, judged at read time, so setting an exhibition Private hides its earlier events; members keep reading their own |
| Public exhibition row returns the real profile id when an alias hides the collector (EXH-281), plus visitor keys, curator notes and unfiltered layout JSON | public read rule and column grants return every column; share/invite functions return whole rows | stage 2: `sql/2-public-galleries-view-and-link-sanitising.sql` (allowlist view, sanitised link rows); stage 3: site change (no SQL); stage 4: `sql/4-restrict-galleries-table-read.sql` (rewrites the items rule first, then closes the table read) |
Plus `sql/0-inspect-read-only.sql` (run first), `sql/validation-queries.sql`, `sql/rollback-1.sql`, `rollback-2.sql`, `rollback-4.sql`. Production rows: RB12-015 and RB12-016 (BLOCKED). **Local validation: 76 of 76** (`evidence/rc05-sql-local-postgres.log`): visitor, unrelated account, member, other profile's member; public / alias / private / guest-only / draft / deleted exhibitions; a cross-account event; event visibility flipping with the exhibition's state; a hostile row; guards, order violations, double runs and the three rollbacks. Revision 1 of the package (an optional events file and a two-file view) is superseded.

### C. Unresolved product limitations / findings (not fixed)
1. An alias hides the curator's name and avatar on that exhibition only. It gives **no anonymity** against matching shared items, photos or descriptions across exhibitions or with the real vault.
2. The collector's public profile page (`/v/[profileId]`) and the curator pop-up list **no exhibitions at all** in production: their query asks for columns that do not exist (`galleries.analytics`, `galleries.sections`, error 42703), so they return an empty list (`evidence/profile-page-gallery-query-probe.json`). Not requested, not fixed; if it is ever fixed it must hide alias exhibitions (RB13-005).
3. The follower feed has no alias guard of its own: after the held stage 1 an alias exhibition's events are unreadable by followers, so the feed never sees them (no code guard is needed, and a feed-only guard would not have been enough).

### D. Other lenient money parsers: separate findings, NOT repaired (code reading only; rows RB15-001 to RB15-005)
1. Pasted-text import (`src/app/vault/import/TextImportClient.tsx` `parseMoney`): identical to the rule removed from the Vault card: '1e3' becomes 13, '1,5' becomes 15, a negative is accepted, letters become blank.
2. AI-draft review (`src/app/ai/review/page.tsx` lines 138-139, 170-171): deletes non-digits, so '-5' becomes 5, '1e3' 13, '1,5' 15, and an explicit 0 becomes unknown (`|| undefined`).
3. Auction bid box (`src/app/auction/[id]/page.tsx` `handleBid`): '-5' becomes 5, '1e3' 13 (the minimum-bid check still applies; server-side checking not examined).
4. Wishlist target price (`src/app/watchlist/page.tsx` `saveTarget`): '-5' becomes 5, '1e3' 13, '1,5' 15.
5. Spreadsheet import cleaning (eBay / Whatnot / `costInput.typedAmount`) is intentionally lenient and documented; `pricingMvp.parsePriceInput` has no caller left.
This batch was not widened to repair them.

## 3. QA cleanup (exact)
Fixture `rb11` dropped by manifest ids (items, exhibitions, profiles, auth users all 0); the QA exhibitions, the temporary public-profile row and the profile flags set for the Discover check were removed or restored by the scripts and rechecked. After 20 s: `vault_items` 3,477 / `profiles` 39 / exhibitions 47 / `sales` 3, `exhibition_events` 0; leftovers 0 (items `QA RB9`/`RB10`/`RB11`, exhibitions `QA RB12`/`RB13`, public-profile row "QA Real…", `qa_vz_` ids, `qa_sale_` rows, QA profiles, QA auth users). Scratch service-key helper, manifest and temp pictures deleted (never committed); 26 `Temp\qa-c` folders deleted, `C:\qa-chrome` untouched (66 entries), no audit process running. The local-Postgres dependency (`@electric-sql/pglite`) was installed in the session scratch folder only, not in the project.

## 4. Evidence and screenshots
Rows `RB11-001..009`, `RB12-001..022`, `RB13-001..005` in `rows.jsonl` (first-run rows kept). Exact local screenshot paths: `evidence/batch5-screenshots.txt` (folder `C:\Users\EK\VLTD\.claude\worktrees\quizzical-hamilton-a45b28\docs\audit-2026-10-18\shots\`, gitignored). Scripts: `scripts/rb11-card-value.cjs`, `rb12-rc05.cjs`, `rb13-alias-display.cjs`, `test-rc05-sql-in-postgres.cjs`, corrections `rb12-corrections.cjs`.

## 5. Master status
RC-05 is **PARTLY CLOSED**: EXH-165, EXH-123, EXH-124, EXH-126, EXH-127 closed; EXH-179 and EXH-161 have honest reporting but their notices cannot be recorded until the migration; EXH-281 open (migration-blocked). Nothing else was touched; Insurance, RC-14 and RC-31 stay open. Tutorials remain paused. No RC-05 migration has been run.
