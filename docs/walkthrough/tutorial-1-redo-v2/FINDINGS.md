# Findings from recording Tutorial 1 (v2: the five recording findings are fixed)

The first preview (`docs/walkthrough/tutorial-1-redo/`, kept unchanged) recorded five problems in the app. They were fixed on 2026-10-26 (commit `634abc1`, live on production) and this second preview re-records only the screens they changed. Evidence for each fix is the production check **RB79** (19 of 19; `docs/audit-2026-10-18/repair-batch-20/scripts/rb79-ui-fixes-prod.cjs`, rows `RB79-001` onward) plus unit and structure tests.

## Fixed
| # | Finding | What the app does now | Evidence |
|---|---|---|---|
| F1 | Accounts without AI were shown Identify with AI buttons and a "500 left" allowance | A signed-in account sees an AI button or allowance only if it is the owner's confirmed account (the same rule the server uses to refuse everyone else, which is unchanged). This covers the Quick Add Verify sheet and its identifying screen, Add Item, the certificate scan on the item page, the Add manually photo panel and Bulk Upload. The Add manually status messages no longer tell a non-AI account to "choose Identify with AI". | RB79: none of those words appear for the QA (non-owner) account on any of those screens; the owner's screens still show them (browser-side identity only, nothing pressed, no AI request); `npm run test:ai-ui` (10 of 10) fails if a new AI control appears without the guard |
| F2 | Tax 3.50 read $4 on the item page, and Total cost read $46 | The Purchase panel, Total cost, Gain and Cost (all-in) show to the cent: $38.00, $3.50, $4.25, $0.00 and $45.75. Stored amounts were never rounded and are unchanged. | RB79: stored 38 / 3.5 / 4.25 / 0 and the page reads $38.00 / $3.50 / $4.25 / $0.00 / $45.75 |
| F3 | On a phone, the Add Item camera button sat partly behind the bottom tab bar | The camera panel ends above the tab bar. | RB79 (emulated phone): button bottom 722 px, tab bar top 755 px, and a tap on the centre of the button takes the photo |
| F4 | The crop editor showed debug timing text | Removed (and the unused timers). | RB79 (desktop and phone): no "blur-check", "draw ..ms" or "..x..px ·" text |
| F5 | The Brand typed on Add Item showed under "Publisher / maker" while the Brand row was empty | A category with its own Brand row (toys, watches, handbags) shows the recorded brand there; otherwise it is listed as "Brand / maker / publisher". Nothing is moved or copied, the stored brand is untouched, and a legitimate Publisher / maker field is unchanged. Clearing the Brand row clears the brand it was showing, so it does not return. | RB79: "Brand Retro Robots", no "Publisher / maker Retro Robots"; `npm run test:details` (46 of 46, 9 new brand checks) |

Release-following (not shown in the tutorial, fixed in the same pass): removing a followed release is now a recorded decision with Undo and is not restored at the next check (the series stays followed); a tracked release gets date corrections even when its date moves outside the discovery window (bounded per-issue lookups, a hand-edited date still wins). 15 more tests in `npm run test:wants-handoff` (41 of 41); the Wishlist production check RB68 passes 39 of 39 on the deployed code. See `docs/audit-2026-10-18/repair-batch-20/HANDOFF-VERIFICATION.md`.

## Observations still open (working as built, for a later decision)
| # | Where | Observation |
|---|---|---|
| O1 | Add Item | Pressing **Save to Vault** with no Item name saves nothing and moves the cursor to Item name, but no message is visible on screen when the button is pressed. The tutorial describes exactly that. |
| O2 | Add Item | The form remembers the Universe and Category of your last item, so the next item silently starts there. The tutorial warns viewers to check it. |
| O3 | Quick Add review | Pop Culture starts on Category "Comics", so a toy needs correcting. The tutorial shows the correction. |
| O4 | Quick Add | An item saved with no name is called "Untitled Item". |
| O5 | Entry points | Two different "add" forms exist: Add Item (`/capture`, "Item name", camera) and Add manually (`/vault/add`, "Title", its own photo area and more fields). Choosing existing photos is Upload from device (Single item or Batch), not Quick Add. The tutorial maps all of these. |
| O6 | Add Item form | The Grade box shows a grey "9" that is an example, not a value. |
| O7 | Vault value | An item with a purchase price and no valuation counts at its purchase price in Total value, and the card says so. This is the intended rule; nothing is stored as a valuation. |

## What could not be recorded
- The browser's camera permission prompt (drawn by the browser, not the page).
- A real camera feed or a real phone. The test camera plays a looping file of fictional pictures.
- An AI identification result. The recorded account does not have AI, so the app correctly shows no AI control; AI is explained on a card. No AI request was made.
