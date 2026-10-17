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
- Marketplace rules: eBay, Discogs, Whatnot (fees page) and Fanatics Collect (Buy Now fee page) were read from their own pages. Mercari's fee, Whatnot's "no commission above $1,500" line, and each marketplace's list of prohibited items were NOT confirmed from an official page.
