# Mobile correction closeout (2026-10-28)

Scope: phone app only. Bar order and look kept (Exhibitions, Vault, central +, Discover, More). No desktop or site-wide style change was made in this correction.

## How it was checked (and what that does not prove)
- **Emulation, not a physical phone.** The live app (vltd.app) was driven in Chrome with device emulation (390, 360 and 320 px wide, touch events, mobile user agent, 2x pixel ratio) signed in as a synthetic collector with a populated Vault (removed afterwards; vault total back to 3,477).
- Pages: Home, Vault, Exhibitions, Discover, Insights, plus the More sheet and the Add chooser. Each page was captured at the top and scrolled to the end, at all three widths, before and after the changes. Measurements: sideways overflow, controls cut by the screen edge, controls taller than 48 px or shorter than 28 px, and where the last content ends against the bar.
- Not checked: a real phone's browser chrome, the on-screen keyboard, notches, or other phones. The bar already reserves the bottom safe area (`env(safe-area-inset-bottom)`).
- The bar only exists under 768 px by design; on a computer it is hidden (this was the earlier "bar is gone" report).

## Exact changes (all on main)
1. `753d3a6` Central + opens the existing Add chooser above the bar: Add Item, Quick Add, Upload single item, Upload batch (same destinations as the desktop row). No floating strip. Files: `BottomNav.tsx` (the + is now a menu button, same orb), `AddItemActions.tsx` (exports `ADD_CHOOSER_ITEMS`, built from the same upload options as the desktop row), `ui/ActionMenu.tsx` (new optional `align="center"`), `scripts/test-navigation.ts`.
2. `f914eea` Phone-only layout corrections:
   - `ui/PillButton.tsx`: new opt-in `PHONE_COMPACT_CLASS` (32 px visual, 44 px touch area, only under 768 px).
   - Opted in only on: Vault local navigation (Items / For Sale / Sold / Insights / Goals / Insurance) via `SectionNav.tsx` + `ui/LocalNav.tsx` prop; `ui/ToolsMenu.tsx` prop used by Vault, Exhibitions and Insights (`VaultToolsMenu.tsx`, `museum/page.tsx`, `InsightsOverview.tsx`); `ui/PillSelect.tsx` prop used by the Exhibitions filter and sort and the two Discover filters; the Create Exhibition button.
   - `ui/ActionMenu.tsx`: optional `blurPanel` (used by the Add chooser) so text behind the chooser cannot show through; `BottomNav.tsx` More sheet: same blur, top corners 14 px (was 24 px).
   - `discover/FeaturedRoomsCarousel.tsx`: the "View <room> →" label is shorter on phones, so it no longer runs past a 320 px screen.

## Results (390 / 360 / 320 px)
- No page scrolls sideways at any width (overflow 0).
- Bar height 64 px at all three widths; nothing is hidden under it. Scrolled to the end, the last content sits 0 to 10 px above the bar (Exhibitions' last placeholder tile and Discover's Share/Report row are flush; not hidden).
- Header and local-navigation pills on Vault, Insights, Exhibitions and Discover are now 32 px visual (were 44 px) on phones; the Vault header block is about 36 px shorter and the Exhibitions header about 24 px shorter (measured on the 390 px screenshots).
- Controls reported as "cut" are horizontal scrollers by design (album strips, category chips, stat tiles); the one real cut (Discover room button at 320 px) is fixed.
- Add chooser verified at 390 and 320: four entries, destinations `/capture`, `/vault/quick`, `/capture?openUpload=1`, `/vault/bulk`.

## Seen, deliberately not changed (outside "no site-wide / desktop changes")
- Vault stat tiles on a phone are tall because the Total Value tile carries four lines of detail text.
- The round bug-report button floats over the lower right of every page and can overlap text.
- `PillSelect` dropdown buttons still use an 8 px corner (the locked standard is 6 px); about 20 pages use that component.
- Home's "26 items · Open Vault" pill is still 44 px.

Screenshots: `screenshots/1-after-390.jpg`, `2-after-320.jpg`, `3-before-after.jpg`, `4-menus.jpg`, `5-scroll-ends-390.jpg`. Raw measurements: `before-report.json`, `after-report.json`. Script: `audit-phone.cjs`.
