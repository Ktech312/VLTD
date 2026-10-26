# Where can VLTD get upcoming-release data? Sports cards, card games and toys

Researched 2026-10-26. Every "read on" date below is that day unless stated. This extends the shorter note in [wishlist-release-sources.md](wishlist-release-sources.md) (2026-10-24). Nothing was built, connected, signed up for, paid for or scraped for this. Where a page refused my request or I could not read its terms, I say so instead of guessing.

## Recommendation (short version)

1. **Connect exactly one source first: Scryfall, for Magic: The Gathering sets only.** It is free, needs no signup or key, publishes its rules, gives every set a permanent id and a release date, and today lists 10 sets dated in the future (the next is 2026-11-13). It is the only source I found that is free, official-quality, documented and actually contains future releases.
2. **Everything else stays manual**, which is how the app already treats it: sports cards, Pokemon, Yu-Gi-Oh, Lorcana, One Piece, LEGO, Funko, Hot Toys, Hasbro, Mattel, die-cast. For most of these there is no data feed at all. For a few there is a free feed, but it does not contain future releases, so it would not help Following.
3. **Do not connect anything paid or approval-gated.** TCGplayer is closed to new applications, Cardmarket is closed, Scrydex (the Pokemon API's successor) starts at $29 a month, and the sports-card calendars forbid or do not allow reuse.
4. **Keep manual entry working for every category.** Nothing in this plan removes it. The best cheap improvement for the manual categories is to let the person type in the maker's own item number (LEGO set number, Funko item number, Hot Toys MMS number), so a future connection can match without creating duplicates.

Two things the owner should know that are not about Following: the **Pokemon TCG API that powers VLTD's card-scan lookup is deprecated and its keys stop working on 2027-03-01** (confirmed again today), and **Scryfall's rules forbid putting Scryfall data behind a paywall**, so if Magic set dates are ever shown, free accounts must see them too.

## Comparison table

"Future releases?" means: did the source actually list a release dated after today when I looked.

| Source | Categories | Future releases? | Free? | Key or signup | Can a commercial app store and show it? | Verdict |
|---|---|---|---|---|---|---|
| **Scryfall** | Magic sets (and cards) | Yes: 10 sets, next 2026-11-13, furthest 2027-04-09 | Yes | None; must send a descriptive User-Agent and an Accept header | Yes, with rules: no paywall, no simply republishing the data, must add value, image rules; caching 24 h or more is encouraged | **First connection** |
| **Magic official product page (Wizards)** | Magic products and sets | Yes: 5 upcoming sets listed to Oct 2027 | Yes | None | Page only; no feed found; cite and link, do not copy | Good for a person to read; no feed |
| **YGOPRODeck** | Yu-Gi-Oh! sets and cards | Barely: 1 set (2026-11-12) of 1,035 | Yes | None | Free; asks you to store data locally and not hotlink images; commercial use not addressed | Usable, but too little lead time |
| **Pokemon TCG API (pokemontcg.io)** | Pokemon sets and cards | Unknown; service returned an error today | Free key, but no new keys | Registration closed | Terms not found on the page | **Deprecated, ends 2027-03-01. Do not build on it** |
| **Scrydex** | Pokemon, Magic, Lorcana, One Piece (beta), Gundam, Riftbound (beta) | Not stated | **No: from $29 a month** | Paid account | Terms not read | Paid. Not recommended |
| **TCGdex** | Pokemon sets and cards | None seen: newest set read was already released | Free (project asks for sponsorship) | None found | Database repository is MIT-licensed; API terms not stated on the pages I read | Free option for Pokemon data; does not help with upcoming |
| **Lorcast** | Disney Lorcana sets and cards | **No**: all 26 sets already released | Free | None | Free by Ravensburger policy; cache 24 h; commercial use not addressed | Free, but no future sets today |
| **One Piece (Bandai official page)** | One Piece Card Game products | Yes: dates to Dec 2026 on the page | Page is free to read | None | **Page says its text, images and data may not be reproduced without permission** | Read by a person; no feed |
| **optcgapi.com / apitcg.com** | One Piece (and others) | No release dates | Free (apitcg: 1,000 requests a month) | apitcg: free key; optcgapi: none stated | **Unofficial, no terms shown** | Do not use |
| **Beckett** | Sports (and other) release calendar | Yes, as web pages | Pages free | n/a | **Blocked my automated request with a bot check; terms unreadable by me; no API found** | Manual only |
| **Checklist Insider** | Sports and non-sport release calendar | Yes, as a web page | Page free; free daily/weekly email | None | **Terms: personal, non-commercial viewing only; no copying or mirroring** | Manual only; person may subscribe to the email |
| **Topps, Panini, Upper Deck, Fanatics Collectibles** | Sports cards | Not in any machine-readable form | n/a | n/a | No API or feed found for any of them; Topps and Beckett refused automated page requests | Manual only |
| **TCGplayer API** | Trading card catalog and prices | n/a | n/a | **"No longer granting new API access"** | Terms apply to existing keys only | Closed |
| **Cardmarket API** | Trading card marketplace | n/a | n/a | **"Not accepting applications"**; earlier docs say professional sellers only, manual approval | Credentials may not be shared with third-party software | Closed |
| **Rebrickable API** | LEGO sets, themes, parts | Not verified | Free account and key | Key required; about 1 request a second | **Commercial and caching terms not readable by me** (terms page refused my request) | Possible later; verify terms first |
| **Brickset API** | LEGO sets | Not verified | Key required; individual keys 100 calls a day | Request a key | **Production or commercial use requires contacting Brickset first** | Needs a conversation; not first |
| **LEGO official site** | LEGO "coming soon" listing | Listing exists, no dates or set numbers on the page I read | n/a | n/a | No feed or terms found on the page | Manual only |
| **Funko, Hot Toys, Hasbro Pulse, Mattel Creations** | Vinyl, 1/6 figures, action figures, die-cast | Funko lists "Coming Soon" without dates; the others unreadable or undated | n/a | n/a | No feed or API found at any of them | Manual only |
| **hobbyDB** (aggregator) | Funko, Hot Wheels and more | n/a | n/a | n/a | Its API page returned "402 Payment Required" to me | Unverified; do not assume it is free |
| **MTGJSON** | Magic data files | Not verified | Free (MIT licence) | None | Commercial use allowed; credit required | Backup for Scryfall; no need today |

## How VLTD matches a release today (comics), so the new rules can be concrete

Read from `src/lib/wantsCore.ts`, `src/lib/pullRules.ts` and `src/app/api/comic-upcoming/route.ts`.

- **A Following rule** (`PullRule`) has a kind (`comic_series`, `card_product` or `toy_line`), a name, a source (`metron` or `manual`) and a **source key**. For comics the source key is the catalog's own series id, written `metron:series:<id>`. If the catalog gave no id, it falls back to name plus start year plus publisher, never the name alone.
- **A release** (`CatalogRelease`) has an **identity** that names that exact release in that catalog (`metron:issue:<id>`), a **series key**, a title, an ISO date (YYYY-MM-DD) or none, an image, a yes/no variant flag, and an edition label ("Standard cover" or the variant description).
- **The check** (`planRuleRefresh`) keeps only releases whose series key equals the rule's source key exactly. For each one it looks for an existing want with the same identity. If found it never adds a copy, never undoes the person's edits, never brings back a Skipped release, and only moves the date if the person did not set it by hand. If not found and it is a standard release it adds a want; if it is a variant it only offers it as a suggestion.
- **No duplicates** comes from three layers: the identity check above, a want id worked out from the identity plus a short per-profile prefix (`wantIdForIdentity`), and a database rule of one row per identity per profile (`source_identity` in SQL 9).
- **Variants** for comics are detected only from the issue number pattern (1B, 2nd print, "variant"), so an unlabelled variant looks like a standard cover.
- **Dates** are re-read on every check (at most every 6 hours per rule, or on "Check now") and a changed date updates the existing want.
- **Places that are comic-specific today and would need generalising** for any new source: the wants made from a release are always filed as category "Comics"; the fallback that rebuilds an identity from an old row assumes the form `<source>:issue:<id>`; the rule's source is limited to `metron` or `manual` in the code and in the database (`pull_rules.source` check in SQL 9), so a new source needs a small SQL change that the owner runs by hand. Unknown or non-Metron sources are currently read back as `manual`.

## What the matching key would be for each category

The rule: **a key must come from the source itself and must not contain the release date**, because dates move. Where a source offers no such key, the category stays manual.

| Category | Release identity (one exact release) | Series key (what a rule follows) | Variant or edition | Date |
|---|---|---|---|---|
| Comics (today) | `metron:issue:<id>` | `metron:series:<id>` | Guessed from issue number pattern | Metron store date |
| Magic (Scryfall) | `scryfall:set:<set id>`. The set id is a permanent UUID; the short code (for example `trk`) is readable but I would not use it as the key | A line, for example `scryfall:line:main` (set types expansion and core) or `scryfall:line:commander`; or the parent set code to group a release with its tokens | Scryfall's set type: tokens, promos and masterpiece sets are **suggestions, never auto-added**, exactly like comic variants | `released_at`. One placeholder seen: MagicFest 2027 is dated 2027-01-01 |
| Pokemon (if ever) | `tcgdex:set:<set id>` such as `me05` | `tcgdex:serie:<id>` | Sets have an official abbreviation (for example PBL) | `releaseDate` is on each set's own page, not in the list |
| Yu-Gi-Oh! (if ever) | `ygoprodeck:set:<set code>` such as `MAMS`. No numeric id exists, so a renamed or reused code is a duplicate risk | None; a rule would be "any new Yu-Gi-Oh! TCG set" | None in the data | `tcg_date`, which is empty for 4 of 1,035 sets |
| Lorcana (if ever) | `lorcast:set:<id>` (ids look like `set_...`), code also given | One line: Disney Lorcana | Promo sets are separate sets with their own code | `released_at` and `prereleased_at` |
| One Piece | No external key available; manual only. Printed set code (OP-18, ST-38) is a good value to type in | n/a | n/a | Official page shows dates, not machine-readable |
| Sports cards | No source key exists. A local key `sport + season + maker + product` would be our own invention, and two spellings of one product would create duplicates | n/a | Parallels and inserts do not have a standard key | Calendars say dates are "always subject to change" |
| LEGO | `rebrickable:set:<set number>-<version>` such as `75192-1`; Brickset uses number plus variant | A theme (Rebrickable `theme_id`) | A different set number is a different product (polybags, promos) | Rebrickable's documented list parameters filter by **year**, so exact day dates are not confirmed |
| Funko, Hot Toys, Hasbro, Mattel | Maker item number (Funko item number in the product URL, Hot Toys MMS number, Hasbro or Mattel item number). **No feed exists**, so these only help if the person types them | A line name typed by the person | Chase, exclusive and store variants are only known from the product text | None published in machine-readable form |

## Per-source detail

### Scryfall (Magic: The Gathering sets)
- **Read on:** 2026-10-26. [API overview and use rules](https://scryfall.com/docs/api), [rate limits](https://scryfall.com/docs/api/rate-limits), [sets](https://scryfall.com/docs/api/sets) (the sets page itself refused my page fetch; I confirmed its fields from the live `https://api.scryfall.com/sets` answer).
- **Covers:** Magic only. Today the set list holds 1,062 sets, every one with a release date; 10 are dated after today: Star Trek (2026-11-13) with its Commander, tokens and "Stardates" sets, MagicFest 2027 (2027-01-01), Nauctis: The Sunken Realm (2027-02-05), Marvel: Darkhold Destiny (2027-04-09) with Commander and tokens.
- **Offers:** set id, short code, name, release date, set type, card count, parent set, digital flag, set icon, a TCGplayer id where one exists. Cards and images exist too but are not needed for set dates. It does not list sealed products (Collector Booster box, bundle), only sets.
- **Lead time check:** Wizards' own [products page](https://magic.wizards.com/en/products) (read today) lists Kamigawa: Titanbreach (2027-06-04) and Zhalfir (2027-10-01) which are not in Scryfall yet. Scryfall runs about six months ahead, not a year.
- **Free allowance:** Free. Rate limits: 2 requests a second for card search endpoints, 10 a second for everything else, including `/sets`. Too many requests gets a 429 and a 30-second limit; ignoring 429s can bring a ban. They ask you to cache for at least 24 hours and to use the daily bulk files for mass work.
- **Access:** No key, no signup. Every request must carry an accurate User-Agent (app name and version) and an Accept header. The docs site returned 403 to a generic client and worked once those headers were set.
- **Permitted use:** The page says the data is provided free for creating Magic software and community content under Wizards' Fan Content Policy. Rules: no Scryfall logos or implied endorsement; **no paywalling Scryfall data** (end users must reach it anonymously or with a free account); no using it to create new games; **do not simply repackage, republish or proxy the data; your software must add value**; image rules (do not crop, distort, recolor, watermark; credit artist and copyright when showing art crops). Storing and displaying is allowed with those rules; a 24-hour cache is encouraged. I did not read Wizards' Fan Content Policy itself, so the commercial-use question for a for-profit app is **not fully verified**; Scryfall's own page does not forbid commercial software, but it says "primarily".
- **Reliability:** Long-running, actively maintained, publishes a changelog feed. The most stable of everything assessed.
- **Matching:** see the table above. Auto-add main sets only; offer tokens, promos and masterpiece sets.

### Pokemon TCG API (pokemontcg.io) and its replacements
- **Read on:** 2026-10-26. [Developer docs](https://docs.pokemontcg.io/), [home page](https://pokemontcg.io/).
- **Status:** The docs state the API is deprecated, **existing keys work until 2027-03-01**, new registrations are closed, and recommend moving to Scrydex. My plain request to `api.pokemontcg.io/v2/sets` returned HTTP 500 today (the earlier note recorded a server error too). Version 1 has had no data updates since 2021.
- **Rate limits and terms:** Not stated on the pages; unauthenticated use has "much lower" limits than keyed use. Third-party listings gave numbers; I do not repeat them as fact.
- **Matters for VLTD:** the card scan lookup (`src/lib/cardLookup.ts`, `/api/card-lookup`) uses this API, so it has an end date.
- **[Scrydex](https://scrydex.com/):** The successor covers Pokemon, Lorcana, Magic, Gundam and, in beta, One Piece and Riftbound. Pricing read today: **no free tier; Starter $29 a month for 5,000 credits**, Growth $99, Professional $399. Whether it lists unreleased sets and its terms were not on the page. **Paid, so not recommended.**
- **[TCGdex](https://tcgdex.dev/) (free alternative for Pokemon data, not for upcoming):** Free, open source, 10 languages, REST and GraphQL, GET requests only, HTTPS only. The listing at `api.tcgdex.net/v2/en/sets` had 220 sets; the set list has no dates, each set's own page has `releaseDate` (for example Chaos Rising 2026-05-22, 30th Celebration 2026-09-16). I saw no set dated in the future. The [card database repository](https://github.com/tcgdex/cards-database) is MIT-licensed (about 1,100 stars). Rate limits, API key rules and terms were **not stated** on the pages I read. Useful when the scan lookup needs a Pokemon replacement; not a Following source.
- **Official:** The [Pokemon TCG product gallery](https://www.pokemon.com/us/pokemon-tcg/product-gallery) lists 2026 products with no release dates and no feed or newsletter mention.

### YGOPRODeck (Yu-Gi-Oh!)
- **Read on:** 2026-10-26. [API guide](https://ygoprodeck.com/api-guide/); live list `https://db.ygoprodeck.com/api/v7/cardsets.php`.
- **Covers:** Yu-Gi-Oh! TCG sets and cards. 1,035 sets; one is future-dated (Magnificent Maestros, MAMS, 2026-11-12); four have no date. New sets show up only a few weeks ahead.
- **Offers:** set name, set code, number of cards, TCG date, sometimes an image. No sealed-product list.
- **Free allowance:** Free ("is and always will be completely free"). 20 requests a second; **going over blocks you for one hour**.
- **Access:** None needed.
- **Permitted use:** The guide asks you to download and store all data locally to limit calls (failing to may get your IP blacklisted). **Do not hotlink images**: download and re-host each once. Card text and art belong to 4K Media / Konami. Attribution and commercial use are not addressed.
- **Reliability:** Actively maintained; set list sorted A to Z, no filters on this endpoint.
- **Official:** Konami's [Yu-Gi-Oh! TCG products page](https://www.yugioh-card.com/en/products/) lists categories but no upcoming products or dates, and no feed or newsletter.

### Lorcana and One Piece
- **[Lorcast](https://lorcast.com/docs/api)** (read 2026-10-26; sets list at `api.lorcast.com/v0/sets`). Free community API for Disney Lorcana. Sets have an id, a short code, a name, `released_at` and `prereleased_at`. **All 26 sets are already released** (latest: Hyperia City, 2026-10-16), so it cannot tell anyone what is coming. Limit about 10 requests a second (50 to 100 ms apart), cache for 24 hours, beta but "safe for production". The site states it is expressly prohibited from charging for the content under Ravensburger's Community Code Policy; commercial use by others is not addressed; it is not endorsed by Disney or Ravensburger. The official Lorcana products page refused my request (403), so official dates are **unverified**.
- **One Piece:** No official API. The [official products page](https://en.onepiece-cardgame.com/products/) (read 2026-10-26) lists upcoming products with dates and prices (for example booster OP-18 on 2026-11-20, starter decks ST-37 and ST-38 in December 2026), no RSS, newsletter or API, and states that its images, text and data **may not be reproduced without permission**. A person can read it; the app should not copy it.
- **Unofficial community APIs:** [optcgapi.com](https://optcgapi.com/) (free, no terms shown, no release dates, English cards through OP-15) and [apitcg.com](https://apitcg.com/) (19 games, free key with 1,000 requests a month, no terms or release dates shown, sourced from TCGplayer and others). Both are one-person or small projects with no stated terms. **Not recommended.**

### Sports cards: Beckett, Topps, Panini, Upper Deck, Fanatics
- **Read on:** 2026-10-26.
- **No API or data feed was found for any of them** (searched for developer, API and feed pages for all four manufacturers and Fanatics Collectibles).
- **Beckett:** Publishes a release calendar and per-product articles, for example ["2026-27 Hockey Cards Release Dates, Checklists and Set Information"](https://www.beckett.com/news/2026-27-hockey-cards-release-dates-checklists-and-set-information/). My automated request to its terms page was met by a Cloudflare bot check ("Just a moment... enable JavaScript"); I did not try to get around it. **I could not read Beckett's terms, so I assume reuse is not allowed. Do not scrape it.**
- **Topps:** My request to its terms page returned 403. Terms unread.
- **Panini America:** Its terms page loaded but is a script-driven page with no readable terms text in what I received. Terms unread.
- **Upper Deck:** [upperdeck.com](https://www.upperdeck.com/) shows "Latest Releases" without dates, an email sign-up ("Sign Up for Updates"), and no RSS or API. Its terms URL returned 404 on my guess.
- **[Checklist Insider](https://www.checklistinsider.com/release-calendar):** Release calendar covering baseball, basketball, football, hockey, soccer, golf, racing and more, sorted by date, with "TBA" for unconfirmed. States "Dates are _always_ subject to change", and that some sets are pushed back several times. Daily or weekly email newsletter; no RSS link on the page. Its [terms](https://www.checklistinsider.com/terms) say the material is for **personal, non-commercial viewing only** and may not be copied, mirrored on another server or used for commercial purposes. That rules out feeding it into VLTD.
- **Verdict:** Manual only. The manufacturers move dates with little notice and often announce about a month ahead, so even a perfect feed would be weak. A sanctioned feed would need a licence or partnership.

### TCGplayer and Cardmarket
- **[TCGplayer API](https://docs.tcgplayer.com/docs/getting-started)** (read 2026-10-26): "We are no longer granting new API access at this time." Existing key holders must follow its API terms (usage limits and attributions); the terms themselves were not on the page. **Closed.** Third-party blogs about "alternatives" are vendor marketing; I did not rely on them.
- **[Cardmarket API](https://help.cardmarket.com/en/cardmarket-api)** (read 2026-10-26): "Currently, we are not accepting applications for access to the Cardmarket API." Its older authentication overview (seen via search, not re-read today) said access was for professional sellers with manual approval and forbids passing credentials to third-party software. The docs home page returned HTTP 410 today. **Closed.**

### LEGO: Rebrickable, Brickset, LEGO.com
- **[Rebrickable API](https://rebrickable.com/api/v3/docs/)** (read 2026-10-26): Free account, API key required. About one request a second on average with a small burst allowance; over-limit requests get 429, ignoring them can mean a one-to-two-day IP ban. Lists use pages (default 100, max 1,000). The published interface (swagger file, fetched today) lets the sets list be filtered by theme, year, parts count and search. It states LEGO is a trademark of the LEGO Group; **its API terms, caching rules and commercial-use rules could not be read** (the terms and downloads pages returned 403 to plain requests, and a search found only its general site terms). Whether it lists unannounced or unreleased sets, and whether sets carry a day-level date rather than a year, is **not verified**. Set numbers (for example `75192-1`) are the natural stable key. Rebrickable also points high-volume users to its downloadable files instead of the API.
- **[Brickset API v3](https://brickset.com/article/52666/brickset-web-services)** (read 2026-10-26): Key required. Individual keys are for testing and education and allow **100 getSets calls a day**; **production use, including commercial, requires contacting Brickset first**; it may not be used to build copycat sites. Caching and attribution are not addressed on that page. I did not verify its fields or whether upcoming sets appear. It is not a "plug in and go" source for a commercial app.
- **[LEGO.com "Coming Soon"](https://www.lego.com/en-us/categories/coming-soon)** (read 2026-10-26): Lists products with names and prices; no release dates or set numbers appear on the listing, and no feed or data terms. Manual only.

### Funko, Hot Toys, Hasbro, Mattel (official sites only)
- **Funko** ([new releases](https://funko.com/new-releases), read 2026-10-26): Has Coming Soon, Pre-Order and New Releases sections and a mailing list for new releases, but showed no dates, no labelled SKUs (a number appears at the end of each product address), and mentions no API or feed.
- **Hasbro Pulse** ([hasbropulse.com](https://hasbropulse.com/), read 2026-10-26): Pre-order drops, an app and a paid Premium early-access tier. No dated upcoming list, no feed.
- **Hot Toys** (hottoys.com.hk): The site returned 403 to my request. Official newsletter and announcements exist per search results, but I could not read them. Third-party aggregator pages exist (for example toy-people.com) and are not official. **Unverified.**
- **Mattel Creations** (creations.mattel.com): Returned HTTP 429 (retry in 60 seconds) and I did not retry. **Unverified.**
- **Verdict:** No official feed found for any toy maker. Product newsletters are for people, not for the app. Die-cast (Hot Wheels, Matchbox) is Mattel's; same answer.
- **Aggregator:** [hobbyDB](https://www.hobbydb.com/api) returned HTTP 402 Payment Required for its API page; I could not verify any free access. No other legitimate toy aggregator with a public, reusable feed was found.

### MTGJSON (backup for Magic, optional)
Free daily data files, [MIT licence](https://mtgjson.com/license/) read 2026-10-26: commercial use allowed, copyright notice must be kept. Whether it lists unreleased sets was not stated on its home page. Not needed while Scryfall is available.

## The one practical first connection: Scryfall, Magic sets only

**Why this one.** It is the only free, key-less, documented source with permanent ids, real release dates and real future-dated entries, and it fits the existing structure (a set is a single identified release with a date, like a comic issue). It is a second source behind the same rule type; no new screens are needed beyond choosing a line to follow.

**Exact free limits.** No cost. `/sets` is in the "all other methods" group: 10 requests a second. Search endpoints: 2 a second (not needed). 429 means a 30-second limit and must be respected. Cache at least 24 hours. One request a day for the whole set list is enough; that is about 0.6 MB of data (1,062 sets, measured today) once a day.

**What it would cost in effort (rough, build and verify, not a promise).** One server route that fetches the set list with the required headers and caches it a day; a small converter from a set to the existing release shape (identity, line key, date, edition); a search and pick step for lines; generalising the "Comics" category on created wants; a SQL change to let the `source` value be `scryfall` (the owner runs it by hand, as for SQL 9) and tests that re-checking creates no copies. A day or two of focused work plus the usual verification pass.

**What could go wrong.**
- **Paywall rule:** If Following for Magic is ever limited to paid members, that would break Scryfall's no-paywall rule. Keep it available to free accounts.
- **"Republish" rule:** VLTD must add value (it does, through a person's own list) and must not expose the raw Scryfall list as its own feed. Keep rule checks per signed-in person, not a public data endpoint.
- **Commercial-use wording:** Scryfall's page says data is provided free "primarily" for Magic software and community content under Wizards' Fan Content Policy. I did not read that policy. Confirm it before launch if there is any doubt.
- **Too many "sets":** Tokens, promos and masterpiece sets appear as separate sets and would spam the list. Auto-add main set types only; offer the rest as suggestions (this mirrors comic variants).
- **Placeholder dates:** MagicFest 2027 is dated 2027-01-01, which looks like a placeholder. Show unconfirmed-looking dates as "date may move" and let a changed date update the existing want (the app already does this).
- **Lead time:** Scryfall shows sets about six months out, Wizards' own page about twelve. The Following page must not imply it has found everything.
- **Sets, not products:** Scryfall lists sets, not boxes or bundles. A Magic want created from it is "the set", with the person choosing the format themselves.
- **Rules changing:** The terms could change; headers and the 429 rule are enforced, so the connector must send the proper User-Agent and back off.
- **Wrong game by name:** Names such as "Star Trek" appear in several games; the identity must be the Scryfall set id and the category must be Magic cards, not a text match.

## Pages and tools I could not read, so claims about them are unverified

Beckett (bot challenge), Topps terms (403), Panini terms (no text in the page I received), Upper Deck terms (404), Rebrickable terms and downloads (403), Hot Toys (403), Mattel Creations (429), Disney Lorcana official products (403), Cardmarket API docs (410), hobbyDB API (402), Metron's own docs (blocked by a bot filter, so Metron's limits quoted in the code comments, 20 requests a minute and 100 per page, are not re-verified today), Wizards' Fan Content Policy (not opened), Scrydex terms and rate limits, TCGdex rate limits and terms, YGOPRODeck commercial terms, and whether Rebrickable and Brickset list not-yet-released sets or exact release days.
