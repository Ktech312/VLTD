# Before / after screenshots: the seven annotated fixes (2026-10-17)

**Folder (exact path):** `C:\Users\EK\VLTD\docs\ui-verification-2026-10-17\screenshots\`
- `before\` = the live site before the fixes (old code).
- `after\` = the live site after the fixes, commit `f9a60dc`, except `after\5-cost-to-sell.png`, `after\cost-to-sell-whatnot-unverified.png` and `after\exhibition-share-prompt-wording.png`, which were taken on the live site after the closeout corrections (commit `0ef6c93`).

All screens use one synthetic test account (QA data, art from `public/collectibles`), 1440 x 900 desktop unless marked "phone" (a browser window at 390 px with phone emulation; **not a physical phone**). The test account was deleted afterwards.

| Your annotated image | What it shows | Before | After |
|---|---|---|---|
| 1 (item header, Share bubble) | Header card, Share button | `before\1-item-header.png` | `after\1-item-header.png` |
| 2 (Share panel) | Share panel for a private item | `before\2-share-dialog.png` | `after\2-share-dialog.png` |
| 2 (extra states) | Account refuses the change; after a confirmed save | n/a | `after\share-failure.png`, `after\share-public.png` |
| 2 (exhibition) | Same panel on an exhibition (private; refused change) | n/a | `after\exhibition-share-private.png`, `after\exhibition-share-failure.png` |
| 3 (Export for social) | 4:5 chosen: before had no preview, only a Preview button | `before\3b-export-4x5-immediately.png` | `after\3c-export-4x5-settled.png` |
| 3 (extra states) | 9:16 format; drawing failure with Try again | n/a | `after\export-9x16.png`, `after\export-error.png` |
| 4 (title + classification) | Title editor open, Universe > Category > Subcategory | `before\4-item-edit.png` | `after\4-item-edit.png` |
| 5 (Cost to Sell + Listing copy) | Selling tools for a comic | `before\5-cost-to-sell.png` | `after\5-cost-to-sell.png` (re-taken after the closeout: no Fanatics Collect for a comic, fee status line, Override fee %) |
| 5 (closeout extras) | Whatnot shown as "Unverified in part" with the reason and the Override fee % box; exhibition sharing question with the "Anyone with the link can view this exhibition" wording | n/a | `after\cost-to-sell-whatnot-unverified.png`, `after\exhibition-share-prompt-wording.png` |
| 6 and 8 (Home) | Top of Home | `before\6-home-top.png` | `after\6-home-top.png` |
| 7 and 9 (exhibitions on Home) | Exhibition block | `before\7-home-exhibitions.png` | `after\7-home-exhibitions.png` |
| 7 and 9 (extra states) | One exhibition; no exhibitions | n/a | `after\home-carousel-one.png`, `after\home-carousel-zero.png` |
| Phone (resized browser) | Item header, Share panel, Home, carousel | `before\m1-item-header.png`, `before\m2-share.png`, `before\m3-home.png` | `after\m1-item-header.png`, `after\m2-share.png`, `after\m3-home.png`, `after\phone-home-carousel.png` |

## What these do NOT show
- **Native photo sharing is SIMULATED, not device-verified.** In every test the browser's share sheet was replaced by a stand-in that recorded what would be handed over (picture files only, no link or text). No real phone share sheet was opened.
- Real touch dragging of the carousel was not tested on a device.

## Closeout 2026-10-17 (install prompt on phone)
| What | Before | After |
|---|---|---|
| "Add to Home Screen" prompt vs the floating Quick Add / Add Item / upload row (390 px, resized browser, synthetic prompt event) | `before\m3-home.png` (prompt drawn on top of Quick Add) | `after\m3-home-install-prompt-390.png`; also checked at 320 px: `after\m3-home-install-prompt-320.png` |

Measured with `scripts\overlap.cjs` (prompt box vs Add row, bottom bar and Sync pill, on /, /vault, /discover, /portfolio at 390 and 320 px): no overlap, no sideways scroll, dismissal removes the prompt and stores the 7-day pause. Resized browser, not a physical phone.
Seen at 320 px and NOT part of this fix: the Add row (Quick Add / Add Item / upload) is 262 px wide and starts about 10 px left of the screen edge, so the left edge of Quick Add is clipped on a 320 px screen. Logged in HANDOFF.md as an open item.
