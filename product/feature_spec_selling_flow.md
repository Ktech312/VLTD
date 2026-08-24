# VLTD — Feature Spec: Sell From Your Vault
## Version 1.0 | Based on competitive analysis of 61 competitor screenshots

---

## THE PROBLEM WE'RE SOLVING

Right now, if a VLTD user wants to sell something in their vault, they have to:
1. Go to eBay (or wherever they sell)
2. Re-enter everything they already logged in VLTD — title, condition, grade, photos
3. Complete the sale somewhere else
4. Manually remove the item from their vault
5. Have no record of what it sold for or what their profit was

Every competitor who has a selling feature makes the same mistake: they help you list the item, then forget you. The sale happens somewhere else and nothing comes back into the app.

VLTD's selling flow closes that loop.

---

## WHAT COMPETITORS DO — OBSERVED DIRECTLY

**What works (steal these patterns):**

Toyzie shows the item's value in two states before you sell: UNSIGNED VALUE $25 / SIGNED VALUE $500. Before the user commits to listing, they see both options. The decision happens with full information.

CovRPrice puts Save / Add / Sell buttons directly on every item in their database. Sell is always one tap away. They also show RAW vs SLAB pricing in a table and pull eBay comps before you list. The user knows the market before they set a price.

Raremarq: enter a CGC cert number and the entire listing is pre-filled — title, series, issue, grade, publisher, cert verification. The user doesn't type anything.

artscapy frames it as "before you sell from your collection..." — they show the collector market context before the listing flow. Pre-sell intelligence, not just a form.

Strooply and Card Pilot track profit per sale and show it in a dashboard (Revenue vs Profit, Monthly Profit). This is the reseller side of the same loop.

**What nobody does (VLTD's opportunity):**

Not one app I reviewed closes the loop. They either:
(a) help you list → hand you off to eBay → never hear back, or
(b) show you analytics → can't connect to actual sales data because it lives somewhere else

When an item sells on eBay, it doesn't come back into any collector app as "sold — $325 — profit $82 — removed from vault on [date]." That record doesn't exist anywhere. VLTD should own it.

---

## THE VLTD SELL FLOW — HOW IT SHOULD WORK

### Step 1: Entry Point

Every item in the vault gets a "Sell" action. This can be accessed from:
- Item detail view (primary)
- Swipe action on collection list (secondary)
- Long-press on grid view (secondary)

The Sell button should never be the most prominent thing on an item. This is a collector app first. Sell lives in the actions, not the header.

### Step 2: Pre-Sell Intelligence Screen

Before the user sees a listing form, show them:

**Current market value** — what this item is selling for right now (pull from relevant price database per category)

**Your cost basis** — what you logged as your purchase price

**Potential profit** — the difference, shown clearly (not buried)

**Recent sales** — 3-5 comparable recent sales with prices (eBay sold listings or category-specific data)

**Value by condition** — if there's a graded vs raw difference (like Toyzie's unsigned/signed model), show both

This screen answers: "Is now a good time to sell this?" The user can back out of the listing flow from here. That's intentional — VLTD respects that collectors hold things.

Design note: This should feel like market intelligence, not a push to sell. Think Bloomberg, not a car dealership.

### Step 3: Listing Builder

Pull everything already in the vault record:
- Item name, series, issue/number, year
- Condition grade (raw or graded cert number)
- Photos already uploaded to the vault
- Any notes the user has added

The user should not have to re-enter anything they already logged. Every field that can be pre-filled must be pre-filled.

Fields the user adds in this step:
- Asking price (suggested based on pre-sell intelligence, editable)
- Shipping options (save these — a collector who ships once will ship again)
- Notes for the buyer (optional)

### Step 4: Listing Destination

Where does this listing go?

**Phase 1 (MVP):** Generate a shareable listing from VLTD. A clean, formatted page with all item details, photos, and asking price. The seller shares this link directly — via DM, text, email, or social. No marketplace integration required. Zero cost to build.

**Phase 2:** eBay integration via eBay Seller API (free developer tier). One-tap publish to eBay from the VLTD listing builder. eBay handles payment and shipping — VLTD handles the data.

**Phase 3:** Additional channels (Whatnot, Whatnot, Mercari, COMC) as demand warrants.

Phase 1 is the right MVP. A clean shareable listing page solves the problem without requiring marketplace integrations. Most collector-to-collector sales happen in Discord, Facebook Groups, and Reddit anyway — a shareable link works perfectly there.

### Step 5: Closing the Loop (The Part Nobody Does)

When an item sells:

The user marks it as sold inside VLTD. They enter:
- Sale price
- Sale date
- Platform / how it sold (optional)

VLTD then:
1. Moves the item to "Sold" status (not deleted — the record stays)
2. Records: cost basis, sale price, profit/loss, date
3. Updates the portfolio analytics (today's vault value decreases by the item's value; profit/loss is captured)
4. Keeps the item accessible in a "Sold History" section

**Why keep sold items?** Insurance documentation. Collectors sometimes need to prove chain of ownership. Resellers want their sales history. And it's satisfying to see what you've moved over time.

**Phase 2 of closing the loop:** If eBay integration exists, webhook or polling to detect when an eBay listing sells — auto-update in VLTD without the user having to manually mark it.

---

## WHAT THE VAULT GAINS FROM THIS FLOW

After a sale is recorded, the analytics dashboard can show:

- Total sold value (lifetime)
- Total profit (sale price − cost basis, all items)
- Best sale (highest profit)
- Most sold category
- Average hold time (how long items sat in the vault before selling)

This is data no competitor currently captures for collectors. It turns VLTD into something a collector checks not just to see what they own, but to understand their collecting history.

---

## WHAT TO NOT BUILD (SCOPE LIMITS)

**Do not build a marketplace.** VLTD is not eBay and should not try to be. The job is to make selling from the vault easy, not to own the transaction. The collector manages the sale; VLTD manages the data.

**Do not cross-list to 7 platforms.** Consigner and Vylist.ai do this. They're reseller tools, not collector tools. VLTD's user isn't running a warehouse.

**Do not require a sale to use the vault.** The sell flow is for when the user is ready. It should never feel like the app is pushing them to move things.

---

## TECHNICAL NOTES

**Phase 1 (shareable listing page):**
- Generate a static or server-rendered page at vltd.app/listing/[id]
- Pull item data from vault record
- Display: photos (carousel), item details, condition, asking price, seller's vault name, contact method
- No account required to view the listing
- Listing expires when the seller marks it sold, or after 90 days

**eBay integration:**
- eBay Marketplace Account Deletion Notification API: required compliance step (free)
- eBay Trading API or Sell Feed API: allows creating listings programmatically
- Free developer tier covers basic listing creation
- OAuth flow: user connects their eBay seller account once, VLTD stores the token

**CGC/PSA cert lookup for pre-fill:**
- CGC: publicly queryable at cgccomics.com/certification — no API key required for basic cert data
- PSA: PSAcard.com lookup is public — scrape or request API access
- Use cert number from vault record to pre-fill graded item details automatically

---

## SUCCESS METRICS

- % of vault users who initiate a sell flow (target: 15% within 90 days of launch)
- % of sell flows completed (listing created or item marked sold)
- % of users who return to mark an item sold after creating a listing
- Average time from "sell" initiated to item marked sold
