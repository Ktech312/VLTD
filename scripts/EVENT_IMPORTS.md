# Collector event imports

These scripts import dated event facts, with source links, into `collector_events`. They never edit Vault items or exhibitions. They require the existing local Supabase environment; do not commit credentials.

## October 7, 2026 batch

- Fresh Comics: all 115 upcoming conventions in the saved source snapshot.
- CardShopMap: dated sports and non-sport card events from its public event sitemap.
- Gbase: music equipment shows from its public calendar and event pages.
- American Orchid Society: show listings, excluding judging-only meetings.
- Organizer supplements: PlantCon, Propstore, Art Basel, Sneaker Con, Windup, ANA, World Money Fair, American Philatelic Society, Gen Con, PAX, Pinball Expo, SEMA and NAMM.

`specialist-events.json` and `specialist-supplement.json` contain only the event facts used by the importer. Missing locations stay unfilled; Gbase records without a country say `Not listed`. Hours, admission, eligibility and cancellations should be checked on the linked organizer site. No event images or long third-party descriptions were copied.

## Review and import

1. Refresh source snapshots/URL inventories before collecting a new dated batch. The checked date and date window in these scripts are deliberately explicit.
2. Run `node scripts/collect-specialist-events.mjs`. Use `--retry` for the saved failure list. Collection caches successfully parsed listings.
3. Run `node scripts/build-specialist-supplement.cjs` after reviewing the organizer dates and orchid-show facts.
4. Run `node scripts/import-specialist-events.cjs` to write a preview with counts and proposed rows.
5. Review the preview, then run the same command with `--apply`. It saves a local database backup, inserts new events, merges universe tags on matched records and verifies inserted slugs. It does not overwrite existing descriptions, images, featured status or enabled status.

Matching uses stable source slugs, or the same date and normalized name/location, or the same date, city and official URL. A repeat application should propose zero new rows. Inspect near-duplicates with differing organizer dates manually.

The Events page reads all upcoming enabled records in pages, filters by universe/type/text, and renders 30 at a time with Show more. Google discovery remains available under Search beyond the catalog.

This is an imported catalog, not a scheduled refresh service. Unreachable source pages are recorded in `specialist-fetch-failures.json` and are not published with guessed dates.
