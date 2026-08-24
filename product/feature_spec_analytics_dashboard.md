# VLTD — Feature Spec: Cross-Category Analytics Dashboard
## Version 1.0 | Based on competitive analysis of 61 competitor screenshots

---

## THE GAP THIS FILLS

Every analytics tool in the collector app space is single-category. Card Pilot shows you card portfolio analytics. ETR shows MTG price movement. Zap-Kapow shows comic collection value. Strooply shows eBay resale profit.

Not one of them shows you: "Your total collection across comics, cards, toys, and vinyl is worth $48,200. Comics are up 14% this year. Your top appreciating item is a CGC 9.8 Amazing Spider-Man #300."

That number doesn't exist anywhere right now for collectors who own more than one type of thing. That's most serious collectors.

VLTD is the only app positioned to show it — because VLTD is the only app that holds all of it.

---

## WHAT COMPETITORS DO — OBSERVED DIRECTLY

**Card Pilot's dashboard** is the most complete I reviewed across all 61 screenshots. In a single view it shows simultaneously:
- Collection Value ($18,420) with an upward green line graph
- Today's Sales ($385) as a bar chart
- Monthly Profit (+$1,247) with a trend line
- Cards in Inventory (2,134) as a pie chart broken down by sport
- Recent Sales as a scrollable list
- Top Categories as a horizontal bar chart
- A Daily Plan checklist (Check Inventory, Update Prices, New Cards, Grow Collection)

The problem: it's cards only. The intelligence is real; the scope is too narrow.

**ETR's Portfolio tab** shows each card with current price and % change (green/red arrows). The glanceable price movement on every item in the grid is the right pattern — you shouldn't have to tap into an item to see if it moved.

**Zap-Kapow Comics** shows Net Change in dollars over 45 days, full collection value ($166,419.31), and set completion as a progress bar. The 45-day net change is a useful time window — short enough to feel current, long enough to show a trend.

**CardPredict** shows a live RISERS/DROPPERS feed — specific items with % change and confidence scores. This is market intelligence layered on top of collection data.

**What nobody does:** A dashboard that crosses categories. Nobody shows one chart with Comics + Cards + Toys + Vinyl in the same view. That's VLTD's entire opportunity here.

---

## THE VLTD ANALYTICS DASHBOARD — HOW IT SHOULD WORK

### The One Number

The most important element on the analytics dashboard is the single vault value. One number. Total current market value of everything in the vault across all categories.

This number should be:
- At the top of the screen
- Large
- Updated every time the user opens the dashboard (or pulls to refresh)
- Accompanied by a net change indicator: +$1,240 this month (green) or -$320 this month (red)

Every other element on the dashboard flows from this number.

### The Six Panels

**Panel 1: Vault Value Over Time**
A line graph showing total vault value over the last 30/90/365 days (user toggles the window). Single line. The collector's vault value as it has grown (or dipped) over time. This is the most satisfying thing a collector can look at.

Design reference: Card Pilot's style — clean upward green line against a dark background. Simple, not cluttered.

**Panel 2: Category Breakdown**
A horizontal bar chart (or donut chart — test both) showing what percentage of total vault value each category represents.

Example:
- Comics: 41% — $19,762
- Trading Cards: 29% — $13,978
- Toys: 18% — $8,676
- Vinyl: 12% — $5,784

This answers: "What kind of collector am I, by dollar value?"

**Panel 3: Top Movers**
Two sections: biggest gains and biggest drops in the last 30 days.

Format per item: thumbnail, name, value change in dollars (+$340), % change (+12.4%), small green/red indicator.

Limited to 3-5 items per section. This is a scan, not a list.

Design reference: CardPredict's RISERS/DROPPERS section is the right model. This should be glanceable in 5 seconds.

**Panel 4: Your Top Items by Value**
A ranked list of the 5-10 most valuable items in the vault. Not the most appreciated — the most valuable. This answers: "What are my crown jewels?"

Format: rank number, item thumbnail, name, current value, % of total vault.

**Panel 5: Recent Activity**
What's happened in the vault recently. Items added, items sold, notable value changes. This is the vault's activity log in summary form — 5-7 entries, each with a timestamp.

This is not on every dashboard in the competitor set. Strooply has it for sales. VLTD should have it for everything vault-related: "Added Amazing Spider-Man #300 (CGC 9.8) · 2 days ago — current value $1,240"

**Panel 6: Insights (Phase 2)**
Single-sentence intelligence generated from the vault data. Examples:

"Your comics have outperformed your cards by 8% this year."
"You haven't added anything in 23 days."
"Your vault passed $25,000 for the first time."
"The Pokémon cards you added last month are up 11%."

These are light-touch, conversational. They appear one at a time, not as a list. Think notification-level insights, not a report.

---

## WHAT THE DASHBOARD DOES NOT DO

It does not try to be a full stock market terminal. The goal is clarity, not complexity. A collector should be able to look at this dashboard for 15 seconds and understand their vault's health.

It does not show individual item price history by default. That's on the item detail view. The dashboard is the 30,000-foot view. Drill-down is for the item view.

It does not show real-time pricing feeds. It updates when the user opens the app or pulls to refresh. Live streaming prices add complexity and server cost with minimal collector value. The exception: the Top Movers section should be as fresh as possible on load.

---

## TECHNICAL NOTES

**Pricing data by category:**

Comics (raw):
- No single authoritative real-time source. Options: ComicsPriceGuide (has API), MyComicShop, or eBay recent sold listings via the Finding API (free tier)

Comics (graded/slabs):
- CGC census is public. eBay sold listings are the best price reference.

Trading Cards:
- TCGPlayer API (free for non-commercial, paid for commercial use) — most authoritative for trading cards
- eBay sold listings as fallback

Toys:
- No authoritative single source — eBay sold listings are the primary reference
- Toyzie uses their own pricing model (likely eBay-trained)
- For VLTD: eBay Finding API, filter by completed listings, return price range for similar items

Vinyl:
- Discogs API — free, excellent data quality, covers almost everything
- Returns current marketplace listings and price history

Graded items (all categories):
- PSA: PSA Population Report is public, price data via eBay sold
- CGC: CGC census is public, price data via eBay sold
- For both: cert number in vault → look up grade + population → cross with eBay sold data

**eBay Finding API:**
- Free developer tier
- Returns completed (sold) listings with price, date, condition
- Works for any category
- Best cross-category solution while building category-specific integrations

**Data refresh strategy:**
- Pull pricing on app open (not continuous)
- Cache results for 24 hours per item
- Allow manual refresh from dashboard
- Priority: high-value items refresh first

**Dashboard architecture:**
- Vault value calculation: sum of (current market value × qty) for all items with a known market value
- Items without market data: show as "no data" in the total, don't omit them
- Historical value: store vault total daily — this enables the value-over-time graph

---

## PHASED ROLLOUT

**Phase 1 (MVP Dashboard):**
- Vault Value total (based on purchase price if no market data yet)
- Category breakdown (count-based if no pricing, value-based when pricing exists)
- Items added recently

**Phase 2 (Live Market Data):**
- Add eBay Finding API for pricing
- Add Discogs API for vinyl
- Vault value becomes market-based, not cost-based
- Enable value-over-time graph (requires storing daily snapshots)

**Phase 3 (Intelligence):**
- Top Movers panel (requires historical price data per item)
- Insights (requires enough data history to generate meaningful comparisons)
- Cross-category comparison charts

---

## SUCCESS METRICS

- % of daily active users who open the analytics dashboard (target: 60%)
- Average session time on dashboard vs. collection view
- Retention correlation: users who check analytics vs. users who don't (hypothesis: analytics users retain better)
- "Vault value" notification click-through rate (test: send monthly vault value summary via push)
