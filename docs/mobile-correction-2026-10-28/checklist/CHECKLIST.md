# Mobile checklist (2026-10-30)

Everything below was checked on the live site (vltd.app) in Chrome phone emulation at 390 and 320 px (the five landing pages and both menus also at 360), as synthetic collectors that were removed afterwards (vault total back to 3,477). It is emulation, not a physical phone. The on-screen keyboard is emulated by shortening the screen by 336 px; a real keyboard (especially iOS Safari) can behave differently.

Status words: **Done** = changed and re-measured. **Checked, no change needed** = measured and fine. **Left as is** = measured, reason given. **Not done** = not covered.

## 1. Bug button covering content after scrolling stops
| Item | Status | Evidence |
|---|---|---|
| Phone: floating button shows only when the page is scrolled to its end, where 44 px of room is reserved under the last content; hidden everywhere else | **Done** (662e9cf, a5a151b) | `reports/bug-log.txt`: Home, Vault, Exhibitions, Discover, Insights, Add Item at 390 and 320: hidden/not tappable mid-page, visible and tappable at the end, nothing under it |
| Report a bug stays reachable: Account menu > Support opens the same dialog (text box and Send report present) | **Done** | same log; at 320 the Support row is below the visible part of the scrolling menu (scroll to reach it), at 390 it is visible |
| Tap area 44 px (button is 40 px) | **Done** | `reports/*-log.txt` ("Report a bug" no longer listed) |
| Desktop | unchanged (rule applies below 640 px only) | |

## 2. Remaining small controls from the last report
| Control | Status |
|---|---|
| Header Search, Messages, Alerts | **Done at 350 px and wider**: 40 px buttons, 44 px tap areas that meet. **Left as is at 320 px** (36 wide): the logo leaves only 8 px, 44 would overlap the logo or each other |
| Home carousel Previous arrow | **Done** (44 wide). **Next arrow 40 wide** (a 44 area would overlap the Learn More button beside it) |
| Home carousel dots | **Left as is** (5 px dots, about 6 x 20 tap area): 44 px dots cannot fit 11 dots, and a taller area would overlap the Seasonal theme switch below |
| Home "Seasonal theme off" | **Left as is**, 32 px tall by design (the dots sit directly above) |
| Home carousel "Learn More" | **Done** (40 px tall; 44 would touch the dots' area) |
| Insights breakdown rows | **Done within their spacing**: tap height now 23 px (row pitch, was 16) with no gap and no overlap; 44 would need 21 px more per row (6 rows) |
| Insights "See all" (Goals) | **Done** (44 tall) |
| Insights 7D / 1Y / 30D / 90D | **Done** (44 wide minimum) |
| Discover featured-room arrows and the room dots | **Done** (44 x 44 areas; dots 44 wide) |
| Vault wall chips vs the Advanced button (overlapping areas) | **Done** (6 px more space on phones): chips 44 tall at 390; **"Advanced" measures 35 at 360 px only** (not fixed) |
| Add Item field lock toggles (28 x 16) | **Done** to 44 x 30 (limited by the label row; 44 tall would cover the field below) |
| Add Item Take photo / Take Real Photo / Upload at 320 | **Done** (wrapped rows now 12 px apart) |
| Quick Add header: Universe / Category / Frame / Camera and the scan icon | **Done** (rows 12 px apart, scan icon 44 area) |
| Halls "back to Vault" link and Auto-tag button | **Done** (44 tall areas) |
| For Sale "Set" button | **Done** (it was clipped to 34) |
| For Sale readiness chips ("Condition / grade", 22 px) | **Done within their spacing**: 28 px tap area |
| Bulk upload remove (x) buttons | **Done**: they were invisible on phones (hover only); now visible with a 44 px area |
| Vault list item thumbnails (42 x 49, 32 wide at 320) | **Left as is**: a secondary link beside the row's title link; widening changes the row layout |
| Account menu button at 320 | **Left as is** (40 wide; same header limit) |
| Text links on Home/Discover (28-31 px: carousel exhibit title, "View all", "All exhibitions", "TCG & Non Sport Card 2") and "Show priced only" at 320 (28), "Open Marketplace" (18) | **Left as is** (not touched this round) |
| Compact pills (Vault nav, Tools, Exhibitions and Discover filters, Home pills, Create Exhibition) | **Checked, no change needed**: 44 tall at every width, all pages (`regression/touch-summary.txt`) |

## 3. Coverage beyond the five landing pages (`sheets/`, `reports/`)
Run twice: with a populated account and with an empty one (vault items and exhibitions removed).
| Page | Populated | Empty | Notes |
|---|---|---|---|
| Vault Items `/vault` | checked | checked | no sideways overflow, nothing hidden under the bar |
| For Sale `/vault/for-sale` | checked | checked (empty message and "Go to Vault") | chips and Set button fixed above |
| Sold `/vault/sold` | checked | checked | |
| Insights `/portfolio` | checked | checked (Smart Scan / Add manually) | |
| Goals `/goals` | checked | checked | |
| Insurance `/insurance` | checked | checked | |
| New exhibition `/museum/new` | checked | checked | |
| Build from search `/vault/halls` | checked | checked ("Your halls are empty") | |
| Exhibition builder `/museum/<id>` | checked (existing exhibition) | checked (new empty exhibition) | |
| Add Item `/capture` | checked | checked | |
| Quick Add `/vault/quick` | checked | checked | camera screen fills the page down to the bar by design |
| Upload single `/capture?openUpload=1` | checked | checked | renders the Add Item page; the system file picker cannot be driven in emulation |
| Upload batch `/vault/bulk` | checked | checked, plus with two photos chosen | |
Per page: horizontal overflow 0 and nothing cut at the right edge on all 52 page/state/width runs (13 pages x 2 states x 2 widths), and on the landing-page runs at 390/360/320.

**Keyboard and Save access (emulated keyboard)** (`reports/*-keyboard.json`, `screens/`):
- Add Item: with the Item name field focused the field stays on screen and tappable, and Save to Vault (52 px tall) scrolls into view clear of the bar, at 390 and 320. I did not press Save.
- Bulk upload: with two photos chosen, "Fill in by hand" (44 px) is reachable and clear of the bar; it stays disabled until a Universe and Category are picked (by design). Title fields are 34 px tall.
- New exhibition: the title field stays visible; "Create Exhibition" (44 px) is reachable and clear of the bar; disabled until a title is typed (I focused the field but did not type or submit).
- Quick Add has no text field before capture; its action is the "Finished" button in the header (visible).
- Not tested: a real keyboard on a real phone; the exhibition builder's own text fields with the keyboard open.

## 4. Completed fixes kept closed
Regression run on the final build (`regression/`): 5 landing pages at 390/360/320, More sheet, Add chooser, install prompt.
- No sideways overflow; compact pills 44 px; More sheet 9/9 tiles tappable and on screen at 390/360/320; Add chooser 4/4 items tappable; install prompt fully visible with nothing under it in 33/33 end-of-page cases (Android-style and iPhone-style, including iPhone steps open), never over the bar or the bug button, hidden behind both menus. **No regression found.**
- Value disclosures: the Vault Total Value tile text (change basis, ghost-value note, stale-price note) was not touched; the tile is still about 254 px tall for that reason.

## 5. Videos
- **Materially outdated scenes this round: none.** The changes since the last video update are tap areas you cannot see, a 4-12 px shift in the header icons, 6-12 px of row spacing, and the bug button no longer showing mid-page. Nothing a narration describes changed, so no scene was recaptured and nothing was rebuilt. Desktop, Phone, Combined, Shorts and promos are the files from the previous round (local commit b3e28fc).
- **Technical video checks** (`master/verify.cjs`, last run on these exact files): 11 of 11 pass; 0 page turns outside narration pauses; no clipped samples; seek true.
- **Listening verification** (separate, not done by me): the opening Phone sentence is **not listening-verified**; I measured it (ends on a word end, falling pitch) but cannot listen. I have not listened to any of the recordings.

## 6. Items from the previous brief
| Item | Status |
|---|---|
| Remaining touch targets | see section 2 |
| Bug-button obstruction | Done (section 1) |
| Tall Vault tile | Done as far as the disclosure text allows (about 335 to 254 px; other tiles no longer stretch) |
| Home control consistency | Done (Home pills use the compact phone pill) |
| Coverage of the listed mobile screens (Home, Vault, Exhibitions, Discover, Insights and menus) | Done at 390/360/320 |
| Install-prompt evidence reconciled | Done (probe rewritten; see the header of `install-prompt-check.cjs` in this folder's parent, and `final/CLOSEOUT-FINAL.md`) |
| More sheet checked explicitly | Done (section 4) |
| Update only affected videos; preserve Desktop, accepted footage and the four local commits | Done (three phone screens recaptured earlier; nothing rebuilt now; the four commits are intact with later ones on top) |
| Opening sentence marked "not listening-verified" | Done |

## Still open (not fixed)
Header icons at 320 px, Home dots / Seasonal switch / Next arrow, Insights breakdown rows (23 px), Vault list thumbnails, "Advanced" at 360 px, "Show priced only" at 320 px, assorted text links (18-31 px) on Home and Discover, bulk title fields (34 px), Account menu button at 320 px. Not tested at all: a physical phone, a real on-screen keyboard, pressing Save on Add Item, the exhibition builder's text fields with the keyboard open.
