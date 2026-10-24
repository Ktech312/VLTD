# Release sources for Following: coverage, access and limits (assessed 2026-10-24)

Rule applied: a source is connected only when it is a documented, public interface that identifies releases exactly, and only for what it really covers. Nothing here scrapes a restricted service, calls a paid AI, or guesses a release. Everything else is manual entry. **Today only comics are connected.**

## Connected today
| Source | Covers | Identity | Access | Refresh in VLTD | Limits |
|---|---|---|---|---|---|
| Comic catalog (Metron, via `/api/comic-upcoming`) | Upcoming comic issues by store date, publisher, series; covers | Issue id and series id (`metron:issue:<id>`, `metron:series:<id>`), verified present in the live answer on 2026-10-24 | Server needs the Metron login (`METRON_USERNAME`, `METRON_PASSWORD`); the rule check runs from the person's browser through that route | When the Watchlist opens (at most every 6 hours per rule), and on "Check now" | Only series with an announced issue in the next 180 days can be found; variants are recognised only from the issue number pattern (1B, 2nd print, "variant"), so an unlabelled variant looks like a standard cover; dates move and are re-read on every check |

## Assessed, not connected (nothing was added to the app for these)
Checked read-only on 2026-10-24 with plain requests and published documentation.

| Source | What it offers | Verified today | Access and terms | Verdict |
|---|---|---|---|---|
| **Scryfall** (Magic: The Gathering) | `GET /sets` lists every set with `released_at`, `set_type`, `card_count`; unreleased sets are included | 1,062 sets; 10 with a date after today (for example 2026-11-13 and 2027-02-05 releases) | Keyless. Requests must send a descriptive `User-Agent` and an `Accept` header and stay near 10 requests a second (their stated guidance; their docs site refused my page fetch, so confirm the wording on scryfall.com/docs/api before building) | **Good first card source for Magic only.** Gives set name and date, not prices or box contents. Cache the set list for a day |
| **YGOPRODeck** (Yu-Gi-Oh!) | `cardsets.php` lists sets with `tcg_date` | 1,035 sets; only 1 with a future date (a set about three weeks out) | Keyless; 20 requests a second, a one-hour block if exceeded; asks that data be stored locally | Usable for Yu-Gi-Oh only, with short lead time. Sets appear late, so it would miss most future releases |
| **Pokemon TCG API** (pokemontcg.io) | Sets with `releaseDate` (USA date) | **The service is marked deprecated by its own docs: no new keys, existing keys work until 2027-03-01, and it points to a paid successor (Scrydex).** My plain request returned a server error today | Free key (rate limits 1,000 a day without a key, 20,000 with one, per third-party listings) | **Do not build on it.** Also note: VLTD's existing card scan lookup (`/api/card-lookup`) uses this API for Pokemon, so it has an end date to plan for |
| **Sports cards** (Topps, Panini, Upper Deck, Leaf) | None found: no official API or data feed. Release calendars are web pages (Beckett, Checklist Insider, others) | Both calendars say dates change often and are confirmed only weeks ahead | Page content is covered by each site's terms; no licence found | **Manual only.** A sanctioned feed would need a licence or partnership with a calendar operator. VLTD will not scrape these pages |
| **Other card games** (Lorcana, One Piece, Digimon, Flesh and Blood, and so on) | No documented public set-release feed found | n/a | n/a | Manual only. Two trading-card games must not stand in for "card collecting" |
| **Toys and figures** (any brand) | No public release API found. Barcode lookup (`/api/upc-lookup`) identifies a product you already hold, not future releases | n/a | upcitemdb free tier is 100 lookups a day, account wide | Manual only |
| Existing but not release feeds | ComicList weekly checklist (`/api/comic-releases`, a scrape of a public page), Kickstarter and Patreon search (undocumented endpoints and scraping), Grand Comics Database copy (history), Discogs and PSA lookups | n/a | Fragile or terms-dependent | Not used for Following; kept as they are |

## What the page does with this
- A **comic series** rule is matched to one exact series by the catalog's series id, adds standard covers as they are announced, offers variants without adding them, and moves a changed date onto the existing selection.
- A **card product** or **toy line** rule is a **manual rule**: it keeps quantity and format preferences together, and the page says "Manual only: no release feed for this yet". It never claims to check for new releases.
- If Scryfall is chosen later, it would be a second automatic source for Magic sets only, behind the same rule type, with the same exact-identity and no-copies rules.
