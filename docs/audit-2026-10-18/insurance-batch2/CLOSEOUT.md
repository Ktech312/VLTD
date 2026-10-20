# Insurance batch 2: closeout

Production, synthetic fixture only (7 added items on top of the standard QA collection; no real customer data). Evidence: `before-fix/` and `after-fix/` in this folder (actual generated PDFs, their extracted text, PNG renders of the PDFs, `*-summary.json`).

## What was wrong (before, same fixture)
| Document | Before |
|---|---|
| Printable packet | **Blank**: 0 characters in the PDF (a print rule matched the `<html>` element and hid everything) |
| Inventory, item sheet, report, schedule | Site top bar printed; only the first screenful printed (inventory cut off 2 rows); text near-invisible (contrast about 1:1 on the item sheet and report) |
| Totals | Different on every page: different item sets, cost = price only, and purchase price shown as "stated value" |

## What changed (commits on `main`)
- `2bd446b` print: site bars carry a marker and never print; the fixed scroll box is released so documents run to as many pages as needed; black text on white.
- `5ac1d30` one rule set (`src/lib/insuranceDocs.ts`) for the Inventory, packet (screen and print), item sheet, Inventory Schedule, report and the Vault PDF.
- `9903f96`, `f00ff32`, `67985e1` print follow-ups found during verification: packet-screen controls no longer print; the legacy link-keyed screen CSS and the theme's `!important` body gradient no longer paint a dark panel behind printed pages.
- `224fddc` + this folder: evidence.

Decisions applied exactly as given:
- **Cost** = purchase + tax + shipping + fees (same all-in cost as Home). Blank shows `-`; an explicit `$0` shows `$0`.
- **Estimated value** is its own labelled column and only counts values someone entered. Items without one show "No estimate"; the cost is never shown as a value, and a note says how many items have none and what their cost is (reference only).
- **Counted** = owned items. Sold items, supplies and wishlist items are not counted, and every document says how many and why ("Not counted: 5 sold, 1 supply item (boxes, cases), 1 wishlist item."). Exclusions you set yourself are counted out and reported the same way.
- **Sold item sheet** stays reachable by direct link and is marked "SOLD APR 12, 2026 FOR $680: historical record, not part of the current inventory or its totals".
- **Exclusions are device-only** and every document says so. No storage or schema change. Account-synced exclusions are a separate proposal: [`MIGRATION-PROPOSAL-account-exclusions.md`](MIGRATION-PROPOSAL-account-exclusions.md), SQL in [`insurance-excluded-column.sql`](insurance-excluded-column.sql) (not applied).

## Results (production, actual Chrome print-to-PDF of every document)
Fixture: 31 counted items, 5 sold, 1 supply, 1 wishlist.

| Document | PDF pages | Rows in PDF | Site bar in PDF | Worst text contrast (dark / light theme) |
|---|---|---|---|---|
| Inventory | 1 | 31 | no | 18.3 / 16.3 |
| Packet screen | 4 | 25 | no | 18.3 / 16.3 |
| Packet print, page 1 of 2 | 2 | 25 | no | 18.3 / 16.3 |
| Packet print, page 2 of 2 | 1 | 6 | no | 18.3 / 16.3 |
| Item sheet (owned) | 1 | 1 | no | 21 / 16.3 |
| Item sheet (sold, direct link) | 1 | 1 | no | 21 / 16.3 |
| Report | 7 | 31 | no | 18.3 / 16.5 |
| Inventory Schedule | 3 | 31 | no | 18.3 / 16.5 |
| Vault "Insurance PDF" (real dialog, document the app builds, printed) | 32 | 31 + cover | n/a (own document) | black on white |

- **Same totals everywhere:** every document, and the Vault PDF cover, states 31 items, total cost $796 (29 of 31 with a recorded cost), estimated value $1,084 (14 of 31 have an estimate), 17 items with no estimate (their $417 cost not counted as value).
- **Explicit zero / unknown / no estimate** (rows in the fixture): `$0` cost shows `$0`; unknown cost shows `-`; `$0` value shows `$0`; no value shows "No estimate"; cost-with-tax-shipping-fees `$100 + 8 + 5 + 2` shows `$115`.
- **Excluded by you** (one item excluded in the browser): every document drops it, says "1 excluded by you on this device", and shows the same new totals ($681 cost, $934 estimate = $796 − $115, $1,084 − $150). `after-fix/excluded-summary.json`.
- **Multi-page:** the packet (page 1 spans 2 PDF pages with repeated headers), report (7), schedule (3) and Vault PDF (32) run past one page.
- **Both screen themes:** dark ("deep-vault") and light ("pearl-light") captured; print is black on white in both.

## Limits, said plainly
- The Vault PDF is generated into a hidden frame and sent to the browser's print dialog; the evidence PDF is Chrome printing that exact document, not the user's own print dialog.
- Print preview was exercised as print-media emulation + Chrome print-to-PDF, not a human clicking the browser's Print button.
- The inventory fits 31 rows on one landscape page, so it is not a multi-page proof by itself.
- Exclusions remain per device until the proposed column exists.
