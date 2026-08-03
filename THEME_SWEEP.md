# Theme / Pill / Background Sweep — 2026-08-01

Overnight audit of backgrounds, pill shape/color, and light+dark consistency
across every page and popup, plus cleanup/speed notes. Read the TL;DR, then the
sections. **I fixed only what was unambiguously safe** and catalogued the rest —
a blind app-wide restyle overnight is exactly how the recent regressions happened,
so the ambiguous items are listed for a quick approved pass, not changed yet.

---

## TL;DR

- **Backgrounds & theme colors are fundamentally SOUND.** The app drives all color
  through theme vars (`--bg/--surface/--pill/--border/--fg/--muted`) that get
  redefined per `.theme-light` / `.theme-dark` (also `.theme-mirror`, `.theme-purple`)
  in `globals.css`. Components that use these vars adapt to light/dark automatically.
- The many hardcoded colors I found are **overwhelmingly legitimate** — modal
  scrims (`bg-black/60`), shadows, toggle-switch knobs (`bg-white`), the print-only
  insurance page, OG social images, gradient buttons, and camera/presentation
  fullscreens (intentionally black). Auto-replacing them would break things.
- **One real theme-breaker found and FIXED:** `SellItemModal` had a solid `bg-black`
  container + colorless buttons → black box in light mode. Rebuilt with theme vars
  and standard pills. (committed)
- **The real, recurring problem is pill inconsistency** — see §2. There are *two*
  competing pill patterns in the codebase. This needs a one-line decision from you,
  then a careful migration. I did **not** blind-migrate overnight.

---

## 1. Backgrounds — verified consistent (1 fix)

- Page/surface backgrounds all use `--bg` / `--surface` / `--pill`. No per-page
  full-background violations that break the locked site background were found in
  user-facing content pages.
- Solid `bg-black` audit (the light-mode breakers): 6 hits, 5 intentional
  (BarcodeScanCamera, StreamDisplay, item Present mode, VaultInner media frame,
  a user-page media card — all deliberately black media/camera surfaces).
- **FIXED:** `src/components/sales/SellItemModal.tsx` — container `bg-black` →
  `--surface`; input `bg-black/40` → `--pill`; added z-index, backdrop-close,
  themed Confirm/Cancel pills, profit colored green/red. Now correct in both modes.

## 2. Pills — the real inconsistency (DECISION NEEDED)

Two patterns coexist across the app:

- **Canonical component** `src/components/ui/PillButton.tsx` — `rounded-[8px]`,
  `h-11 sm:h-10`, `px-4`, `text-sm`, all theme vars. Used in VaultInner and a few
  places.
- **Inline ad-hoc pills** — everywhere else, with varying shape/size:
  `rounded-[7px]` (vault header, capture filter — I aligned these this week),
  `rounded-full` (filter chips, view toggles, count chips), `rounded-xl` /
  `rounded-2xl` (some buttons/cards), and mixed padding (`px-3 py-1` vs `px-4 py-2`
  vs `h-8`).

**Why it looks inconsistent to you:** these aren't one system. Action pills,
filter chips, and toggles each drifted to their own shape/size.

**Recommendation (needs your yes):** adopt **`PillButton` as the single standard**
for *action* pills (Add/Import/Export/etc.), keep `rounded-full` only for true
chips/toggles/avatars, and migrate the ad-hoc ones to `PillButton` screen by
screen (verifying each, not blind). Say "use PillButton everywhere" and I'll do a
careful, verified migration in a dedicated pass.

Already brought to a consistent local standard this week: Vault header pills
(Export sized down; reordered), capture-screen filter dropdown (`rounded-[7px]`),
Upload→icon, removed dead Quick Add toggle.

## 3. Popups — spot-checked

Modal scrims use `bg-black/60` (fine in both modes); containers mostly use
`--surface`. `SellItemModal` was the one exception (fixed). No other rough,
unthemed modals matched the same signature.

## 4. Color-theme drift (note, not fixed) — CORRECTED 2026-08-03

- ~~`src/app/ai/review/page.tsx` and `src/app/ai/drafts/page.tsx` use a cyan
  button gradient off-brand vs the site's gold standard~~ — **this was wrong.**
  The cyan/aqua gradient (`#79E7FB→#41C6E4→#2CB1D1`) is the app's actual
  established primary-CTA color: `.vltd-action-module__block` in globals.css,
  used across 25 files including capture's own "Save to Vault" button. Gold
  (`--theme-gold`) is the accent/lock/badge color, not the primary-CTA
  standard. Recoloring these pages to gold would have made them the odd one
  out. Left as-is.
- `aiCatalogDrafts.ts` **seeded fake demo drafts** (Jordan/Charizard/Spider-Man)
  for signed-in users — violated the no-fake-data rule. **FIXED**: `loadDrafts()`
  now returns `[]` when empty; the real "No drafts yet" empty state already
  existed and needed no changes. Also deleted the unused, explicitly
  dead-labeled `src/_delete-after-testing/seedDemoIfEmpty.ts` + `src/lib/demoSeed.ts`
  (same fake-data pattern, already disconnected from the app).

## 5. Speed / cleanup opportunities (recommendations)

- **Live barcode scan** (`CameraCapturePanel`) runs `scanBarcodeFromVideoFrame`
  every 450ms on the main thread while the camera is open — a likely source of
  camera-screen sluggishness. Options: raise the interval, gate it behind a
  "scan barcode" tap, or move it off-thread. Needs a device test to confirm impact.
- **Capture image resolution** — capture uses full `video.videoWidth/Height`; if a
  device streams >2200px, the filter-apply + upload get heavy. Capping the long
  edge on capture would speed save/upload. (Only helps if the stream is very high-res.)
- The unused `handleQuickAddCapture` / `quickAddCountRef` on `/capture` are now dead
  after removing the Quick Add toggle — safe to delete in a cleanup pass.

## 6. Why I didn't blanket-rewrite overnight

The codebase is largely theme-consistent; the remaining issues are either (a) a
design decision (which pill standard) or (b) behavior changes (fake-data seed,
barcode perf). Blind-changing hundreds of hardcoded colors would have broken the
many legitimate ones. The safe fix (SellItemModal) is done; the rest is a fast,
low-risk pass once you approve the direction in §2 and §4.
