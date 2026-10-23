# Navigation: desktop header, More menu and Discover sections (2026-10-23)

**Deployed commit:** `e1b6285` (live on production). Verified on production by RB66 run 2 (26 of 26) with an isolated QA owner and a visitor; fixture dropped, vault items back to 3,477. Screenshots: `docs/audit-2026-10-18/shots/rb66-run2-*.jpg` (more-menu, each journey's destination, phone-home, phone-discover). Evidence: `repair-batch-6/evidence/rb66-run2.json`; first run kept as `rb66-run1.json`.

## What the desktop header is now
**Home · Vault · Exhibitions · Insights · More**, and **More** holds **Discover · Events · VLT Lounge · Activity · Learn** (each with a one-line description; Activity is left out for a visitor because it needs an account). The Browse menu is removed. Insights is a direct link at its existing URL (`/portfolio`) and also stays in the Vault bar. More is highlighted on Discover, Marketplace, Upcoming Comics, Events, VLT Lounge (and its topics), Activity and Learn; Saved and Watchlist highlight nothing. Marketplace and Upcoming Comics now have a "Discover" back button beside their titles (they used to share the Browse menu).

**Phone:** the bottom bar is unchanged (Home, Vault, Exhibitions, Lounge, Discover). Every More destination is still reachable on a phone: Events, Marketplace, Upcoming Comics and the Saved/Watchlist shortcuts are on Discover; Insights is in the Vault bar; Learn is in the Lounge bar; Activity is on Home.

**Left where it was:** Vault (Items, For Sale, Sold, Goals, Insurance), Quick Add / Add Item / Scan controls, Account (Profile, Settings, Security, Billing, Workspace/Team), notification and message icons, Help, Import & Export. Saved and Watchlist stay in the Account menu and now also sit as visible buttons beside Discover's search (signed-in people only). Command Center was not restored.

## Discover (public content only), in this order
1. **Collector Spotlight**: one section. The old second "Featured Rooms" block is gone; each slide now shows a few of that room's own public items.
2. **Trending Exhibitions** and 3. **New This Week** (appears only when something was created this week); neither repeats the five spotlight rooms.
4. **Notable Items**: real public items (photo, title, published value, "in <exhibition> by <collector>"), most valuable published value first; each opens its public room. Hidden items, items without a photo, and anything the owner paid are never shown.
5. **Across Every Universe** (unchanged).
6. **Marketplace**: four current listings and a labelled "Open Marketplace" button.
7. **Events**: the next four events, read with the same query, filter and order as the Events page (shared code), with "See all events".
8. **Upcoming Comics**: the next releases, one per series, with "Open Upcoming Comics".

## Journeys from Home (clicks counted, labels checked)
| Journey | Clicks | Where it ends / what it says |
|---|---|---|
| Find an item | 2 (header search, Enter) | Vault filtered to that item |
| Add an item | 1 | "Add Item" opens the capture screen; "Quick Add" opens Quick Add |
| Sell one | 3 | Vault, Gallery view, **Sell** asks for the sale price. Or Vault, For Sale, **Mark sold** (3) asks "Sale price:". Both were cancelled; nothing sold |
| Open Insurance | 2 | Vault, Insurance (Vault stays highlighted) |
| Check Insights | 1 | Insights highlighted |
| Find an event | 2 | More, Events (More highlighted) |
| Return to Saved | 2 | Account menu, Saved |
| Saved or Watchlist from Discover | 3 | More, Discover, the Saved or Watchlist button beside the search |
Direct URLs for 17 pages, active states, and browser Back (Events, Insights, Home) all pass; the phone bar and phone reach pass; a visitor sees public items only, each opening a public room, no personal shortcuts.

## Things to know
- **Selling from the Vault's default Wall view has no sell control.** Sell is on the Gallery view cards; the item page has "Mark for sale"; the For Sale page has "Mark sold". I did not change this. A one-line decision for you if you want Sell on Wall cards.
- **Card releases do not exist.** Upcoming Comics uses the comic release calendar (Metron); there is no data source or page for trading-card release schedules (the card lookup only identifies a single card). The Discover section is therefore titled **Upcoming Comics** only, and no card claim is made anywhere. Building a card feed needs a source decision first.
- **Pages with no link from anywhere in the app today** (pre-existing, untouched): Collector's Shop (`/shop`), Styles (`/styles`), Kickstarter comics (`/kickstarter`), Patreon comics (`/patreon`), `/collector`. These are the only unplaced items I found.
- Check mistakes recorded and superseded (not app failures): the first runs pressed Enter without a key character, looked for Sell on the Wall view, counted the floating Add Item links as phone tabs, and clicked Insights 2.5 s after load; the Back check failed once for that last reason and passes with a 3 s wait. The cause of that one failure was not isolated further.
- **Not done:** a real-phone swipe/scroll/tap check of the new Discover and header (the harness emulates a phone; your own phone check is still the real test).
