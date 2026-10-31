# Functional checklist (2026-10-30)

Live site (vltd.app), Chrome phone emulation at 390 px wide (not a physical phone), synthetic collectors, no AI of any kind (no scan or identify button was pressed). "Keyboard" = the screen made 336 px shorter while typing; a real keyboard can behave differently. Every check below was verified on the screen **and** in the database where data is saved.

Final pass: **26 of 26 checks passed** on the deployed build (`functional-results.json`, `functional-log.txt`).

## 1. Add Item: enter, save, reload
| Check | Result |
|---|---|
| Typed Item name, brand, set and a note with the keyboard up | PASS |
| Save to Vault reachable above the bar with the keyboard up; tapped it | PASS, app went to the Vault |
| Item is in the database (title, brand, set, note all stored) | PASS |
| After a reload the Vault still lists it; after a reload the item page shows title and brand | PASS |

## 2. Single upload (browser automation)
| Check | Result |
|---|---|
| The page has a plain file input (separate from the camera one) | PASS |
| A picture chosen through the automation (setFileInputFiles) attaches and shows on the page | PASS |
| Typed a name and saved: the item is in the database with its picture | PASS |
| **The native phone file picker (and the picker that `?openUpload=1` opens by itself) was NOT tested: UNVERIFIED** | not testable here |

## 3. Bulk upload
| Check | Result |
|---|---|
| Universe (Pop Culture) and Category (Comics) chosen | PASS |
| Two pictures chosen; two title fields appear; titles typed with the keyboard up | PASS |
| "Fill in by hand" opens the review with both names and "Add all 2 to Vault" | PASS |
| Edited a name and typed a value (12); "Add all 2" reachable with the keyboard up; tapped it; app went to the Vault | PASS |
| Both items in the database with their pictures, filed under Pop Culture / Comics, edited name and value stored | PASS |
| After a reload the Vault lists both | PASS |

## 4. Exhibitions
| Check | Result |
|---|---|
| Typed an exhibition title and description with the keyboard up; "Create Exhibition" enabled and reachable above the bar | PASS |
| Creating opened the new exhibition; it is in the database with the typed title and description | PASS |
| Edited the exhibition's title and description (header editor) with the keyboard up: autosaved to the database about a second later | PASS |
| Builder page fields ("Exhibit name", "Exhibit description") edited with the keyboard up; builder **Save** reachable and tapped; stored in the exhibition's `exhibition_layout` column | PASS |
| After a reload the saved title, page name and page description show | PASS |
| Not tested: adding items to the exhibition, sharing and privacy settings, the builder's other options | not covered |

## What the pass found
- **Fixed: unreadable text on three silver buttons** (Add Item "Take photo", bulk "Scan with AI to fill details" and "Add all N to Vault"). A global rule (`button { color: inherit }`) overrides the dark text class, leaving near-white text on silver (contrast about 1.3:1; the bulk Save action was barely legible). The three buttons now set their dark colour inline: measured 12.3:1 (`screens/bulk-add-all-after-colour-fix.jpg`). The global rule was left alone because changing it would restyle buttons site-wide; **about 10 other files use the same dark-on-silver class and probably have the same problem (mostly admin pages) and were not checked.**
- My first two functional passes each had one failing check that was the test's mistake, not the app's (I looked in a database table that does not exist for the builder's page fields, and used a wrong item-count rule). Both were corrected and the whole pass re-run from a clean account; no app defect behind them.

## 5. Small controls
Corrected this round (phones only, invisible except where noted): Home carousel exhibition title link (44 px area, layout unchanged), bulk-upload title fields (44 px tall).
Re-measured the five landing pages at 390/360/320 keeping each control's best reading across scroll positions (`touch-summary-landing-pages.txt`). That removed several earlier flags that were measurement artifacts at the edge of the header or bottom bar ("View all", "TCG & Non Sport Card", "Advanced" at 360, "Show priced only" at 320, "All exhibitions", "View Vault"). All compact pills are 44 px tall at every width.

**Constrained exceptions (left as they are, recorded together):**
| Control | Size | Why not expanded |
|---|---|---|
| Header Search / Messages / Alerts at 320 px | 36 wide | the logo leaves 8 px; wider areas would overlap each other or the logo |
| Account menu button at 320 px | 40 wide | same |
| Home carousel Next arrow | 40 wide | beside the Learn More button |
| Home "Learn More" | 40 tall | would reach the dots below |
| Home carousel dots; "Seasonal theme off" | about 6 x 20; 32 tall | they sit directly above each other; 11 dots cannot each be 44 wide |
| Insights category rows | 23 tall | the rows are 23 px apart; 44 would add 21 px to each of six rows |
| Vault list thumbnails | 42 wide (32 at 320) | a secondary link beside the row's title link; widening changes the row |
| Search boxes on Vault / Discover | 32 / 42 tall | text inputs, not buttons |
Nothing was redesigned to reach 44 px.

## 6. Clean-up
All synthetic accounts (tut15 to tut19) were removed by exact id: items 0, exhibitions 0, vault total back to 3,477; no leftover pictures found in the vault-images folders of those users. No paid AI was called.

## 7. Videos
Not rebuilt. Nothing a video shows changed in action or destination (Add Item Save still goes to the Vault; Take photo, Upload and Quick Add behave as shown). The only visual change is darker text on the "Take photo" button, which makes it more readable than the footage shows. Technical checks on these files (`verify.cjs`): 11 of 11 pass, 0 page turns outside narration pauses (unchanged since the last run). **Listening verification is separate and not done: the opening Phone sentence is not listening-verified, and I have not listened to any recording.**
