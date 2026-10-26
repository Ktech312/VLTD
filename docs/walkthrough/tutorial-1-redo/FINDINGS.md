# Findings while recording Tutorial 1 (redo)

Recorded 2026-10-26 against the deployed app (https://vltd.app) with a synthetic collector and a test camera. **None of these were fixed in this pass** (the brief was the tutorial only). Each one affects what the tutorial can truthfully say, and the tutorial's wording already avoids promising anything the app does not do. Where I could reproduce a value, the evidence is named.

## Likely defects (the app does something a collector would not expect)

| # | Where | What happens | Evidence | How the tutorial handles it |
|---|---|---|---|---|
| F1 | Quick Add "Verify your Drop" sheet | Every account sees the "N left" AI counter and the "Identify with AI" and "Identify N with AI (1 AI scan each)" buttons, but the server now refuses everyone except the owner. A non-owner learns that only after pressing the button: "AI scans are not available on this account." The counter (500 left) is misleading for those accounts. The same is true of the "Identify with AI" button and "500 AI scans left this cycle" on the Add Item form. | Steps 1.17 (Quick Add) and 2.6 (Add Item form); `RB76` shows the server answer (403 `owner_only`) | The tutorial says AI is optional and not on every account, and shows the real refusal. |
| F2 | Item page, Purchase panel and Market summary | Tax 3.50 reads **$4**, Shipping 4.25 reads **$4**, and the summary says "Total cost $46", while the cost basis line says $45.75. The stored values are exact (3.5, 4.25); only the display rounds to whole dollars. | Steps 2.14 and 2.15; database row `purchase_tax = 3.5`, `purchase_shipping = 4.25` | The tutorial tells viewers the panel rounds and that the exact amounts are stored. |
| F3 | Add Item camera on a phone-size screen | The round capture button sits partly behind the bottom tab bar (button top 740 px, tab bar top 755 px on a 390 x 844 screen). Only a thin strip is tappable above the bar. Observed in an emulated phone, not confirmed on a physical phone. | Step 2.22 (the highlight sits on the tab bar over the button); geometry logged by the capture script | The phone card tells viewers to tap the visible top edge, or use Upload or Take Real Photo. |
| F4 | Add Item crop editor | A technical readout is shown to users above the picture, for example "720x960px · draw 6ms · blur-check 49ms · encode 50ms · total 108ms". It looks like leftover debug text. | Steps 2.5 and 2.23 | Not mentioned in the captions; the zoomed picture crops it out. |
| F5 | Item page, Details | The Brand typed on Add Item ("Retro Robots") shows under "Other saved details > Publisher / maker", while the Brand row shows a dash. "Set / Series" is stored as "Model / product number". A collector who enters a brand will not see it in the Brand row. | Steps 2.11 to 2.14 | The tutorial calls the fields what the Add Item form calls them and only shows the item page for cost fields. |

## Observations (working as built, but worth a decision)

| # | Where | Observation |
|---|---|---|
| O1 | Add Item | Pressing **Save to Vault** with no Item name saves nothing and moves the cursor to Item name, but no message is visible on screen when the button is pressed (checked 2 seconds later). The tutorial describes exactly that. |
| O2 | Add Item | The form remembers the Universe and Category of your last item. The next item silently starts there (we saw a comic start as "Toys & Figures"). The tutorial warns viewers to check it. |
| O3 | Quick Add review | Pop Culture starts on Category "Comics", so a toy needs correcting. The tutorial shows the correction. |
| O4 | Quick Add | An item saved with no name is called "Untitled Item". |
| O5 | Entry points | There are two different "add" forms: Add Item (`/capture`, field "Item name", has the camera) and Add manually (`/vault/add`, field "Title", with its own photo area and more fields on one page). Quick Add has no way to choose existing photos; that is Upload from device > Batch (Bulk Upload) or Single item (Add Item). The tutorial maps all of these. |
| O6 | Add Item form | The Grade box shows a grey "9" that is an example, not a value; it can be mistaken for an entered grade. |
| O7 | Vault value | An item with a purchase price and no valuation is counted at purchase price in the Total value card, and the card says so. This matches the intended "ghost value" rule; no valuation is stored (database `current_value` stays empty). |

## What could not be recorded
- The browser's camera permission prompt (drawn by the browser, not the page).
- A real camera feed or a real phone. The test camera plays a looping file of fictional pictures.
- An AI identification result. No AI request was paid for; the only AI screen is the real refusal for an account without AI.
