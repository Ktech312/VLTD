# VLTD — Feature Intelligence Report
*What to learn from every competitor and how to do it better*

> **Philosophy:** Don't copy. Study what works, understand WHY it works, and build a version that fits VLTD's multi-category, vault-first approach. Every feature borrowed should connect back to the core: "Every category. One vault."

---

## Priority Legend
- 🔴 **High Priority** — Strong differentiator, relatively buildable, fills a real gap
- 🟡 **Medium Priority** — Valuable but not urgent, or more complex to build
- 🟢 **Low Priority / Longer Term** — Nice to have, or requires significant infrastructure

---

## From TCDB (Trading Card Database)

### 00a. 🔴 Collector Rankings / Vault Registry ("Bragging Rights")
**What they do:** TCDB's most powerful feature — every collector who tracks a player's cards is ranked globally against every other collector of that player. "#4 in the world for Dwight Gooden cards" is both a hook and a status symbol. It's completely free, which makes it more widely used than PSA's paid registry.

**Why it works:** Humans are wired for social comparison and status. Knowing you're #4 globally for a specific player creates three powerful behaviors: obsessive cataloguing (to climb the ranking), return visits to check your standing, and organic social sharing ("I just hit #1 for Ken Griffey Jr. cards"). One collector went from #2 to #4 in months without doing anything — someone else just added more cards. That anxiety alone drives daily engagement.

**VLTD version — the "Vault Registry":**
- Build a global leaderboard per collectible subject — player, character, franchise, artist, title
  - Sports cards: "Top Collectors of Shohei Ohtani" — ranked by unique card count
  - Comics: "Top Collectors of Amazing Spider-Man" — ranked by issue count
  - TCG: "Top Collectors of Base Set Pokémon" — ranked by set completion %
  - Vinyl: "Top Collectors of [Artist] discography" — ranked by discography %
  - Games: "Top Collectors of [Franchise]" — ranked by title count
- Leaderboard is public and visible on the gallery — anyone can see the top collectors
- Every collector's vault page shows their current rankings: "Ranked #12 globally for Pokémon Base Set"
- Leaderboard updates in real time as collectors add items
- This is a massive retention driver and a powerful social sharing mechanic — people post their rankings on Twitter, Reddit, and TikTok

---

### 00b. 🔴 Collection Completion Percentage
**What they do:** "You own 302 of 986 George Sisler cards = 30.6% complete." Collectors can see an exact completion percentage for any set or subject, and set personal goals (e.g., "reach 50%"). The missing pieces become a natural want list.

**Why it works:** Completion percentage taps into the same psychology as progress bars — the Zeigarnik effect. An incomplete collection demands attention. "96% complete" is more motivating than "4 cards missing." And a defined goal ("reach 50%") structures collecting behavior and drives purchases.

**VLTD version:**
- Surface completion % on every set, series, or subject a collector tracks
- "You own 47 of 102 Base Set cards — 46% complete"
- Show a visual progress bar on the vault dashboard and gallery
- "Almost there" notifications: "You're 3 cards away from completing this set"
- Missing cards automatically populate the want list
- Let collectors publicly display their completion stats on their gallery: "96% complete Pokémon Base Set"
- This creates a powerful onboarding hook: show new users what % of their favorite set they already own

---

### 00c. 🟡 Crowdsourced Database with Gamified Contributions
**What they do:** TCDB's entire database is built and maintained by its community. Users submit card images, add checklists, fix errors, add pricing, and submit new items. Every contribution earns points, unlocking titles and special permissions. This has created one of the most comprehensive card databases in existence — for free.

**Why it works:** Community-built databases solve the "who maintains this?" problem that kills every catalog product eventually. The points/rewards system creates intrinsic motivation to contribute. Users become invested in the quality of the platform because they helped build it.

**VLTD version:**
- Allow vault users to contribute item data to a shared VLTD catalog:
  - Submit photos of items not yet in the database
  - Add missing variants, editions, or parallel types
  - Correct pricing data or item details
  - Rate and flag incorrect AI identification results
- Reward contributions with a "Vault Contributor" badge and points
- Top contributors shown on a leaderboard and in the app
- Community contributions go through a simple review queue before going live
- This solves VLTD's biggest long-term challenge: catalog depth across all categories

---

### 00d. 🟡 Gamification Layer — Titles, Points, Levels
**What they do:** TCDB members start as "Rookies" and earn titles as they accumulate contribution points. Higher point levels unlock special site privileges. A Top Members leaderboard shows the most active contributors.

**Why it works:** Titles and levels create identity ("I'm a TCDB Veteran") and give non-monetary rewards for platform investment. The leaderboard creates community status without requiring financial incentive. It also aligns user incentives with platform health — the most rewarded users are the ones making the database better.

**VLTD version:**
- Create a collector progression system with titles based on vault activity:
  - Vault size: "Starter" → "Collector" → "Curator" → "Archivist" → "Master Vaultkeeper"
  - Contribution points: unlocked by adding items, correcting data, sharing galleries
  - Streak rewards: consecutive days active in the vault
- Display title/level on public gallery and vault profile
- Special perks for higher levels: priority AI scanning, advanced analytics, early access to new features
- Keep it lightweight — this should feel like a fun reward, not a chore

---

## From Beckett Organize

### 0a. 🔴 Set / Checklist Completion Tracking
**What they do:** Beckett's core feature — collectors can check off which cards from a set they own, see completion percentage, and download full set checklists. It's the "Pokédex" mechanic for card collectors.

**Why it works:** Completion is one of the most powerful psychological hooks in collecting. "I have 47 of 50 cards in this set" creates urgency, satisfaction, and return visits. It also maps perfectly to wishlists — the missing cards become natural want-list items.

**VLTD version:**
- Build "Set Completion" as a first-class feature for all category-appropriate universes:
  - **TCG:** Track which cards from a set/expansion you own (e.g., "Base Set: 98/102 cards")
  - **Sports Cards:** Track team sets, player rainbow (every parallel of one player's card)
  - **Comics:** Track issue runs (e.g., "Amazing Spider-Man: owned 340 of 900 issues")
  - **Games:** Track franchise completion (e.g., "Zelda series: 14 of 19 mainline titles")
  - **Vinyl:** Track artist discography completion
- Show completion % on vault dashboard: "Your Pokémon Base Set is 96% complete"
- "Missing pieces" automatically become wishlist items
- Surface "almost complete" sets as a motivational nudge: "You're 3 cards away from a complete Base Set"
- This is a powerful retention and daily-use feature — collectors will open the app just to check their completion status

---

### 0b. 🔴 Data Portability Guarantee (Counter-Feature to Beckett)
**What they do:** Beckett explicitly does NOT allow data export, citing copyright law. Collectors' own collection data is locked to the platform.

**Why this matters for VLTD:** This is a massive pain point and a huge trust issue in the community. VLTD can turn data portability into a competitive moat by doing the exact opposite.

**VLTD version:**
- Build a full collection export feature: CSV, JSON, and PDF export of everything in the vault
- Make it prominent in settings — "Export Your Vault" should be impossible to miss
- Market it directly: "Your collection data is yours. Export it anytime, in any format."
- This removes a key objection to switching from Beckett: "What happens to my data?" → "You keep it."
- Also include: photo export (all item images as a zip), insurance packet PDF, portfolio report PDF

---

### 0c. 🟡 Want List + Trade Matching
**What they do:** Beckett Organize has a want list system where collectors can list what they're looking for, and a trade matching system that surfaces potential swaps between users.

**Why it works:** Want lists create ongoing engagement — collectors keep coming back to check if anyone has what they need. Trade matching creates community network effects.

**VLTD version:**
- Add a "Want List" section to every vault — items the collector is actively seeking
- Show "wanted by" counts on public galleries: "3 collectors want this item"
- Match want lists against other users' "For Trade" items (feeds into Trade Network, Task 14)
- Want lists also power the "Almost Complete" set completion feature above
- For marketing: "Add to Want List" is a low-commitment CTA for items seen in other people's public galleries

---

### 0d. 🟡 Verified Realized Prices (Not Just Estimates)
**What they do:** Beckett's "BVP" (Beckett Verified Realized Prices) shows actual transaction prices from real sales — a layer above market estimates that carries more credibility because it's based on what items actually sold for.

**Why it works:** Collectors and insurance companies both trust realized prices more than estimated values. "This card sold for $450 on [date]" is more defensible than "estimated value: ~$420."

**VLTD version:**
- Label VLTD's pricing data with source and transaction type: "Based on 8 verified sales in the last 30 days"
- Show a "price realized" history log for each item — a mini chart of what this exact item (or close comparables) actually sold for over time
- In insurance packets: lead with realized prices, not estimates — "Comparable sold: $X on [date] via [platform]"
- Market this angle: "VLTD valuations are based on what your items actually sell for — not guesses"

---

## From HobbyScan

### 1. 🔴 Built-in Screen Recording for Content Creators
**What they do:** HobbyScan has native screen recording integrated into the app, specifically designed for "live breakers" — collectors who open packs on stream and need to document what they pull in real time.

**Why it works:** Content creators are a massive acquisition channel. If the tool serves them during content creation, they promote it naturally and constantly.

**VLTD version:**
- Add a "Content Mode" to the vault — a clean, distraction-free fullscreen view of an item or gallery optimized for screen recording
- Or: a "Stream Overlay" view that shows recently added items as they're scanned, perfect for live pack openings or collection reveals
- At minimum: ensure VLTD's UI looks great when screen-recorded and add a share prompt after a scan session ("Share your haul")

---

### 2. 🔴 Bulk / Rapid Scan Mode
**What they do:** HobbyScan has a "Rapid Scan" Pro feature that lets you scan many items back-to-back without stopping to confirm each one — useful for large collections.

**Why it works:** Large collectors have hundreds or thousands of items. Friction at the scan step is the #1 reason people abandon cataloguing apps.

**VLTD version:**
- Build a "Haul Mode" or "Bulk Import Session" — scan continuously, queue items up, then review and confirm the batch at the end
- Show a running total value as items are added during a bulk session ("You've added 47 items worth $1,240 so far")
- This is also great content: a "bulk scan reveal" is inherently shareable

---

### 3. 🟡 eBay / Marketplace Listing Export
**What they do:** HobbyScan Pro lets you list directly to eBay from within the app.

**Why it works:** Many collectors are also occasional sellers. Bridging vault → listing removes a friction point and adds a revenue use case.

**VLTD version:**
- VLTD already has `ExportListingButton.tsx` and `SellItemButton.tsx` — confirm these are polished and prominent
- Add pre-filled listing templates: title, description, condition, and price auto-populated from vault data
- Consider a "Cost to Sell" calculation (you already have `CostToSellPanel.tsx`) that shows net profit after eBay/platform fees

---

## From CrystalCommerce

### 4. 🟡 Pre-Populated Product Catalog (2M+ Items)
**What they do:** CrystalCommerce has a catalog of 2M+ game and hobby products that store owners can import and sell from without building their own database.

**Why it works:** The biggest friction in any collector app is entering item data. Pre-populated databases mean collectors scan or search and the data is already there.

**VLTD version:**
- Partner with or license data from existing databases: TCGPlayer API, TCDB (comics), PSA/BGS cert lookup, Discogs (vinyl), PriceCharting (games)
- Build a "Quick Add" search where typing a card name, comic title, or game auto-populates all fields: title, publisher, year, series, variant, current market value
- This is likely already partially built (`quick` folder in the vault app directory) — prioritize expanding the catalog depth

---

### 5. 🟢 Multi-Channel Sales Integration
**What they do:** CrystalCommerce connects store inventory to TCGPlayer, eBay, and Amazon simultaneously.

**Why it works:** Sellers want one-click publishing to multiple platforms.

**VLTD version (longer term):**
- When a collector marks an item for sale, allow one-click listing to eBay + Mercari + Facebook Marketplace
- This is a Pro-tier feature for later — but worth planning in the architecture now

---

## From ToyzieAI

### 6. 🔴 AI Condition Grading with Specific Criteria
**What they do:** ToyzieAI's AI grading analyzes packaging, surface quality, edges, alignment, and overall structure — giving a grading score modeled after AFA/CGA standards for toys.

**Why it works:** Grading is the #1 factor in a collectible's value. Automating even a rough grade saves hours and adds enormous value for insurance and selling purposes.

**VLTD version:**
- Expand VLTD's AI scanning to include condition assessment as part of the scan result — not just "what is this?" but "what condition is it in?"
- Use category-specific grading standards: PSA 1-10 for cards, CGC 0.5-10 for comics, AFA/CGA for toys, Goldmine scale for vinyl
- Label it clearly as an AI estimate, not a professional grade — "AI suggests: Near Mint (8-9 range)" with an option to manually override
- This feeds directly into your insurance documentation (graded condition = more accurate insurance value)

---

### 7. 🟡 Rarity / Demand Intelligence Layer
**What they do:** ToyzieAI flags items as Common, Uncommon, Rare, Epic, or Legendary based on production details, series popularity, and collector demand.

**Why it works:** Collectors love knowing how rare their items are — it's emotional and shareable ("I have a Legendary-rated figure").

**VLTD version:**
- Add a "Rarity Signal" to item details — pull from population reports (PSA Pop, CGC Census) for graded items, or from sales velocity data
- For ungraded items, use AI to estimate based on print run, age, variant, and market demand
- Surface "Notable Items" in the vault dashboard: "Your vault contains 3 items with fewer than 500 known copies"
- This is excellent gallery content too — a "Rarest Pieces" section in the public gallery

---

## From Valuable App (thatsvaluable)

### 8. 🔴 Offline Capture with Auto-Sync
**What they do:** Valuable lets you photograph and capture items offline (at a show, a storage unit, a convention) and automatically processes and syncs them when you're back online.

**Why it works:** Collectors often do their best work in places with no signal — comic cons, flea markets, storage units, estate sales. Requiring internet kills the workflow.

**VLTD version:**
- Build offline capture mode: scan items into a local queue, process AI identification and valuation when connection is restored
- Show a "Pending sync" badge for unprocessed items
- This is a significant technical lift but a strong differentiator — most apps require connectivity

---

### 9. 🔴 Auto-Generated Marketplace Listing Copy
**What they do:** Valuable generates SEO-ready item descriptions and marketing copy from your item photo — ready to paste into eBay, Etsy, or your own site.

**Why it works:** Writing listings is tedious. Auto-generating a professional description saves 5-10 minutes per item, which adds up fast for large collections.

**VLTD version:**
- When a collector marks an item for sale, auto-generate a listing title + description using the item's vault data + AI
- Include: title, condition, notable features, what's included, shipping considerations
- Make it one-tap: "Generate Listing Copy" → copy to clipboard → paste into eBay
- You already have AI infrastructure in place — this is a relatively small extension of existing capabilities

---

### 10. 🟡 Estate / End-of-Life Collection Planning Mode
**What they do:** Valuable explicitly targets estate planning — helping families catalog what a deceased relative owned and prep it for sale.

**Why it works:** This is an underserved, emotionally significant use case. Collectors eventually die, and their families have no idea what anything is worth.

**VLTD version:**
- Add a "Beneficiary Access" feature — a read-only vault link that can be stored with estate documents, allowing a trusted person to access the collection inventory if needed
- Market this quietly but clearly in the insurance documentation section: "Share your vault with your estate attorney"
- This deepens the insurance angle significantly

---

## From ComicSnap

### 11. 🔴 Key / Notable Issue Detection
**What they do:** ComicSnap's "Key Finder" uses AI to analyze a comic's metadata and determine if it's a key issue — first appearance, origin story, death issue, variant, etc.

**Why it works:** Key issues are worth dramatically more than normal issues. Knowing you have one changes the entire value of your collection. This is a "wow" feature that collectors genuinely care about.

**VLTD version:**
- Build a "Notable Items" detector across all categories, not just comics:
  - Comics: first appearances, key issues, rare variants
  - Sports cards: rookie cards, autographs, numbered parallels, 1/1s
  - TCG: first edition, shadowless, holographic, error cards
  - Games: sealed, black label, first print
- Surface these prominently in the vault: "⭐ Key Item — First Appearance of [Character]"
- Make them the hero of the public gallery: "Notable Pieces" section

---

### 12. 🟡 Condition Grading Suggestions with Named Grades
**What they do:** ComicSnap gives named condition grades (Fine, Very Fine, Near Mint) rather than just a number.

**Why it works:** Named grades are more intuitive and match how collectors actually talk about condition. "Near Mint" means more than "8.5" to most people.

**VLTD version:**
- Use both: show the named grade AND the numeric equivalent, matched to category standards
- Allow collectors to log their own condition assessment alongside the AI suggestion
- The logged condition feeds directly into insurance valuation (condition = value)

---

## From CovrPrice.com

### 13. 🔴 Multi-Marketplace Sales Data (Not Just eBay)
**What they do:** CovrPrice pulls actual sales data from multiple marketplaces — not just eBay — to give a more accurate fair market value. They show both graded and raw sales separately.

**Why it works:** eBay-only data is skewed. Items sell on Mercari, MySlabs, PWCC, Heritage, Comic Connect, and elsewhere. Multi-source data gives a more accurate and defensible valuation — especially for insurance purposes.

**VLTD version:**
- For insurance documentation specifically, show valuation sourced from multiple marketplaces
- Label the data source: "Value based on [X] recent sales across eBay, Mercari, and [platform]"
- Separate graded vs. raw values where applicable
- This makes VLTD's insurance packets more credible and defensible to actual insurance companies

---

### 14. 🟡 Weekly Market Movement Content ("The Shaker Report")
**What they do:** CovrPrice publishes a weekly "Shaker Report" — which comics moved significantly in value that week. This drives community engagement and repeat visits to the site.

**Why it works:** Collectors check prices constantly. A weekly "what moved this week" digest keeps people coming back, generates email open rates, and builds habit.

**VLTD version:**
- Send a weekly "Vault Report" email to active users: "This week in your vault — your [Item X] is up 23%, your [Item Y] dropped 8%"
- Add a "Market Movers" section to the vault dashboard (you already have `BiggestMoversPanel.tsx` — make sure it's prominent)
- This is also excellent social content: "Top 5 collectibles that moved in value this week"

---

## From Gemli (Thrift & Profit Finder)

### 15. 🔴 Profit Margin Calculator at Point of Scan
**What they do:** Gemli shows not just what an item is worth, but what your potential profit would be if you resold it — factoring in marketplace fees and shipping.

**Why it works:** Collectors who also sell (which is most serious collectors) want to know their position at a glance. "This cost me $45. It's worth $120. After eBay fees and shipping, I'd net $89."

**VLTD version:**
- Add a "Net Profit" calculation to item details alongside portfolio gain:
  - "Paid: $45 | Current Value: $120 | Net if sold on eBay: ~$89 | Gain: +$44"
- You already have `CostToSellPanel.tsx` — make this surface more prominently throughout the vault
- This one feature alone could drive significant adoption from the collector-reseller crossover audience

---

### 16. 🟡 Visual Match — "Find Similar Listings"
**What they do:** Gemli shows visual matches from marketplace listings similar to the item you scanned — so you can see what comparable items actually look like and are selling for.

**Why it works:** Collectors want to compare their item's condition and presentation to similar sold listings. It builds confidence in the valuation.

**VLTD version:**
- After scanning, show "Recent Sales" with thumbnail images from eBay/Mercari sold listings
- Allow filtering by condition and format (raw vs. graded)
- This deepens trust in the valuation — especially for insurance documentation purposes

---

## From CLZ Comics (Original Competitor)

### 17. 🟡 Deep Pre-Built Database with Variant Tracking
**What they do:** CLZ has decades of comic book data — including variants, printings, newsstand editions, and retailer exclusives — meticulously catalogued.

**Why it works:** Serious collectors care about specific variants. A 1st print vs. a 2nd print vs. a newsstand edition can be a 10x difference in value.

**VLTD version:**
- Ensure variant/edition tracking is a first-class field in the vault for all categories:
  - Comics: printing, newsstand/direct, variant cover
  - Cards: parallel, numbered edition, auto, relic
  - Games: region, black label, Greatest Hits, sealed/complete
  - Vinyl: pressing, label, country of origin
- Make these fields filterable in the vault so collectors can find "all 1st editions" or "all numbered cards" instantly

---

## From CollX (Original Competitor)

### 18. 🟡 Community / Trade Features
**What they do:** CollX has a social community layer where collectors can connect, trade, and buy from each other.

**Why it works:** A marketplace or trade network built on top of a vault creates lock-in. Once you've catalogued 500 items in a platform, you don't leave.

**VLTD version (longer term):**
- "Trade Vault" — mark items as available for trade, browse what other VLTD users have marked for trade
- Start simple: a "For Trade" flag on vault items + a public discovery page
- This is a significant feature but creates powerful network effects — the more users, the more valuable the trade network

---

## Synthesis: The VLTD Feature Roadmap

### Do Now (Highest Impact, Buildable)
| Feature | From | Why Now |
|---|---|---|
| AI Condition Grading | ToyzieAI | Feeds insurance docs, adds scan depth |
| Bulk / Rapid Scan Mode | HobbyScan | Reduces biggest onboarding friction |
| Notable / Key Item Detection | ComicSnap | "Wow" moment, gallery hero feature |
| Profit Calculator (Cost to Sell) | Gemli | Already partially built, high demand |
| Multi-Marketplace Price Sources | CovrPrice | Strengthens insurance credibility |
| Auto-Generated Listing Copy | Valuable | AI already there, small extension |

### Build Next (High Value, More Complex)
| Feature | From | Why Next |
|---|---|---|
| Weekly Vault Report email | CovrPrice | Drives retention + email habit |
| Content / Stream Mode | HobbyScan | Creator acquisition channel |
| Variant / Edition Tracking | CLZ | Serious collector depth |
| Visual Match (Recent Sales) | Gemli | Builds valuation trust |
| Rarity Intelligence | ToyzieAI | Emotional + shareable |
| Offline Capture + Sync | Valuable | Convention/show use case |

### Longer Term (High Impact, Significant Build)
| Feature | From | Why Later |
|---|---|---|
| Multi-Platform Listing Export | CrystalCommerce | Revenue unlock for sellers |
| Trade/Swap Network | CollX | Network effects, lock-in |
| Beneficiary / Estate Access | Valuable | Deepens insurance angle |
| Pre-Populated Catalog (2M+ items) | CrystalCommerce | Major data infrastructure |

---

## The Golden Rule
Every feature VLTD borrows should answer: **"Does this work across ALL categories, not just one?"**

HobbyScan's screen recording is for sports cards. VLTD's Content Mode works for someone scanning Pokémon, vinyl, comics, or a graded Babe Ruth auto. ToyzieAI's rarity is for toys. VLTD's Notable Items detection works for every universe. That's the difference. That's the moat.

---

*Last updated: May 2026 | Review against competitor updates quarterly*
