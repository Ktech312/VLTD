# Wishlist, Pull List and Following: inventory, source coverage and plan (2026-10-24)

Status: **proposal, nothing built.** Layout examples: `docs/design/wishlist-pull-list-mockup.html` (also published as a private artifact). `/watchlist` and every existing link stay; global navigation is not touched.

## 1. What exists today, and where each piece goes (nothing is deleted or moved without a copy)
Production counts (read only, 2026-10-24): wishlist 4 rows, watchlist 6, comic_wishlist 4, exhibition favourites 0, wishlist share links 0.

| Stored today | Rows | Where it lives in the new design |
|---|---|---|
| `wishlist` table (typed-in wants and comic catalog picks; status Want or Preordered; target price, priority, condition, notes, release date, share link support) | 4 (3 typed in, 1 comic; 3 have a target price, 1 has a release date) | **Wishlist** (and **Pull List** when it has a date). Same rows, new columns added. |
| `comic_wishlist` (older per-login comic Want / Ordered / Own marks; already copied into `wishlist` by the 2026-10-11 migration; still drives the buttons on Upcoming Comics) | 4 | Stays. The Upcoming Comics buttons keep working and write to the same wishlist. |
| `watchlist` table (someone else's public items saved from Discover) | 6 | Shown in Wishlist as **Watching** (a reference to another person's item, never an owned record). Also stays visible on **Saved**. |
| Exhibition bookmarks (`public_favorites`, type gallery) | 0 | **Saved** only, references untouched. Not shown as products. |
| `wishlist_shares` link + `get_shared_wishlist` (public read-only link, no notes, no prices) | 0 links | Kept and extended (section 5). |
| Catalog selections (Metron comic issue ids in `wishlist.external_id`) | 1 | Kept as the source identity for matching and de-duplication. |

Things in the current page that go away: the duplicate filter rows, the 264 px card height, the always-open details panel, the empty value-history and comparable-sales boxes, and the **Price Alerts** tab (the code never marks anything as an active alert; nothing watches prices). A target price stays as a note to yourself.

One existing behaviour that must change: `convertWishlistToVault` copies the **target price into purchase price and current value**. The new Acquired step asks for what was actually paid.

## 2. Release sources: what really exists (verified in the code)
| Area | Connector | What it covers | Access | Refresh |
|---|---|---|---|---|
| Comics, future releases | `/api/comic-upcoming` (Metron) | Issues by store date, publisher, series, creator; series and issue ids; variant flags inferred from issue number patterns | Needs `METRON_USERNAME` / `METRON_PASSWORD` on the server | On demand, up to 10 pages (1,000 issues); no schedule |
| Comics, this week | `/api/comic-releases` | ComicList.com weekly checklist (a scrape of a public page) | none | On demand |
| Comics, reference | `/api/gcd-search` | Grand Comics Database copy in Supabase (English); history, not future releases | public read | loaded by script |
| Comics, crowdfunding / creators | `/api/kickstarter-comics`, `/api/patreon-comics` | Kickstarter's own search JSON; a scrape of Patreon's public search | none; fragile, undocumented | On demand |
| Trading cards | `/api/card-lookup` | Identifies one card (Magic via Scryfall, Pokemon via the Pokemon TCG API). **No release schedule, no product or set feed.** Other games: nothing | none (Pokemon key optional) | On demand |
| Toys, barcodes, books | `/api/upc-lookup` | Looks up one barcode (upcitemdb, 100 calls a day; ISBN for books). **No release feed.** | token | On demand |
| Records | `/api/vinyl-lookup` (Discogs) | Looks up one release | token | On demand |
| Events | scheduled refresh | Not a release feed | n/a | Daily, currently not saving (see the events closeout) |

Result: **only comics can be followed automatically**, through Metron, matched by series id. Card products and toy lines stay manual until a real source is chosen. Candidates, not built and not promised: Scryfall's set list (it includes upcoming sets) and the Pokemon TCG API's set list can supply card set names and dates; nothing equivalent is wired for toys. Nothing here scrapes a restricted service or calls a paid AI.

## 3. Proposed data model (one migration package, to be reviewed before it is run)
- Extend `wishlist`: `quantity`, `quantity_acquired`, `series`, `edition`, `release_window` (text, for "Q1 2027"), `release_date_known` flag (unknown stays null), `source_url`, `shop`, `category_fields` (jsonb: era, maker, set, format), `status` widened to wanted / preordered / acquired / skipped, `skipped_at`, `acquired_item_ids` (the Vault records created), `follow_rule_id`, `source_identity` (e.g. `metron:issue:181794:cover-b`), `updated_by_user` timestamps so a refresh can tell what you edited.
- New `pull_rules`: profile, kind (comic series / card product / toy line), identified source and id, quantity, edition or format preferences, state (following / paused / stopped), last checked, last result.
- Unique key on (profile, source identity, edition) so a refresh can never create copies; skipped rows are kept and never recreated; a changed date updates the existing row only where you have not edited it.
- Share: extend `wishlist_shares` with per-field switches (titles/editions, quantities, dates, prices, notes, shops), all off except titles and editions; revocable by deleting the link, as today.
- No existing row is changed except by adding columns with defaults; the old `status` values stay valid.

## 4. How each requirement will be tested (production, isolated QA owner, plus a clean second browser)
Recurring pulls and series matching on the comics catalog; variant matching (exact edition only, no auto-select of expensive variants); duplicate prevention across repeated refreshes; delayed releases (date moves, edits kept); paused and stopped rules; skipped items staying skipped; quantity changes and partial acquisition (1 of 2); acquisition through the Vault save (marked acquired only after the save succeeds, actual cost required, no duplicate Vault records); sharing privacy (notes and budget never in the public read); offline and retry; persistence in a second clean browser; existing four wishlist rows and six watchlist rows unchanged throughout. Simulated connector tests are kept separate from real calls; no card or toy feed is simulated as real.

## 5. Questions for you before building
1. Does the layout in the mockup match what you want (three views, rows that open in place, Following as rules)?
2. Cards and toys: manual only for now, or should I wire Scryfall and the Pokemon TCG API set lists as a first card source (free, no key required, dates and set names only, not prices or box contents)?
3. Should **Watching** items (other people's public items) show inside Wishlist, or only on Saved?
