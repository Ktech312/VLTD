# Mobile closeout, final (2026-10-30)

Emulation only: Chrome phone emulation at 390, 360 and 320 px wide on the live site (vltd.app), as synthetic collectors that were removed afterwards (vault total back to 3,477). Not a physical phone.

## App changes (all on main; phones only unless noted)
| Item | Commit | What changed | Result |
|---|---|---|---|
| Touch-area overlap | b5700dc | 12 px row gap between wrapped compact pills (Vault/Insights sub-nav, page-header actions) | every compact pill 44 px tall at all three widths |
| 6 px corners | cd402e3 | the theme rule that forced 8 px on every class containing "pill" now uses the 6 px control corner; native select rule too | Tools, Items, For Sale, Sold, Insights, Goals, Insurance, Filter and Sort read 6 px (phone and 1280); round buttons unchanged |
| Install prompt | b5700dc, c4a0a77 | room under the last content 108 px (140 px with iOS steps), prompt hides while a menu is open | see "Install prompt" below |
| Bug button | c77f155 | 40 px, 60 % opacity, hidden while the page scrolls (phones only) | no longer sits on content being read |
| Vault tall tile | c77f155 | tiles size to their own content; Total Value tile 236 px wide | tile about 254 px tall (was about 335); Items and the other tiles are no longer stretched |
| Home control consistency | c77f155 | "N items . Open Vault", notice actions and "Create exhibition" use the same compact phone pill as the other pages | Home pills are 32 px visual / 44 px tap |
| Remaining touch targets | c77f155, c4a0a77 | Insights links ("View all", stat numbers, insurance packet) and the Vault wall chip row get 44 px tap areas without moving anything; wrapped gap pills get the row gap | fixed (see list below for what is not) |

## Coverage
Home, Vault, Exhibitions, Discover, Insights, the More sheet and the Add chooser, at 390, 360 and 320 px: tops and ends (`sheets/phone-390.jpg`, `phone-360.jpg`, `phone-320.jpg`, `menus.jpg`). No sideways overflow on any of them; nothing hidden under the bottom bar (the last content scrolls clear, within 2 px on Home/Vault/Exhibitions/Discover as in the first audit).

## Install prompt: evidence reconciled
The first re-check reported "prompt not clear of content" and "menu rows under the prompt" while the screenshots showed it clear. Cause: that probe compared rectangles only (a hidden or faded prompt still counted, and empty wrapper elements counted as content). The probe was rewritten (`install-prompt-check.cjs` v2) to count only what is really visible and only text/controls/images that sit under it. Final run, Android-style and iPhone-style prompts, 390/360/320:
- page end, 5 pages x 3 widths x 2 modes = 30 cases plus 3 with the iOS steps open: the prompt is fully visible, nothing is under it, it never overlaps the bar or the bug button, no control's centre is covered. (One earlier case, Exhibitions, had 2 px of an empty tile border under it; fixed by the extra 4 px.)
- menus: with the More sheet or the Add chooser open the prompt is not visible at all (0 %), at all widths in both modes.

## More sheet, explicitly
At 390, 360 and 320, in both prompt modes: all 9 tiles are tappable (elementFromPoint at each centre resolves to the tile), all inside the screen, the sheet sits above the bar, the prompt is hidden behind it, and no control is covered. Tiles are about 74 px tall.

## Remaining issues (not changed)
- Header Search, Messages and Alerts buttons: 36 px wide x 44 tall (neighbours are 40 px apart, so a 44 px width would overlap).
- Home: carousel Previous/Next arrows 24 x 44; the carousel dots about 6 x 20; "Seasonal theme off" is 32 px tall by design (carousel dots sit above it); "Learn More" 76 x 24 at 360/320.
- Insights: the category breakdown rows (about 16 px tall, 23 px apart) and "See all >" (50 x 18); the 7D/1Y chart toggles 40-42 px wide.
- Discover: featured-room arrows and dots 40 x 40/44.
- Vault: the two right-hand wall chips (Sports, TCG) measure 38 px tall; the item thumbnails in lists are 42 px wide.
- The Vault Total Value tile is still about 254 px tall because it carries the full value disclosure (change basis, ghost-value note, stale-price note); shortening it would hide disclosure text.
- Dropdown menu panels and the gold buttons keep their older corner values (only controls were set to 6 px).
- "Opening Phone sentence": **not listening-verified** (measured only: word-end cut, falling pitch).
