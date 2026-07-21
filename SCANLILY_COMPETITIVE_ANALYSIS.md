# Scanlily vs VLTD — Competitive Analysis
**Date:** July 2, 2026

---

## Who Is Scanlily?

Scanlily is a generic AI-powered inventory management app built by Scanlily LLC. Their tagline is "Organize Everything." They target insurance adjusters, warehouses, contractors, professional organizers, locksmiths, schools, nonprofits, and dozens of other verticals. Collectibles is one ad campaign out of many.

- **App Store rating:** 4.3 stars, 24 ratings (launched ~2022)
- **Pricing:** Free / Pro $8.99/mo / Business $10–20/mo (team)
- **Tech:** iOS + Android + web, DigitalOcean Spaces for storage
- **Brand color:** Purple #7B3F99 — standard SaaS look
- **Active development:** Shipping updates every few days (version 3.4.8 as of July 2026)
- **Recent pivot:** Added insurance claim fields (Mar 2026), AI valuation from photos (Apr 2026), launched ShelfLily as a free spin-off home inventory brand

---

## The Real Competitive Picture

**Scanlily is not a collectibles app.** It is a generic inventory tool that ran a collectibles ad. That's the whole threat. They have no grading system, no market value data, no collector community, no social features, no vault aesthetic. If a Pokémon collector downloads Scanlily, they are getting a tool designed for locksmiths and insurance adjusters.

**That said, they are shipping fast and running paid ads in your exact niche.** They are trying to steal your future users before VLTD reaches them. That's the real threat — not their product, but their marketing.

---

## Head-to-Head Comparison

| Feature | VLTD | Scanlily |
|---|---|---|
| Purpose-built for collectors | ✅ Yes | ❌ No (generic inventory) |
| Grading system (PSA, BGS, CGC) | ✅ Yes | ❌ No |
| Vault / exhibition branding | ✅ Yes (gold frame aesthetic) | ❌ No |
| Social sharing + OG cards | ✅ Yes | ❌ No |
| Community (follows, vibes, comments) | ✅ Yes | ❌ No |
| Watchlist / want list | ✅ Yes (/wishlist) | ❌ No |
| CSV / JSON / PDF export | ✅ Yes (VaultExportButton) | ✅ Yes |
| Photos ZIP export | ✅ Yes | ❌ No |
| Insurance PDF report | ✅ Yes | ⚠️ Basic (paid) |
| Market value / price tracking | ❌ Roadmap | ⚠️ Basic AI estimate (new, unproven) |
| AI image recognition | ✅ Yes | ✅ Yes |
| UPC / barcode scan | ❌ Roadmap | ✅ Yes |
| Built-in collectibles database | ❌ Roadmap | ❌ No |
| QR code labels (physical) | ❌ No | ✅ Yes (sells stickers) |
| Multi-user / team | ❌ No | ✅ Yes (Business plan) |
| Web app | ✅ Yes | ✅ Yes |
| Free tier | ✅ Yes | ✅ Yes |
| Brand feel | Prestige / vault | Generic SaaS |

---

## Where VLTD Wins

**1. Identity**
Collectors don't want inventory software. They want a VAULT. VLTD is the only app that treats their collection as something worth showcasing. The gold frame, the exhibition system, the "vault" language — none of this exists in Scanlily. A card collector using VLTD feels like a collector. A card collector using Scanlily feels like a warehouse manager.

**2. Social Layer**
Scanlily has zero social features. No follows, no likes, no community, no sharing. VLTD's entire share architecture (ShareBar, /share/[itemId], branded OG image) is something Scanlily cannot replicate without rebuilding from scratch. This is a structural moat. Collectors want to show off. Scanlily can never serve that need.

**3. Niche AI**
Scanlily's AI is trained on generic inventory. VLTD's AI (or roadmap AI) can be trained on collectibles-specific data — PSA grades, set names, card numbers, player stats, comic issue numbers, toy variants. That specificity is impossible to fake with a generic model.

**4. Community Network Effects**
Once VLTD collectors follow each other, share vaults, and discover new pieces through each other's exhibitions, it becomes a community platform that generic inventory software can never replicate. Scanlily is inherently single-player.

---

## Where Scanlily Has Advantages

**1. More mature product** — They have multi-user, audit trails, GPS, equipment booking, REST API. These took years to build. VLTD doesn't need most of these, but the breadth shows they're resourced.

**2. Running paid ads now** — They're actively spending to acquire users in your niche. VLTD needs to be visible when those ads run, so collectors can find the better option.

**3. Video recognition** — Their AI Video Inventory feature (walk around narrating while recording, AI catalogs everything) is genuinely impressive. VLTD doesn't have this yet. For someone with 500+ items to catalog, this is a killer feature.

**4. UPC barcode scan** — Scan a barcode, item info populates automatically. This is table stakes for cataloging apps and the biggest functional gap VLTD has today.

---

## Real Feature Gaps to Close (Priority Order)

1. **Download Card** — save the /api/og gold frame image to camera roll. Ships in a day, zero dependencies.
2. **Barcode / UPC scan** — scan a card or toy's barcode, auto-fill title, set, year. Biggest cataloging friction point.
3. **Market value** — pull eBay completed sales by title/barcode. One of the top collector requests universally.
4. **Public vault URL** — shareable URL for a user's entire collection, not just one item.
5. **Set completion tracking** — own 47/102 in a set, track toward completion.

---

## The Positioning Statement to Win

Scanlily is for people who want to track things. VLTD is for collectors who want to celebrate what they own.

Every product decision should run through that filter. When you ask "should we add this feature?" — does it make collectors feel more proud of their vault, or does it turn VLTD into generic inventory software? Stay in the vault. Scanlily owns the warehouse. Nobody ever bragged about their warehouse.

