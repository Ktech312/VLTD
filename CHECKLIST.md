# VLTD — Session Checklist (2026-08-05 night → 2026-08-06)

Scannable done/pending list covering everything from the dead-code sweep
through tonight's barcode/Cards/PSA/Discogs work. For the full narrative
detail behind any line here, see `HANDOFF.md`; for grading/pricing API
specifics, see `GRADING_AND_PRICING_APIS.md`.

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

## Barcode / QR live detection (this session — two real root causes found)
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
- ⚠️ **Not yet retested since the mechanism swap — needs a real device test.**

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

---

## What actually needs YOUR action right now, in order
1. Email `collectors-apis@collectors.com` about the "Access to this API is
   limited to approved customers" rejection — ask directly whether this
   account has approved API access, and if not, how to get it. A fresh
   token alone didn't fix it.
2. Check/fix the `DISCOGS_TOKEN` value in Vercel (empty or bad — vinyl
   lookup has never worked because of this).
3. Test the barcode/QR badge again on a real phone (Quick Add + regular
   Add) — the scanning mechanism changed significantly tonight.
4. Test a real Magic or Pokemon card via Identify — confirm Category/
   Subcategory now update and the Rarity field shows up on `/capture`.
5. Whenever you hear back from CardHedge, bring their answer (especially on
   comics coverage) back here.
6. Once 3–4 above are confirmed working, the regular Add camera's visual
   match to Quick Add is next in line — not started yet.
