# Mobile correction follow-up (2026-10-29)

Emulation only (Chrome phone emulation at 390 and 320 px on the live site, synthetic collector tut13, removed afterwards). Not a physical phone.

## Changes (main: b5700dc, cd402e3)
- **Touch-area overlap**: wrapped rows of compact pills had 8 to 10 px between rows, so their 44 px touch areas overlapped (Vault and Insights sub-nav first row 40 px, Exhibitions Tools and Active 42 px). On phones only, the row gap is now 12 px (LocalNav with compact pills, PageHeader action rows). Measured after: every compact pill is 44 px tall (`touch-targets-after-fix.json`, `touch-targets.cjs` in the video worktree's copy of this folder).
- **6 px corners**: a theme override (`[data-vltd-theme] body [class*="pill"]`) forced 8 px with !important on every control whose class contains "pill" (the compact pills, PillSelect dropdown buttons), so the 6 px standard never showed on them. It now uses `--radius-control` (6 px); the global native `select` rule too; PillSelect, DropdownPill triggers and `nativeSelect` also say 6 px. Live read-out (`corner-check.cjs`): Tools, Items, For Sale, Sold, Insights, Goals, Insurance, Filter and Sort dropdowns = 6 px at 390 and 1280 wide; the round + and account button stay round. Menus/panels and `btn-gold` buttons were not touched.
- **Install prompt** (Add to Home Screen): before, at the end of a page it covered the last lines (the spacer was 72 px but the pill floats about 186 px above the screen bottom), and it peeked out from behind the Add chooser. Now the spacer is 104 px (136 px with the iOS steps open) and the pill steps aside while any menu is open. Checked on Android-style and iPhone-style prompts, at 390 and 320 (`install-prompt/`, `install-prompt-check.cjs`). It never overlapped the bottom bar or the bug button.

## Not changed
- Insights stat links (26, Missing photo, Needs valuation ...) are 32 to 38 px tall; they are not compact pills.
- Video footage was not rebuilt. Phone scenes captured before the corner fix show 8 px pills.
