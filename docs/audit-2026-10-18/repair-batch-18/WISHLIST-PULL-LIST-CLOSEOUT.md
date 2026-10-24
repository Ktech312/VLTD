# Wishlist, Pull List and Following: closeout (2026-10-24)

Commit `5f78db9` (live), plus a small follow-up for the series line. `/watchlist` and every link to it are unchanged; global navigation is untouched. Verified on production with an isolated QA owner and a clean second browser; the QA account is dropped and production is back to 3,477 vault items.

## What is built
- **Wishlist**: compact rows (about 60 px), one filter row, details open inside the row you click. Manual entry works for every category (collecting area, type, or typed-in), with the fields that only matter for that category shown only then (comics, trading cards, sports, toys, music, games, jewelry, automotive, art, and an "Older or vintage piece" switch that adds era and maker). Unknown dates and prices stay unknown ("Date unknown", "Price unknown"; never today, never $0).
- **Pull List**: wants with a date or window, grouped (date passed, each month, windows) with a total per group.
- **Following**: rules. Comic series are matched to one exact series by the catalog's series id; card products and toy lines are manual rules and say "Manual only". Pause, Resume, Stop (kept, shown under stopped rules), Check now, Edit rule. Variants are offered and never added on their own.
- **Watching**: someone else's public items stay inside Wishlist under a "Watching" heading with their source link and "Add to my wants" (a want of your own; no price copied; the watched item stays; nothing becomes an owned record). Exhibition bookmarks stay on Saved (there are none in the database today).
- **Acquired**: Wanted, Preordered (your own arrangement; the page says VLTD placed no order), Acquired, Skip and Restore (the record is kept). Acquired asks how many copies arrived and what you actually paid, which may stay unknown; it creates Vault records with the known details filled in and marks the want only after those records exist on the device (and are uploaded or queued). Partial quantities show "1 of 2" and stay open. Vault record ids are fixed per want and copy, so a retry cannot create a second record.
- **The bug**: the old Add to Vault copied the target price into purchase price and value. That code was unused after the rebuild and is deleted; a test now fails if anything like it comes back. The target price is a note to yourself and never counts toward totals.
- **Checklist and sharing**: planned total from known prices times copies still to get, with a count of unpriced wants. Print (a print page, black on white), copy as text, download as a file. Sharing is opt-in and revocable; the public link shows titles, pictures, categories and editions; quantities, dates, prices, shops and notes are off until switched on (this switch needs the SQL). Target prices are never shared. No checkout, payments or messages to shops.
- **Offline and retry**: wants saved or removed on the device are remembered until the account confirms them, so a read can no longer drop an offline want or bring back a removed one.
- **Alerts**: the Price Alerts tab is gone. A target price is a note; nothing watches prices, and the page never calls it an alert.

## SQL: one package, not run
[9-wishlist-pull-list.sql](sql/9-wishlist-pull-list.sql), then [validation-9.sql](sql/validation-9.sql). Rollback: [rollback-9.sql](sql/rollback-9.sql). Tested 30 of 30 in a real in-process Postgres on a copy of today's tables (existing rows unchanged, re-run safe, rollback). It adds columns with defaults to the wishlist (quantity, edition, release window, source link, shop, details, skipped/acquired records, rule link, source identity, edited fields, expected price), widens the status to include acquired and skipped, adds one-row-per-release protection, the Following rules table (owner only), and per-field sharing switches.
**Until it runs the page works, but these are kept on this device only**: quantity, edition, expected price, source link, shop, skipped/acquired states, and Following rules. A second browser then sees quantity 1 and the skipped want as wanted. After the SQL runs, the next visit to the page sends them to the account. Title, notes, category, priority, target price, release date, Wanted/Preordered and the watched items already follow the account.
(The events session's package is `8-event-refresh-store.sql`; this one is 9 so the names do not clash.)

## Release sources
See [wishlist-release-sources.md](../../design/wishlist-release-sources.md). Only comics are connected (Metron, needs the server login, 180-day window, variants recognised from the issue number). Assessed live and **not connected**: Scryfall (Magic sets with dates, good candidate), YGOPRODeck (Yu-Gi-Oh, very short lead time), Pokemon TCG API (**deprecated by its owner; keys end 2027-03-01; it returned a server error today; your card scan lookup uses it**), sports cards (no feed; calendars are web pages with their own terms), other card games and toys (nothing found). Manual entry covers all of those.

## Verified (production, then local for the same checks)
RB67, RB67b, RB67c, RB67d: 74 checks on production, 73 pass. The one miss (the second copy) was my check counting Vault records left by my earlier local runs on the same QA account; the records from the production run were right. Eight rows from the earlier local runs were also mistakes in my checks (typed case of a heading, error wording, a want made in one browser and acquired in another) and are all superseded with the reason on record. One of them records a real, disclosed limit (device-only fields before the SQL, above).
- Four examples (comic, card product, toy, older undated piece) added through the real form; planned total $180.97 with 1 unpriced; Pull List groups November, December, Q1 2027; the undated piece stays off it.
- Preordered and Skip are recorded and reversible; skipped stays skipped after reload and drops out of the total.
- Acquired: an invalid cost is refused with nothing saved; 1 of 2 received with the cost left blank saves one Vault record with **no price**; the second copy with 5.25 saves at 5.25; ids are unique; the card product with target 130 and expected 143, acquired with a blank cost, saves with **no price**.
- Following: manual card rule (pause, resume, add a release, stop keeps it and what it added); a real comic series (matched by its catalog key, standard covers only, no variants added); re-checking creates no copies; a skipped release is not brought back; a quantity set by hand is kept; a paused rule offers no Check now.
- Watching, sharing and checklist: a visitor with the link saw titles only (no notes, no prices, no skipped); the printable checklist shows prices and notes only when switched on; turning sharing off stopped the link.
- Offline: a want added offline appeared at once, reached the account after reconnecting (one row); a want removed offline stayed removed after reconnecting; acquiring offline saved to the device Vault and said it would upload.
- Phone: no sideways scrolling at 390 and 320 px on every view, the opened row and the Add sheet; the sheet's buttons can be reached.

## Not done or not verified
- **After the SQL**: persistence in a clean second browser for quantity, edition, price and skipped/acquired, per-field sharing switches, and Following rules in the account. The scripts are ready (`rb67b` checks these automatically once the columns exist); I cannot run the SQL.
- Real-phone taps and swipes (the harness emulates a phone).
- Variant detection is only as good as the catalog's issue numbers; an unlabelled variant looks like a standard cover.

## Decisions for you
1. **Upcoming Comics "Own" button** still records the comic's cover price as what you paid (its older, deliberate design). The new Acquired step never does. Say if Own should stop doing that too.
2. **Pokemon TCG API** is ending; the card scan's Pokemon lookup will stop working after 2027-03-01 unless it moves to another source.
3. Whether to connect **Scryfall** as a second automatic source (Magic sets only).
