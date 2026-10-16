# Home money summary and Organize entry: revised proposals (2026-10-16)

Status: **proposals for review. Nothing here is built.** Replaces the "Collection finances band" in `docs/design/home-financial-audit-2026-10-16.md` (that version added a second set of the same numbers; this one does not).

Images in this folder (sample numbers, a design mock, not the live app): `home-revised-desktop.png`, `home-revised-phone.png`. Source: `home-revised-mockup.html`. The current Home, for comparison, is the single "Collection summary" card with Items, Invested, Value and Return.

## 1. Home: one summary card, four distinct money figures

**What changes.** The existing summary card keeps its place and its four tiles. The tiles stop being a mix (a count, a cost, a value, a percentage) and become four separate money figures, each one a link to the screen that explains it. The item count moves to a quiet line under the name ("41 items in 3 universes"). No new card, no repeated numbers.

| Tile | What it shows | Where it goes |
|---|---|---|
| **Purchase cost** | What you paid for the items you still own, with tax, shipping and fees (today's "Invested") | Cost breakdown (Insights) |
| **Estimated value** | A value someone entered or looked up. Items with none count at purchase price, in grey. Caption: "38 of 41 priced. 3 counted at cost" | Value history (Insights) |
| **Unrealized change** | Estimated value minus purchase cost for items you still own, as an amount and a percentage (today's "Return", which shows the percentage only) | Biggest movers (Insights) |
| **Realized sales** | Money from items actually sold: revenue, and profit after estimated seller fees | Sales analytics (`/vault/sold`) |

A one-line rule sits under the tiles: "Sold items are never inside the first three figures. Estimated value is not money received."

**"Go deeper" destinations (replace the two small pills).** Three clearly labelled link cards, each with a one-line description so nobody has to guess what is behind them: **Insights** (value history, movers, stale prices, insurance documentation), **Sales analytics** (revenue and profit after estimated fees, by month), **Activity** (recent value changes, sales and additions). Quick Add and Add Item stay as they are.

**How the priced-only setting affects each figure** (this text is shown under "What does this change?" next to the existing "Show priced only / Include unpriced" button, and the same words are used on the Vault and Insights):

| Figure | Include unpriced (default) | Priced only |
|---|---|---|
| Purchase cost | Every item you own | **No change** |
| Estimated value | Unpriced items counted at their purchase price, shown in grey | Unpriced items left out, so the number is smaller |
| Unrealized change | All items against their cost; an unpriced item adds nothing to the gain | Only items that have both a value and a cost, shown against their own cost (the caption says "on $X of cost, 38 items") |
| Realized sales | **No change** | **No change** (real sales, never mixed with estimates) |

Accuracy rules: with nothing priced the change tile reads "Not enough values yet", never 0%. Realized sales reads "No sales yet" when empty, never $0 profit. The profit line says "after estimated fees" because the fee is an estimate. Every figure comes from code that already exists (`summarizeValues` / `computeVaultStats` and the `/vault/sold` calculation), so Home cannot disagree with the Vault or Insights. No new data and no new calculation.

Layout. Desktop: four tiles in one row, three destination cards in one row. Phone: tiles two by two, destination cards stacked, the explanation collapsed behind "What does this change?" until opened (it is open in the mock only so you can read it). All targets are at least 44 px high with visible keyboard focus.

Not changed: Notices, Recently added, Your exhibitions, Lounge, Learn.

## 2. Curator Strength (identified as lost in the audit): recommendation

**Do not bring it back on Home, and do not bring it back as a score.** Reasons, from what the code actually does (`src/lib/collectorStrength.ts`, unused today):
- It is part money ranking: 25 of 100 points reward total value and 20 reward return, so it ranks people by how much they have spent or gained, and the label "Premier Curator" reads as a verdict on a collection's worth.
- It looks like an investment grade next to real figures, which is the confusion the four-figure card is meant to remove. (The app already says it does not give financial advice.)
- Its other inputs (item count, number of universes, exhibitions) are about activity, not money, and are better shown plainly.

**Recommended instead:** retire the score. If you want a progress marker later, add one non-financial, factual line on the Profile (not Home), for example "Documentation complete 38 of 41, 3 universes, 2 exhibitions", using numbers that already exist. That is a separate decision; nothing is proposed to be built now. Options for you: (A) retire it (recommended), (B) retire the score but add the factual Profile line, (C) restore as before on Home (not recommended).

## 3. Organize entry (not built; for your decision)

**Why it appears and disappears today.** Organize is drawn only when the exhibition already has at least one exhibit page (`sections.length > 0` in `GalleryBuilder.tsx`). An exhibition with items but no exhibit page shows no Organize at all, while Help says "use Organize".

**Proposal.**
1. **Always show an Organize button** in the builder toolbar, next to Edit/Add.
2. If the exhibition **has** an exhibit page: it works as now (press, drag cards to swap, press Done).
3. If it has **none**: pressing Organize opens a small notice, and **does not create anything by itself**: "Arranging works inside an exhibit page, and this exhibition does not have one yet. An exhibit page is one wall of up to 18 pieces." with two buttons: **Create first exhibit** and **Not now**. Only **Create first exhibit** creates "Exhibit 1" (from the pieces already picked) and then turns arranging on. **Not now**, closing the notice, or pressing Escape changes nothing.
4. The notice is a normal dialog (focus moves in and returns to the Organize button, Escape closes it, 44 px buttons). The button stays an enabled button, not a greyed-out one, so it can explain itself on a phone and to screen readers.
5. One line of hint text under the preview when arranging is on: "Drag a card onto another to swap them. Press Done when finished." (touch dragging remains unverified until tested on a real device).

Checks I would run before shipping: Organize visible with and without an exhibit page; "Not now" and Escape leave the exhibition byte-for-byte unchanged; "Create first exhibit" creates exactly one exhibit and a second press does not create another; the existing drag, save, reload and visitor-order checks still pass.

## Decisions needed
1. Approve or change the Home card in section 1.
2. Choose A, B or C in section 2 (recommended: A).
3. Approve or change the Organize entry in section 3.
