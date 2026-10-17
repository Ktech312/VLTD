# Item page, Share, Export, Cost to Sell, Home and exhibition carousel: how it was checked (2026-10-17)

Everything here used ONE synthetic QA account created for the run (4 exhibitions, 12 items, 2 sold items; art from `public/collectibles`). It was removed at the end (`ui-cleanup.cjs`), and the cleanup reports what is left. No customer record was read or changed.

## What the scripts do (scripts/)
- `ui-setup.cjs` creates the QA user, profile, items and exhibitions and writes `qa_ui.json` (kept outside the repo). `ui-cleanup.cjs` removes all of it and verifies nothing is left.
- `ui-shots.cjs <label> --base=<url>` takes the screens that match the seven annotated images (item header, Share panel, Export for social, title/classification editor, Cost to Sell, Home, exhibition block, plus phone width).
- `ui-checks.cjs <label> --base=<url> [--only=item,share,export,sell,home,exhibition,regress]` runs the behaviour checks in a real headless Chrome: header frame, classification, title save, Share (photos, prompt, failure, success), Export (all four formats, byte-identical download, drawing failure), Cost to Sell (marketplaces per category, maths), Listing copy, Home layout and data, carousel (buttons, keys, click, drag, wrap, one and zero exhibitions, phone width), exhibition Share, the visibility eye, and two light themes.
- `cdp.cjs` is the small browser driver both use. The scripts expect a `../qa/env.cjs` that exports the project's Supabase URL, anon key and service-role key (not in the repo).

## Limits (said plainly)
- Sizes marked "phone" are a browser window resized to 390 px with mobile emulation. No physical phone, no real touch, no real share sheet: the share sheet is replaced by a stand-in that records exactly what would be handed over.
- Failure cases (the account refusing a change) are simulated by failing the network write inside the test browser only.
- **Native photo sharing is SIMULATED, not device-verified.** No real phone share sheet was opened.
- Prohibited-item lists for each marketplace were not audited.

## Screenshots
Before/after files with an index: `C:\Users\EK\VLTD\docs\ui-verification-2026-10-17\screenshots\INDEX.md` (folders `before\` and `after\`).

## Fee assumptions: how far each was verified (October 2026)
| Marketplace | Status shown in the app | Read from the marketplace's own page | NOT confirmed |
|---|---|---|---|
| eBay | verified (unverified estimate for jewelry, watches, handbags, guitars, bullion) | selling fees page: 13.25% comics/cards/CCG/coins; 15.3% books/magazines/movies/non-vinyl music; 13.6% most others; 2.35% above $7,500; $0.30 / $0.40 per order | its own tiers for jewelry, watches, handbags, guitars, bullion are not built in |
| Mercari | verified | "Fees on Mercari" help page: 10% of item price + buyer-paid shipping; no separate processing fee for sellers | nothing |
| Fanatics Collect | verified | Buy Now fees page: 6% under 120% of market value, 12% at or above | whether a listing is under 120% (assumed under) |
| Whatnot | unverified in part | seller fees page: starts at 8%, 2.9% + $0.30 processing; high-value help page: 0% commission on the part above $1,500 in listed categories, a limited-time promotion | real rate depends on your four-week tier and category; the US rate card could not be read |
| Discogs | unverified in part | selling fees page: 9% of item + shipping, min $0.10, max $150 | the payment processor's 2.9% + $0.30 (Discogs' pages do not state it) |

The Cost to Sell panel shows each marketplace's status under the figures and has an **Override fee %** box that replaces the built-in table.
