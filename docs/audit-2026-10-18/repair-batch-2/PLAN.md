# Repair batch 2: Insurance (plan for review; NOTHING is implemented)

Scope: the Insurance findings from the audit that stop a person producing a correct insurance document: the blank printable packet, unreadable or cluttered print output, and totals that disagree between the Insurance pages, reports and PDFs. No cosmetic work and no unrelated repairs. Starts only after you approve this plan. Evidence sources: audit rows GIN-122/123, 227-231, 087, 092, 240, 243, 260 (screenshots in `docs/audit-2026-10-18/shots/gin-*.jpg`; first-failure evidence is in `rows.jsonl` and will be frozen and checksummed, as in batch 1, before any code changes).

My earlier production check of the printable packet read its text, not whether it was visible, so it could not catch the blank page. The new checks below measure visibility, contrast and layout in print media.

## Defects (individual, in the order I propose to fix them)

**RB4-01 — The printable packet prints as a blank page** (GIN-122, GIN-123; blocked workflow).
- *Reproduced (audit, browser):* `/insurance/packet/print` shows white on screen and in print media; `<html>` has `display:none`; the table exists in the document (25 rows).
- *Cause / code:* `src/app/insurance/packet/print/page.tsx:117` hides the site bar with `[style*="--topnav"] { display: none !important }`. `src/components/AppShellEffects.tsx:112` sets `--topnav-shift` on the `<html>` element's inline style, so the selector matches the whole document. (Older rule, from the packet-performance hotfix; it only worked while nothing set that property on `<html>`.)
- *Proposed fix:* mark the site bar and bottom bar once (`data-site-chrome` on the `TopNav`/`BottomNav` wrappers in `NavShell`) and hide `[data-site-chrome]` in the print page; delete the `[style*="--topnav"]` and `header, nav` selectors (the latter also risks hiding the packet's own headers).
- *Checks:* in print media and on screen: `<html>` and the table are displayed; first and last row visible; page count text matches the records; site chrome not displayed; text contrast of the heading and every money cell at least 4.5:1; the "Open Printable Page" link still opens the print route in a new tab; images on/off (25 vs 5 per page) both print.

**RB4-02 — Site navigation bar prints on the Insurance documents** (GIN-228 inventory, 229 item sheet, 230 insurance report, 231 inventory schedule; usability).
- *Cause:* only `[data-vault-chrome]` has a print rule; the site `TopNav` has none on these pages.
- *Proposed fix:* the same `[data-site-chrome]` marker, with ONE print rule keyed to a page marker class (`vltd-print-document` on the document's `<main>`, not on link presence), applied to the four pages. No global print rule, so no other page changes.
- *Checks:* print media screenshot of each of the four pages: no element of the site bar displayed; page content unchanged.

**RB4-03 — Item sheet prints title and money figures in near-invisible light grey** (GIN-227; usability, 1.17:1 contrast).
- *Cause:* `src/app/insurance-pass.css` forces black text in print only for `section *`, and only under `body:has(a[href="/insurance/item"])` (a selector keyed on link presence, the same hazard I had to fix for the Insights stylesheet). The sheet's title and Purchase Cost / Current Value figures are not inside a `section`, so they keep the dark-theme light grey.
- *Proposed fix:* replace the link-presence selectors for print with the same `vltd-print-document` page marker: in print, everything inside it is black on white.
- *Checks:* computed colour/contrast of title, labels and money figures at least 4.5:1 in print media for the item sheet, inventory, packet, reports; screen appearance unchanged.

**RB4-04 — One set of items for every Insurance figure** (GIN-087, 092, 240, 243; misleading result).
- *Reproduced (audit):* with 26 owned + 5 sold + 1 supply item, the Insurance tab/packet list and total the 5 sold items ($1,431 vs $1,226 for the 26 owned); the Vault "Insurance PDF" says 32 items and prints sold and supply items; the Vault review link says 25 where readiness said 31.
- *Cause / code:* `insurance/page.tsx:115`, `packet/page.tsx:92` and `packet/print/page.tsx:91` use `collectibleItems()` (drops supplies only); `reports/insurance` and `portfolio/insurance` use `activeItems()` (drops sold, supply and wishlist); `src/components/VaultExportButton.tsx:101,153` hands `loadItems()` (everything) to `InsurancePdfButton`. `reviewCounts` is fed the larger set.
- *Proposed fix:* one rule, the existing `activeItems()` in `src/lib/vaultStats.ts` ("items you currently own"), used by the inventory, packet, print route, readiness counts and the Vault Insurance PDF/dialog. An item sheet still opens for a sold item by direct link (no data removed anywhere).
- *Checks (fixture with owned, sold, supply and wishlist items):* the item count, Total Value and Total Cost are identical on `/insurance`, `/insurance/packet`, the print route, `/reports/insurance`, `/portfolio/insurance` and in the Vault Insurance PDF dialog and printed document; the sold and supply items appear on none of them; "See what is missing" opens a Vault list whose count equals the readiness number.

**RB4-05 — One definition of "Cost"** (GIN-260; misleading result).
- *Cause:* `insurance/page.tsx:136`, `packet/page.tsx:117`, `packet/print/page.tsx:107` and the item sheet show the purchase price only; the report pages use `totalCost()` (`vaultStats.ts:115`: price + tax + shipping + fees), which is also what Home calls "What you paid, with tax, shipping and fees".
- *Proposed fix:* all insurance documents use `totalCost()` and say so in the column/total label ("Cost (with tax, shipping, fees)"). **Decision for you:** all-in (recommended, matches Home and the reports) or price only.
- *Checks:* a synthetic item with price, tax, shipping and fees shows the same Cost on the inventory, item sheet, packet, print route and report; the label states what it includes.

## Not in this batch (recorded; each needs a decision or touches storage)
- **"Not recorded" instead of $0** for items with no price and no value (GIN-089/105, your decision C4). I will not change wording without your answer; with RB4-04/05 done this is a one-place change.
- **Exclusions are saved only in the browser** (GIN-095/097/098): a packet printed from another device includes items the person excluded. Making them follow the account needs stored data (a profile field or table, i.e. possibly a migration). Needs a decision before batch 2b.
- Weekly report and Insurance tab count "needs documentation" with different checklists (GIN-155); the packet header says "insured items" (wording); phone tap sizes.

## Order, size, risk
RB4-01 (one selector + one marker) → RB4-02/03 (one print rule, one CSS block) → RB4-04 (one shared filter in five files plus the export button) → RB4-05 (one function, label text). About eight source files; each defect lands as its own focused commit with its regression check. Risk is low for print (page-scoped marker, no global print rule) and moderate for totals (numbers visibly change on the Insurance pages: sold and supply items disappear, cost rises where tax/shipping/fees exist), which is the intended outcome and will be described in the closeout. Lesson applied from batch 1: docs-folder scripts will be `.cjs`/`.txt` only, and I will check the Vercel build result before running production verification.

## Questions for you
1. Cost on Insurance documents: **all-in (recommended)** or purchase price only?
2. Should a sold item's sheet still open by direct link (recommended: yes, nothing removed) while it no longer counts in totals?
3. Exclusions following the account: do you want that as batch 2b (needs a stored field)?
