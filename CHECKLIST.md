# VLTD — Session Checklist (2026-08-05 night → ongoing, updated 2026-08-10)

## Barcode/QR scanning rebuilt as tap-to-scan (2026-08-10) — see HANDOFF §B
Was fully OFF since 2026-08-07 (always-on JS loop overheated the phone).
Rebuilt: tap a Scan button → one bounded ~8s burst → native BarcodeDetector
on browsers that support it (Android Chrome; NOT Windows Chrome, NOT iOS
Safari — confirmed live, both lack it), ZXing JS fallback elsewhere, never
running just because the camera's open. Also fixed a real bug found in the
same pass: `/vault/add`'s generic Identify path tried a PSA cert lookup
FIRST on any 7-10 digit barcode decode, before UPC/book/comic — an ordinary
EAN-8 product barcode (exactly 8 digits) could silently burn a real PSA
credit and mis-set Universe to Sports Cards. Reordered PSA to last-resort,
gated on non-retail formats. `tsc`/`eslint`/`build` clean.
✅ Scanning banner confirmed VISIBLE on a real device (EK: two screenshots,
"Scanning… (11 tries, 5.0s)" / "(7 tries, 3.1s)") — the earlier "no flicker"
report was a real UI-visibility gap, now fixed, not a session-never-ran bug.
✅ Swapped the fallback decoder (Safari/no-native-BarcodeDetector) from
ZXing's whole-frame decode to the region-cropping+upscaling one — a real
diagnostic ("js-fallback, 9 tries in 6.7s" against a clearly legible QR)
showed the whole-frame approach genuinely couldn't resolve a small code.
❌ Region-cropping swap wasn't enough either — same underlying (unmaintained)
decode engine as before, just cropped differently. EK: message disappeared
before it could be read/screenshotted (auto-clear was 2.5s, way too fast —
removed entirely, now stays up until the next Scan tap).
✅ **Bigger fix, done overnight while EK slept: swapped the whole fallback
engine to `zxing-wasm`** (actively-maintained WASM decoder, not the
discontinued `@zxing/library` JS port both earlier attempts used). Self-
hosted the `.wasm` binary, added a same-tick fallback to the old JS decoder
if wasm ever fails to load (so a wasm problem degrades the feature instead
of killing it), fixed a real format-name mapping gap that would've quietly
reopened the PSA auto-fire risk for wasm-decoded codes. See HANDOFF §B for
full detail.
✅ **CONFIRMED WORKING** — EK tested the exact same CGC slab that failed
twice the night before: QR decoded clean (`3905790037795`), green "code
read" badge, on the first real test of the zxing-wasm swap. The engine
switch was the real fix, not the region-cropping or banner-visibility
changes around it (those were real fixes too, just not the accuracy one).
⬜ **Not yet tried:** the horizontal barcode under the QR on the same slab
(linear format, not matrix) — worth a scan to confirm both format families
work, not just QR. Also not yet tried on Quick Add (`ScanCapturePanel`,
only regular Add's camera was tested) or on any other barcode type (retail
UPC/EAN on a normal product).
🔒 PSA lookups still PAUSED (`ENABLE_PSA_LOOKUP = false`) — this was a CGC
slab, not PSA, so this test didn't exercise that path either way. Still
needs EK's go-ahead to flip back on.

## Barcode scans now actually DO something (2026-08-11) — connects to real lookups, not device-tested yet
EK's real question: "what can scanning a barcode do at this point?" — honest
answer at the time was nothing; it just confirmed the read. All the
individual lookups (comic/vinyl/UPC/book) already existed, wired only into
the after-a-photo Identify pipeline. New `src/lib/scanners/barcodeLookup.ts`
runs those same free lookups the instant a live scan decodes a code, no
photo needed. Wired into all 3 places EK asked about:
- **`/capture`**: scan → lookup fires immediately → a real "Found via
  barcode: X" card (with cover art if available) or an honest "no match"
  message → fills blank fields only (never overwrites something already
  typed or already found).
- **`/vault/add`**: same lookup, wired into that page's own existing
  scan-review UI/status line instead of a new one.
- **Quick Add (batch)**: EK's other real question — "scan 10 barcodes then
  batch it, how will I know it worked." Each scan's lookup now starts
  immediately and shows a live tag per item in the review sheet ("Matched:
  X" / "No match" / "Looking up...") BEFORE hitting Finished — no more
  finding out only after the batch runs. A confident match also skips the
  metered AI scan for that item (already have better data for free).
⬜ **None of this has been tested on a real device yet** — build/tsc/eslint
all clean, but the actual lookups (do they return real matches, does the
Quick Add tag show up correctly, does skipping AI on a matched item work)
need a real scan of a real comic/vinyl/UPC to confirm.
🔒 **PSA lookups fully PAUSED** (`ENABLE_PSA_LOOKUP = false` in
`vault/add/page.tsx`'s `runPSALookupForCode`) — EK's explicit call, so scan
testing can't burn real PSA quota. Covers the auto graded_card flow, the
generic auto-Identify fallback, AND the manual "Look up" button. **Flip
back to `true` once decode reliability is confirmed** — don't forget this
is off, it's not a bug if a cert lookup silently does nothing right now.

Scannable done/pending list covering everything from the dead-code sweep
through the barcode/Cards/PSA/Discogs work, the Halls rebuild, and the
latest overnight cleanup pass (data-loss bug fix + dead-code/fake-data/
emoji/pill sweeps). For the full narrative detail behind any line here, see
`HANDOFF.md`; for grading/pricing API specifics, see
`GRADING_AND_PRICING_APIS.md`.

## iPhone bug report (see HANDOFF.md §B7) — all 3 FIXED
EK tested live on iPhone Safari, Light Mode, reported with a screenshot:
- ✅ **Text unreadable in Light Mode** — hero card's muted text color
  (`HomeClient.tsx`'s `C.muted`) was too dark for its own always-dark panel
  background (~2.5:1 contrast). Bumped to a lighter gray already used
  elsewhere in the app's dark theme (~6:1 contrast).
- ✅ **"Add to Home Screen" prompt banner doesn't work on iPhone** —
  `PWAInstallBanner.tsx`'s iOS branch had no tap handler at all (iOS has no
  install API to call). Tapping it now expands real step-by-step
  instructions instead of no-oping.
- ✅ **Top-left VLTD logo washed out in Light Mode** — `TopNav.tsx` had a
  hardcoded `brightness(1.4)` filter tuned only for a dark navbar. Removed
  it; the logo's own dark+gold art is legible either way.

---

## Dead-code sweep + cleanup (2026-08-05 night)
- ✅ Deleted **55 confirmed-orphaned files**, including the analytics/repo
  abstraction layer (`analytics/portfolio.ts`, `repo/vaultRepo.ts`) and the
  long tail of superseded files (`8e072ba`, `a0579ba`).
- ✅ Caught and corrected 7 false-positive "still used" hits before deleting
  anything (generic words like "tokens"/"index"/"portfolio" matching
  unrelated code, not real imports) — verified via import-path greps, not
  word matches.
- ✅ Found and removed one extra genuine orphan (`VirtualizedVaultGrid.tsx`)
  the original sweep only mentioned in passing.
- ✅ Removed dead multi-workspace-switching scaffolding (`0654a23`).
- ✅ Placed the orphaned analytics widgets on the real `/portfolio` Insights
  page instead of leaving them dead (`ff94e06`).
- ✅ `tsc` stayed clean throughout every deletion round.

## Comic scanner (2026-08-05 night)
- ✅ Wired the comic barcode/OCR scanner into Identify (`57d738d`) — triggers
  on Universe=Pop Culture + Category=Comics.
- ⚠️ **Never tested against a real physical comic** — still open, nobody has
  confirmed title/issue-number accuracy on an actual comic yet.

## Camera visual polish (earlier this week, on `/capture`)
- ✅ Native camera separated from Upload, thumbnail-selection fix, tighter
  header (`78670f1`).
- ✅ Replaced the 5-preset filter dropdown with one real Brighten toggle
  (`0f1813b`).
- ✅ 4 more `rounded-full` pill-sweep stragglers fixed (`6973b56`).
- ✅ EK confirmed Quick Add's camera (`ScanCapturePanel.tsx`) looks
  noticeably better than the regular Add camera (`CameraCapturePanel.tsx`).
- ⬜ **Not started**: making the regular Add camera visually match Quick
  Add's look (squared pills, frame corners, flash, ghost counter, thumbnail
  placement). EK's explicit ordering: barcode + Cards had to be confirmed
  working FIRST. Given barcode is still unconfirmed (see below), still
  correctly not started.

## Deploying last night's backlog (this session)
- ✅ 18 commits that were sitting unmerged on `claude/focused-mendel-94fdc9`
  (everything above, plus more) fast-forward-merged into `main` and deployed
  — none of it was live until this session.
- ✅ Tagged the pre-merge state as `backup/main-pre-focused-mendel-merge` for
  a one-command rollback if anything in that batch turns out wrong.

## Barcode / QR live detection (history — see the 2026-08-10 section at the top for current status)
- ✅ **Bug #1 (fixed):** `decodeCanvas()` discarded every successful decode
  whose payload had zero digit characters — QR codes commonly encode
  letters-only text (shortlinks, plain URLs), so those were silently
  dropped regardless of the throttle everyone assumed was the problem
  (`8aede7a`).
- ⚠️ EK tested live: **still broken, on both Quick Add and regular Add.**
- ✅ **Bug #2 (fixed):** Quick Add (`ScanCapturePanel.tsx`) had **zero**
  barcode-detection code at all — confirmed by search, not assumption.
  Added a live badge there for the first time.
- ✅ **Bug #3 (fixed):** the regular Add camera's hand-rolled per-tick
  region-cropping scan loop (already tuned three times this week) was
  replaced entirely with ZXing's own supported continuous-video-decode API
  (`decodeContinuously`, new `src/lib/scanners/liveBarcodeReader.ts`) rather
  than tuned a fourth time. Also fixed a real, separate bug found along the
  way: `BarcodeFormat` is a numeric enum, so the old format-name check could
  never match anything — `.format` was silently always `"UNKNOWN"` (`1ec2e8a`).
- ❌ **EK tested this on a real phone: still didn't work, AND overheated the
  phone.** Turned fully OFF 2026-08-07 (`c0fb750`). Superseded 2026-08-10 by
  the on-demand rebuild at the top of this file — that's the current status,
  not this section.

## TCG Cards auto-fill (this session — new feature, then a real bug fix)
- ✅ Built real-database card identification for Magic (Scryfall) and
  Pokemon (Pokemon TCG API) — both free/keyless — via new
  `src/lib/scanners/tcgCardParser.ts`, `src/lib/cardLookup.ts`,
  `src/app/api/card-lookup/route.ts` (`dc88721`).
- ✅ Wired into **both** Add flows' Identify pipelines (`vault/add/page.tsx`
  and `capture/page.tsx`), matching the existing comic-scanner pattern
  (`e88b116`).
- ⚠️ EK tested: title read correctly, DB match found, info landed in the
  description — **but Category/Subcategory never got set to "Pokemon."**
- ✅ **Root cause (fixed):** the lookup required Subcategory to already be
  the exact game *before* scanning, defeating the point of Identify. Changed
  the gate to just Universe=TCG, tries both Magic and Pokemon off the same
  OCR'd title, and now explicitly **sets** Category/Subcategory on a match
  (`1ec2e8a`).
- ⚠️ EK also couldn't find a Rarity field on `/capture`.
- ✅ **Root cause (fixed):** `/capture` has no per-universe fields at all
  (unlike `/vault/add`) — added a real Rarity input, shown when Universe=TCG,
  wired to the existing local-only `VaultItem.tcgRarity` field (`1ec2e8a`).
- ⚠️ **Not yet retested since these fixes** — needs a real Magic/Pokemon
  card scan to confirm Category/Subcategory update and Rarity shows/saves.
- ✅ Only Magic + Pokemon are covered — Yu-Gi-Oh/Lorcana/One Piece/Sports
  intentionally fall back to the old OCR-only guess (no free database exists
  for those yet, so no fake match gets invented).

## PSA graded-card lookup (this session — a whole saga)
- ⚠️ EK reported: "if this isn't free, we don't have it or it doesn't work."
- ❌ **First diagnosis (wrong):** guessed 403 = bad/expired token. Sent EK to
  regenerate `PSA_TOKEN` from PSA's developer portal and update Vercel.
- ⚠️ Still failed after a real redeploy with the fresh token.
- ✅ **Real root cause found** by having EK test PSA's API directly
  (bypassing the app): **PSA's account hit its hard 100-calls/day cap** —
  almost certainly from this session's own diagnostic testing (~45 calls
  counted honestly), not EK's (confirmed: hadn't tested in the last month).
  The token was never bad.
- ✅ Fixed the route to read PSA's actual error text instead of guessing
  from the status code (which was wrong per PSA's own documented codes
  anyway — 500 usually = bad creds, 4xx usually = malformed request, neither
  is "401/403 = token") (`694d330`).
- ⚠️ **Self-inflicted mistake, owned:** used a 15-second polling loop against
  the live PSA-backed endpoint to check deploy status, burning real quota
  for no good reason (24 calls in one loop alone). Fixed going forward — no
  more tight-loop polling against third-party rate-limited endpoints.
- ⚠️ **A live PSA token was pasted into this chat** (EK ran a direct-test
  command with the real value substituted, echoed back in the terminal
  paste). Flagged as exposed; should be rotated once things are settled.
- ✅ **Built a real safety net** so this can't recur: permanent cert cache
  (`psa_cert_cache` — a cert never needs to hit PSA twice, ever) + a hard
  internal daily budget capped at 90 (under PSA's real 100) + a circuit
  breaker that flips the moment PSA itself says quota-exceeded, so nothing
  else wastes a call finding out the same way
  (`supabase/migrations/20260806_psa_api_guard.sql`, `7872d23`).
- ✅ **Migration run by EK** — confirmed "SQL - Success." Guard is live.
- ⚠️ **Bigger unsolved problem, flagged not fixed:** PSA's 100/day is a
  developer/test-tier cap, shared across the WHOLE app. **Will not support
  a real subscriber base** (even a few dozen active users scanning slabs
  would exhaust it same-day) — needs EK to contact PSA about their paid
  commercial tier. Not something code can solve.
- ⚠️ **Retested once, deliberately (not a loop), after EK confirmed quota
  reset + migration run.** Got a THIRD distinct rejection, different from
  both earlier ones: `"Access to this API is limited to approved
  customers."` Not a bad token, not quota-exceeded — PSA is saying the
  account itself isn't approved for API access, even with a valid token.
  Generating a token via their portal apparently doesn't equal being
  granted usable access. **This needs PSA support directly**
  (`collectors-apis@collectors.com`) to clarify what "approved customer"
  actually requires and whether this account has/had it — not something a
  token refresh or redeploy can fix.

## CGC / other grading + pricing research (this session)
- ✅ Researched CGC alternatives per EK's ask: ruled out CGC's own API
  (dealer-only), GemRate (enterprise/contact-only, wrong data shape), Apify
  scrapers (wrong data shape + real ToS/legal exposure).
- ✅ **Key finding kept visible:** PSA doesn't grade comics at all (cards/
  coins/autographs only) — so CGC-comics support was never something the
  PSA work covered; it's a fully separate, still-unaddressed feature.
- ✅ Identified CardHedge as the best lead for **cards** (one API covering
  PSA+CGC+BGS+SGC cert+price lookup) — but pricing/terms are gated behind a
  contact form, and comics coverage is unconfirmed.
- ✅ Wrote `GRADING_AND_PRICING_APIS.md` as a living reference doc (not a
  one-time note) so this doesn't get lost in the next handoff rewrite.
- ⬜ **EK to contact CardHedge directly**, specifically asking whether comics
  are covered, not just cards — no reply yet as of this checklist.
- ⬜ **CGC-graded comics remain completely unaddressed**, independent of
  whatever CardHedge says.

## Discogs / vinyl lookup (this session — EK: "this has never worked")
- ✅ Audited the existing Discogs integration against the Discogs API docs
  EK pasted: User-Agent is correctly set, uses an authenticated token
  (60/min tier, not 25/min) — that part was built right from the start.
- ✅ **Found and fixed the same error-swallowing bug as PSA had:**
  `lookupVinylByBarcode()`/`lookupVinylByText()` silently returned `null` on
  any failure, so a broken token and a genuine "not in Discogs" looked
  identical. Now throws the real message through; `runVinylLookupForFile`
  shows "Discogs lookup failed: `<real reason>`" instead of the generic "No
  vinyl match found" (`7ff90b0`).
- ✅ Tested the live endpoint directly (safe to do — Discogs' 60/min limit
  is nowhere near PSA's 100/day cliff) — got **"Discogs token not
  configured. Set DISCOGS_TOKEN."**
- ⬜ **EK to check the Vercel `DISCOGS_TOKEN` value** — variable exists
  (added Jul 5) but the server sees nothing, meaning it's most likely empty
  or was never a real token. If needed, generate a fresh one at
  discogs.com → Settings → Developers (no dealer approval needed, unlike
  PSA/CGC) and update the same Vercel field.
- ⬜ **Not yet retested** — waiting on the token check above.

## Vault Halls rebuild (this session — replaced a leftover dead-session draft with EK's actual spec)
A previous session died mid-work on a "Halls" feature: a hardcoded list of
~40 pop-culture franchises (Marvel, DC, Star Wars, etc.) auto-tagging items
by keyword match, with raw emoji as hall icons. EK's real spec was
different and bigger — read it back to confirm, then built that instead:
- ✅ **Real cross-category search engine** (`src/lib/vaultSearch.ts`): type a
  term, matches appear selected by default; type another term and ITS
  matches get ADDED to the set (OR, not narrowing AND) — "Marvel" +
  "Spiderman" catches everything either finds. Searches title, subtitle,
  subject, category, universe, and every manufacturer/brand field across
  every universe (not just pop-culture) plus tags. Universe/Category
  dropdowns narrow (AND) on top. Spelling variants ("Spider-Man"/"Spider
  Man"/"Spiderman") match automatically via text normalization — no
  hand-curated list needed.
- ✅ **`/vault/halls` fully rewritten** — deselect what you don't want, name
  the rest, save as a private exhibition (the existing gallery/Museum
  system — a saved Hall is just a real gallery you can later share).
  Deleted the old franchise-registry version and the now-unnecessary
  `[franchise]` detail route + `franchiseDetect.ts` — viewing a saved Hall
  is just the existing `/museum/[galleryId]` page.
- ✅ **Real `tags` field added to `VaultItem`**, synced to Supabase (migration
  `20260806_vault_item_tags.sql`, **confirmed run by EK** — tags now persist
  for real) — the persistent half of hashtags EK's spec wanted for both
  search AND social sharing. `SocialExportSheet` already generated hashtag
  suggestions on the fly for captions but never saved them; extracted that
  logic into `src/lib/generateHashtags.ts` (shared, no more drift between
  two copies).
- ✅ **New items auto-tag themselves** on creation (both `/capture` and
  `/vault/add`) with a few of those generated suggestions, so search has
  real data to find from day one instead of depending on manual tagging.
- ✅ **Tags editor added to the item detail page** (chips + one-tap
  suggestions) for adding/removing tags on any item, including everything
  already in your vault from before this feature existed.
- ✅ **"Browse existing tags" chip row** added to the Halls search bar (most-
  used tags across the vault, tap to add as a search term) and an
  **"Auto-tag my collection" button** added for retroactively backfilling
  tags on every item that predates this feature (both were "suggested
  next, not started" as of the last update — now built).
- ⬜ **Still not tested live at all** — needs a real login. Try: search a
  term you know matches something, confirm results + pre-selection behave
  as described, save a Hall, add/remove a tag on an item page, and try the
  new "Auto-tag my collection" button.

## Overnight cleanup pass (data-loss bug fix + dead-code/fake-data/emoji/pill sweeps)
- ✅ **Real data-loss bug fixed**: `normalizeOne()` in `vaultModel.ts` is a
  strict allow-list — any `VaultItem` field missing from its return object
  gets silently dropped every time the vault reloads, and `loadRawItems()`
  immediately persists that stripped copy back to storage. Four real
  fields were hitting this: `itemType`/`itemAttributes` (the "Type"
  dropdown + "Attributes" checkboxes on `/vault/add` — saved correctly,
  then vanished on the very next reload, no sync path existed either so
  once dropped they were gone for good), `videoClip` (same local bug,
  though Supabase sync could partially recover it), and `itemCode` (the
  permanent server-assigned tracking code — got dropped by the very next
  local normalize pass after a sync merge, not just page reloads). Verified
  the fix by programmatically diffing every type field against
  `normalizeOne`'s return object rather than eyeballing it.
- ✅ **Dead-code sweep**: 11 more confirmed-orphaned files deleted (early
  AI-integration stubs, a chained dead pair, duplicate/superseded
  theme/metrics/sell-item helpers). `tsc` clean after deletion.
- ✅ **Fake-data sweep**: found and fixed 3 more instances of the same bug
  shape as prior rounds (hardcoded value sitting next to real data) —
  `watchlist/page.tsx`'s fake per-item "Value History" chart + dead
  non-clickable time-range tabs, `goals/page.tsx`'s fake "Goal Value
  Impact" chart, `more/page.tsx`'s hardcoded "1 year" tenure label (now a
  real `tenureFrom()` computed from the real signup date). Also fixed
  `HomeClient.tsx`'s home-dashboard "Collection Value" sparkline, which
  showed the exact same hardcoded "steady climb" path to every user
  regardless of their real value history — now built from the real
  `valueHistory.ts` data that already exists and is used elsewhere.
  **Found but deliberately not touched**: `community-board/page.tsx` has
  the same fake-mini-chart pattern next to real "Market Pulse"/"Volume"
  numbers — that file is explicitly Codex's per `HANDOFF.md` §0, flagging
  for whoever owns it rather than editing.
- ✅ **Pill sweep**: one real violation found and fixed —
  `museum/page.tsx`'s "Exhibit Status" modal had two `w-full` dropdowns
  for one-word options, inconsistent with the exact same file's own
  correctly-sized toolbar filters just above them.
- ✅ **Emoji sweep**: addressed the specific sites HANDOFF had deferred as
  needing real visual judgment — `kickstarter/page.tsx`'s empty-state
  rocket, `shop.tsx`'s 8 category chips + empty state (left the ~34
  individual product icons alone, genuine per-item judgment call, not
  mechanical), `v/[profileId]/page.tsx`'s local emoji map (replaced with
  the shared `universeGlyphName()` helper that already existed for this),
  and `HomeClient.tsx`'s social-platform icons/upload button/sparkle.
  Added 4 new icons to the shared `Glyph` component (rocket, globe, book,
  wrench) since none of the existing ~40 fit. **Deliberately left alone**:
  `SeasonalBanner.tsx`'s falling snowflake/ball/leaf/pumpkin particle
  animation (an intentional decorative effect, not icon substitution —
  swapping only some of a themed set to monochrome glyphs would look
  broken) and the user-chosen avatar-preset emoji (explicitly exempted).
- ⬜ **Not visually verified** — every fix here compiles/builds/server-
  renders clean, but several are real UI changes (icons, charts, a
  dropdown width) that were never seen in a browser with real data/login.
  Worth a look next time you're in the app, especially the home dashboard
  Collection Value chart and the shop page category icons.

---

## What actually needs YOUR action right now, in order
1. **Tap the new Scan button (regular Add and Quick Add cameras) on your
   iPhone AND on an Android phone if you have one.** Point at a real
   barcode/QR — confirm it decodes, confirm it does NOT heat up even after
   several bursts, and confirm the "no code found" message shows after ~8s
   if nothing's in frame. This is the rebuild from 2026-08-10 — genuinely
   new code, not a re-test of the old broken version.
2. Email `collectors-apis@collectors.com` about the "Access to this API is
   limited to approved customers" rejection — ask directly whether this
   account has approved API access, and if not, how to get it. A fresh
   token alone didn't fix it.
3. Check/fix the `DISCOGS_TOKEN` value in Vercel (empty or bad — vinyl
   lookup has never worked because of this).
4. Actually try building a Hall and tagging an item — migration's run,
   this whole feature has never been tested logged-in.
5. Test a real Magic or Pokemon card via Identify — confirm Category/
   Subcategory now update and the Rarity field shows up on `/capture`.
6. Whenever you hear back from CardHedge, bring their answer (especially on
   comics coverage) back here.
7. Once 1 and 5 above are confirmed working, the regular Add camera's visual
   match to Quick Add is next in line — not started yet.
8. Set the "Type" dropdown + "Attributes" checkboxes on a `/vault/add` item,
   navigate away and back, confirm they now actually stick (this was
   silently broken before tonight's overnight fix — worth a real check).
9. Take a look at the overnight cleanup pass in general — Collection Value
   chart on the home dashboard, shop page category icons, the Halls
   "Auto-tag my collection" button — none of it has been seen in a real
   browser yet.
