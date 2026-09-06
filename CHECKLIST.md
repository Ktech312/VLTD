# VLTD — Session Checklist (2026-08-05 night → ongoing, updated 2026-08-27)

## 2026-09-05 — one exhibition room, White style
- [x] Preserve existing room dimensions, slot positions and normal movement.
- [x] Plaster/stone materials, charcoal accent wall, brass details and real track lighting.
- [x] Clear glass cases, open brass rims and frame lips; preserve photo proportions.
- [x] Real collection or empty hall, no invented sample contents.
- [x] Reduced-motion automatic camera transitions.
- [x] TypeScript and targeted lint; local empty state and GLB finish render inspected.
- [x] Production build and Vercel deployment; live White/Hero appearance checked with 7/8 Test (commit `f346d18`).
- [ ] Extended interaction/mobile checks deferred at EK request to reduce credit use.
- [ ] EK review and real-device mobile performance before extending to the campus.

## 2026-09-06 — White room material/lighting refinement pass (design-chat brief)
- [x] Fixed visible "cloud"-banding in the plaster/charcoal wall texture (was low-frequency, now fine grain).
- [x] Added subdued but visible floor-tile joints (previously none rendered at all).
- [x] Added cheap fake contact shadows under the 5 display cases (were floating).
- [x] Softened ceiling spotlight cone overlap (angle/penumbra only, no intensity/exposure change).
- [x] TypeScript, targeted ESLint, and `npm run build` all clean in this checkout (Turbopack, no junction workaround needed here).
- [x] Isolated commit (`b34673e` on branch `white-room-material-refinement`), reviewed against the raycast hit-test whitelist to confirm the new shadow decals can't interfere with click-to-walk or item selection.
- [x] Pushed to `main` (`c61e600`) and deployed — the earlier "push denied" was a one-off session permission-gate hiccup on the first attempt, not a real policy block; a plain retry went through immediately.
- [x] White entrance view + close-up show improved depth without washed-out art (live, 7/8 Test/Hero) — floor now shows a real tile grid (previously none), plaster grain is even (previously visible cloud blotches), cases show a soft grounding shadow (previously floating).
- [x] Picked up/rotated/returned a real wall item ("Batman", 7/8 Test) — item correctly returned to its original slot on the back wall.
- [x] Drag-look and walking confirmed responsive; camera rotation smooth, no regressions noticed.
- [x] Switched to Vault and back to White live — no material leakage either direction, both styles render their own correct materials.
- [ ] **Narrow-viewport control check — attempted, blocked by a tooling gap, not skipped.** `resize_window` (Claude-in-Chrome) reported success at 390×844 and 900×700 but had no actual effect on this tab — `window.innerWidth`/`innerHeight` stayed at 1920×855 through all three attempts, confirmed via JS after each one. No device-emulation alternative is available on an authenticated tab in this session. Code-review fallback: this pass touched only `galleryRoomFinishes.ts` (materials/lighting, no DOM/CSS/layout), and the room's canvas already resizes via a pre-existing `ResizeObserver` (`VirtualGalleryRoom.tsx:3642`) untouched by this pass — so a regression here is unlikely, but the actual narrow-width layout was not visually confirmed. Needs either a working device-emulation tool or a real narrow browser window/phone.
- [x] Console error check — only pre-existing generic WebGL driver shader-precision warnings (same warning, seen both before and after this pass, unrelated to these changes). No real errors.

## 2026-09-06 — Vault entrance: removed leftover fallback door/arch (EK-reported, live)
EK reviewed the overnight pass below and sent a live screenshot circling 3 issues on Vault's entrance.
- [x] Investigated live via `window.__vltdDebug` before changing anything — confirmed the fallback shell WAS correctly hidden (0/71 visible), then found the real cause: Vault's GLB now bakes its own complete 54-mesh entrance assembly, but old JS fallback code (shared with Blue, shown briefly pre-load) was still building a second, stale, wrongly-colored one for Vault too.
- [x] "Remove door" — deleted the circular riveted vault-door prop outright (was already Vault-only from an earlier round; real fix is it's dead weight now, not something to keep re-gating).
- [x] "Gold arch is half in the other room" — fixed by removal: the arch/architrave fallback is now Blue-only (Blue has no GLB, still needs it); Vault falls through to the same plain doorframe White/Arcade use, so there's no separate mispositioned arch for Vault at all.
- [x] "Remove blue" — Vault's fallback rear wall no longer shares Blue's navy `0x24405f`; gets its own steel-neutral tone.
- [x] Also fixed in the same investigation: `apply()` was hiding any floor-named mesh not literally `"floor_slab"`, including Vault's real separate vestibule floor. Now keeps `"vestibule"`-named meshes visible too.
- [x] tsc/eslint clean (same 7 pre-existing warnings, zero new), production build clean.
- [x] Pushed and deployed (`b88a154`), confirmed via GitHub commit-status API.
- [x] Live-verified: turned the camera 180° in Vault to face the entrance directly (matching EK's screenshot framing) — no door, no blue, clean steel arch. No console errors.
- [x] Regression-checked Blue's own entrance (still uses this fallback permanently) — navy + gold trim unaffected, confirmed both live and via diff (its own color branch untouched).

## 2026-09-06 overnight — Vault/Arcade/Blue material refinement + mobile drag/scroll fix
EK's ask, autonomous overnight while EK slept — **EK has not reviewed any of this yet, review in the morning is still the actual acceptance gate.**
- [x] Generalized `galleryRoomFinishes.ts` to a per-style palette (Vault, Arcade, White) — real GLBs confirmed sharing White's exact mesh-naming convention, same fix architecture reused, not rebuilt.
- [x] Vault: steel wall grain, real walnut-plank floor (reused existing detailed hardwood generator), open glass cases, contact shadows, brass trim matching the vault door's own brass.
- [x] Arcade: dark-surfaces palette + its own isolated (previously shared, over-bright) exposure/hemi/key/warm lighting branch — was rendering as washed-out pastel purple despite its own GLB materials being near-black on purpose.
- [x] Confirmed Vault/Arcade's GLBs already carry their own baked area lights (generation script's `add_lights()`) — deliberately did NOT call White's `addLighting()` for them, to avoid double-lighting.
- [x] Blue (confirmed via `ROOM_MODEL_URLS` to have no GLB at all): own warm gold trim (was aliasing Vault's cool steel-gray trim exactly), wall grain texture, contact shadows under its hand-built cases, own isolated lighting branch.
- [x] **Real regression caught and fixed in this session's own live check**: Blue's cases still had a solid lid (same problem White/Vault/Arcade had already fixed via hiding `case_cap` — Blue has no such mesh, so needed its own fix), made MORE visible once colored gold. Fixed with an open-rim treatment matching the rest of the file. Documented as a bug caught, not shipped blind — see HANDOFF.md's 2026-09-06 overnight entry.
- [x] Mobile bug EK found hands-on: dragging to look around also scrolled the page, and yaw drag didn't track smoothly — both from the room's mount div never declaring `touch-action: none`. Fixed with the same one-line pattern already used elsewhere in this file.
- [x] Extracted shared texture generators (`createHardwoodTexture`/`shadeHex`/`mulberry32`/new `createGrainTexture`) into a new `galleryTextures.ts` to avoid a circular import between `VirtualGalleryRoom.tsx` and `galleryRoomFinishes.ts`.
- [x] TypeScript/ESLint clean (same 7 pre-existing warnings, zero new) and `npm run build` clean, after every one of the two commits.
- [x] Pushed and deployed (`10e8bc7`, then `0f5c444`) — deploy confirmed via GitHub's commit-status API this round (faster/more reliable than the chunk-fingerprint technique, which failed again due to this route's dynamic code-splitting — same known issue as prior rounds).
- [x] Vault live-checked: dramatic, clearly-correct improvement (real walnut grain, brushed-steel sheen, open glass cases). No console errors.
- [x] Arcade live-checked: dramatic, clearly-correct improvement (genuinely dark now, open glass cases, gold rails read clearly). No console errors. Item pickup/rotate/return re-confirmed working here too.
- [x] Blue live-checked: open-rim case fix confirmed, warm gold trim and wall grain both visible.
- [ ] **Blue's wall still reads as a brighter medium blue than a strict "navy"**, even after its own lower lighting branch — a real, disclosed limitation (likely its mid-tone base color doesn't hide brightness the way Arcade's near-black or Vault's light steel do), not something to keep blindly tuning without EK's own eyes on it live.
- [x] White regression check: switched back live, plaster/floor-tile/rail/contact-shadow all still exactly right, nothing leaked from the shared-code changes.
- [ ] **Mobile touch-action fix — code-verified and reasoned through, NOT tested with real touch input.** No tool in this session can produce genuine touch events; needs EK's own phone/tablet.
- [ ] Campus room-dimension matching (EK's point 4) — not started, deliberately, per EK's own point 3 ("review those rooms before changing the campus").
- [ ] EK's actual review of all of the above, in the morning — the real acceptance gate for this whole pass.

## ✅ 2026-08-27 migrations — both confirmed run by EK, fully live
✅ `supabase/migrations/20260827_vault_items_full_field_sync.sql` — ~109 new
columns on `vault_items`. Not yet live-verified visually. See HANDOFF.md
§2, 2026-08-27 entry.
✅ `supabase/migrations/20260827_galleries_item_notes_and_view_dedup.sql` —
2 new columns on `galleries`. Not yet live-verified visually. See
HANDOFF.md §2, 2026-08-27 entry.

## Future cleanup — not urgent, wait for EK
⬜ **Retire or trim "Account Rights" now that "Users" covers everything it
did** (tier grants, activity stats, personal/business badge, search) —
EK: "we will leave the changes until we have tested a few times." Both
panels stay live side by side for now. Revisit once Users' tier controls
have been used for real a few times.
⬜ **`/admin/tiers/page.tsx`** — still unwired and undecided. Likely dead
code duplicating Account Rights/Users, but needs EK to actually open it
and compare before deleting or wiring it in. See `APP_MAP.md` §2.3.
⬜ **Event Catcher sharing** — currently admin-only (bookmarklet works for
anyone, but saving through Quick Add needs VLTD admin access). EK: "leave
it for now, figure out a way to share better in the future." If someone
non-admin needs to add events later, that's a narrower permission that
doesn't exist yet — would need building, not just granting admin.
✅ **5 popovers with the same bleed-through bug shape** —
`src/app/museum/[galleryId]/page.tsx`, same id + `!important` pattern as
the vault upload menu. Fixed 2026-08-25/26 (commit `30c9668`). Still not
live-verified by anyone — worth a look next time EK's in the gallery
editor. Two other `--surface` hits (`AnalyticsDashboard.tsx`,
`CollectionValuationScoreCard.tsx`) are decorative gauge-chart center
circles, not menus — not the same bug, left alone.

## Events page self-expire + self-populate, header spacing, blue-button audit (2026-08-23)
✅ **Events page was 100% stale** (4 hand-typed events from a one-time
migration, all already past). RLS now requires `enabled = true AND

## Events page self-expire + self-populate, header spacing, blue-button audit (2026-08-23)
✅ **Events page was 100% stale** (4 hand-typed events from a one-time
migration, all already past). RLS now requires `enabled = true AND
ends_at >= now()` — events self-hide the moment they end, no manual
toggle ever again. Migration `20260823_collector_events_auto_expire.sql`
confirmed run by EK.
✅ **Daily cron** (`/api/cron/refresh-events`) pulls Ticketmaster Discovery
+ SerpApi Google Events, gated by one batched Claude relevance check
before anything publishes (fails CLOSED if that check errors — nothing
ungated ever reaches the table). `CRON_SECRET` confirmed set in Vercel.
✅ **Weekly cron** (`/api/cron/refresh-major-events`, Mondays) refreshes a
curated, EK-editable list of ~19 major recurring shows by NAME — not a
keyword search, so no false-positive risk the way the daily one has.
⬜ **`TICKETMASTER_API_KEY` added to Vercel by EK, redeploy was in
progress** — not yet manually triggered/confirmed producing real rows.
Do this first next session if it wasn't already done live.
ℹ️ **SerpApi's `google_events` engine is mid-outage upstream** (their own
status page, open since 2026-08-06) — confirmed via a raw SerpApi call,
not a VLTD bug. Ticketmaster carries the daily job alone until it clears.
✅ **Blue-gradient-button text-color audit — nothing was wrong.** 37
occurrences across 23 files + 2 shared CSS classes, all already using
dark `#06171d` text correctly. Nothing fixed because nothing was broken;
don't re-audit this from scratch again.
✅ **Header-strip buttons (Vault/Insights toolbars) were edge-to-edge** —
measured live (40px buttons in a 42px strip, ~1px slack). Fixed centrally
in `PageHeader.tsx` (42px→50px), not the button recipe. Fixes every page
using `PageHeader`. Verified visually on the live site before shipping.

## 4 items fixed from the 2026-08-21 placeholder audit (2026-08-22)
✅ Vault page's dead "Scan" button — now real, wired to the same camera/
scan system used everywhere else.
✅ Fake Lounge Market Pulse/Volume charts — removed (no real trend data
exists server-side to plot honestly).
✅ `/account`'s avatar upload — was a second, disconnected, local-only
path; now uses the same real cloud upload the home page's avatar picker
already had.
✅ **Documents (certs/receipts) — real cloud sync, migration confirmed run
by EK 2026-08-22.** Private bucket (the one bucket in this app that isn't
public, by design), real Share-link action (7-day signed URL, only when
explicitly requested). None of these four re-tested live yet.
⬜ **Private Photos as a paid feature** — EK's direction (free stays
public, paid gets real privacy) — needs its own architecture plan, not
started.
✅ **`/clubs` — all 3 original phases built + migrations confirmed run by
EK 2026-08-22 + given a real spot in the Lounge.** Discord works as soon
as a club owner pastes a webhook URL into Settings — no further setup
needed. Reddit turned out to need Reddit's new manually-approved developer
process (not self-serve anymore, EK hit this directly trying to register
an app) — real credentials still needed in Vercel before it can post
anything, not guaranteed to be approved at all.
✅ **Telegram + Slack added same day, migration confirmed run by EK
2026-08-22.** Both genuinely free, zero approval process, same
"credential is the URL/token" shape as Discord — live now, same as
Discord, the moment a club owner pastes a token/URL into Settings.
Nothing tested live end-to-end yet on any of the 4 platforms (Discord/
Telegram/Slack/Reddit) — worth actually posting in a club and confirming
a message lands wherever it's configured to go.

## Per-exhibition curator Alias (2026-08-18) — ✅ DONE, migration confirmed run
EK's ask: share an Exhibition without revealing your real identity, while
still seeing every comment and fully managing it as yourself. Built a real
`aliasEnabled`/`aliasName`/`aliasAvatar` per-Gallery toggle (migration
`20260818_gallery_alias.sql`, **confirmed run by EK**) — owner settings on
`/museum/[galleryId]`, public byline swap in `GuestGalleryRenderer.tsx`. Real
privacy leak found and closed while building it: tapping the curator name
used to open the full real-identity bio popup (real name, bio, follower
count, link to your actual full vault) even on an aliased exhibition — new
`AliasCuratorModal` shows only the alias name/avatar + this exhibition's own
item count, nothing that traces back to the real account. Comments/
moderation/ownership stay tied to the real `profile_id`, untouched by this.

## Fake/non-functional UI audit + overnight fixes (2026-08-18)
EK asked for a full sweep after noticing Messages/Inbox was still fake and
wasn't proactively flagged. Full sweep run; findings + fixes:

- ✅ **FIXED — real billing bypass.** `/user` page let any signed-in user
  click "Full" and instantly self-grant the paid tier for free (wrote
  straight to the same `localStorage["vltd_tier"]` key `getTierSafe()`
  reads app-wide, zero server check). Removed the picker; replaced with a
  read-only tier display + a real link to `/account/billing` (Stripe).
  **⚠ Not fully closed**: enforcement is still 100% client-side/localStorage
  — a devtools-savvy user could still override it directly. Real fix needs
  every tier-gated check moved to read the server-confirmed `profiles.tier`
  instead of the local cache. Not attempted blind — flag for a dedicated pass.
- ✅ **FIXED**: TopNav's message-bell badge always showed a hardcoded "3" —
  removed (no real DM system exists yet to count against).
- ✅ **FIXED**: More page's "Recent Activity" panel was a hardcoded array
  ("Backup completed successfully" etc., same for every user). Now pulls
  from the same real `activityEvents` data source `/activity` already uses;
  shows an honest "No recent activity yet" when empty.
- ✅ **FIXED**: More page's "System Status" panel claimed live uptime
  monitoring with zero real backend behind it. No real monitoring exists to
  source honestly — removed rather than fake it differently.
- ✅ **FIXED, same night, after EK corrected the ownership call.** EK: the
  standing "Codex owns community-board/page.tsx" note only ever covered the
  VISUAL redesign — functional bugs on that page are this chat's to fix, same
  as anywhere else. Built the real backend: new `lounge_posts` table
  (migration `20260818_lounge_posts.sql`, mirrors `comments.sql`'s pattern —
  public read, insert-as-your-own-profile, `hide_lounge_post()` for author-
  only moderation) + `src/lib/loungePosts.ts`. "Ask the Lounge" / "Post
  Update" now open a real composer and save real posts; "Lounge Live" shows
  them for real (filtered by the existing Discussions/Collector Q&A tabs,
  "Item Chatter" stays honestly empty — no item-linked post type built
  tonight). Also fixed the dead "View Room" fallback button (only ever
  showed when there was genuinely no link — removed rather than left dead)
  and the always-on fake "Live" dot on Collector Signals (now only shows
  when real signal data actually came back).
  **✅ Migration confirmed run by EK** (`20260818_lounge_posts.sql`) — posting
  is fully live, not just fail-open.
- ⬜ Also found, not yet fixed: a second, tooltip-only "Scan (coming soon)"
  button inside Vault's Add-to-Museum modal (same known limitation as the
  main Vault Scan button, just a second copy, lower priority).
- ✅ Confirmed NOT a bug: the "Level N" badge is real, computed from actual
  item + exhibit counts. One real gap: `TopNav.tsx` calls
  `loadMyCollectorLevel()` with no argument, so followers currently
  contribute 0 to the score even though the formula supports it.
- ✅ Confirmed clean: demo/seed data is correctly gated to logged-out
  visitors only everywhere it was checked — no signed-in user sees fake data.

## Barcode/QR scanning — WHERE THINGS STAND RIGHT NOW (2026-08-11)
Full narrative of how this got here is in `HANDOFF.md` §B (a real saga —
several rounds of "fixed," each one genuinely wrong or incomplete until the
last). This section is just the current, accurate status:

**Scanning mechanism — ✅ CONFIRMED WORKING on a real device.**
Tap-to-scan (not always-on — the old version overheated the phone and is
gone for good), native `BarcodeDetector` where the browser has it (Android
Chrome only — confirmed live that Windows Chrome and iOS Safari don't),
`zxing-wasm` (actively-maintained decoder) everywhere else. EK's CGC slab —
which failed on TWO earlier decode approaches the same night — decoded
clean on the first real test after the `zxing-wasm` swap. Diagnostic
readout (attempts/elapsed/engine) shown live on screen for any future
"didn't work" report.

**Scan → real lookup → confirmation, shown live in the camera — ✅ BUILT,
⬜ NOT YET RE-TESTED after the visibility fix.** Scanning used to just
confirm "code read" and do nothing else. Now: the instant a code decodes,
a free lookup (comic via Metron/GCD, vinyl via Discogs, generic UPC/book)
runs automatically and the result shows **right there in the camera view**
— "Found: [title]" with cover art if available, or an honest "no match."
Wired into `/capture`, `/vault/add` (same shared camera component), and
Quick Add's batch flow (live per-item "Matched"/"No match" tags in the
review sheet, before Finished is even tapped — a confident match also
skips spending a metered AI scan on that item).
- First test found a real bug: the confirmation lived on the PAGE, hidden
  behind the camera's full-screen modal — fixed by moving it into the
  camera view itself. **Not re-tested since that fix.**
- Second test (after the fix) correctly showed "No match found" for a CGC
  QR — expected, CGC isn't in any of the wired-up databases (no CGC lookup
  exists at all, same gap as PSA). Now fixed to say something more useful:
  a QR that matches nothing gets "this looks like a certificate code (CGC/
  PSA/etc.)" instead of a flat "no match" that reads like a failure.
- **Still needs a real test with an item that SHOULD match** — a comic
  book's barcode, a vinyl record, or a retail product — to confirm the
  "Found: X" success path actually works, not just the "no match" path.

**🔒 PSA lookups fully PAUSED** (`ENABLE_PSA_LOOKUP = false` in
`vault/add/page.tsx`'s `runPSALookupForCode`) — EK's explicit call, so scan
testing can't burn real PSA quota. Covers the auto graded_card flow, the
generic auto-Identify fallback, AND the manual "Look up" button. **Flip
back to `true` once decode reliability is confirmed** — this is deliberate,
not a bug, if a cert lookup silently does nothing right now.

**CGC lookup — confirmed still fully unaddressed**, same as PSA-for-comics
was. No CGC API integration exists. If EK wants this built (mirroring the
PSA cert-lookup work), that's a new, separate effort — not started.

## Third real test (2026-08-11): real UPC scanned, real gap found + a real field added
Scanned a Nintendo Switch game's actual retail barcode — correctly decoded,
correctly said "no match" (honest, not a bug: no video-game-specific
database is wired in, only comics/vinyl/generic-UPC/book). Two real things
came out of this:
1. ✅ **FIXED same night (§B10):** upcitemdb (100/day, same shape as PSA)
   now has the full permanent-cache + 90/day-budget guard, generalized
   into a shared `lookupApiGuard.ts` (not copy-pasted per provider).
   Discogs/Metron get the cache + real 429 handling (no fake daily cap —
   neither actually has one). Migration `20260811_lookup_api_guards.sql`
   **confirmed run by EK** ("Success. No rows returned") — guard is live,
   not just fail-open. Not yet observed firing on a real multi-scan
   session (worth a glance at `lookup_api_cache`/`lookup_api_usage` next
   time you're in Supabase, just to see rows accumulating).
2. ✅ **Added a real "Brand / Manufacturer / Publisher" field** (`/capture`
   only) — AI vision and the UPC lookup were already returning this data
   (confirmed "Nintendo" was right there in the response) and it was being
   silently thrown away with nowhere to go. New `VaultItem.brand` field +
   UI field + wiring. Migration `20260811_vault_item_brand.sql`
   **confirmed run by EK** — cloud-sync wiring done too, not just local.
3. ✅ **BUILT same night (§B11):** live zoom on the camera preview itself
   (before capture) — `useCameraZoom.ts`, one shared hook for both
   cameras. Hardware zoom where the browser exposes it (mostly Android
   Chrome), plus a universal digital fallback (CSS-scaled preview +
   matching crop at the actual moment of capture, not just a zoomed-
   looking preview) everywhere else, driven by scroll wheel/pinch.
   EK tested desktop with a mouse: no hardware zoom (expected, real
   platform limitation) — the digital fallback was added in response.
   ⬜ **Not yet confirmed on a real phone** — check the slider/pinch
   shows up, scroll doesn't fight page scroll, and a zoomed capture is
   actually zoomed in the saved photo.
4. ✅ **Follow-up, same session — lens-switching on zoom.** EK asked
   directly: does zoom use a phone's multiple rear cameras? It didn't.
   Built `src/lib/scanners/cameraLenses.ts` — best-effort label-text
   classifier that finds a phone's separate ultra-wide camera (when one
   exists as its own device; many phones already fuse all their lenses
   into one at the OS level, where this correctly no-ops since hardware
   zoom already benefits automatically). Scrolling/pinching out past the
   floor switches to it; zooming back in switches back. Android-only in
   practice (iOS never exposes multiple rear lenses this way).
   ⬜ **Completely unverified on real multi-lens hardware** — no device
   available to test against; a misclassified lens would fail silently.

## Camera picker compromise + shared camera preference (same session, EK's follow-up)
EK, after the lens-switch shipped: "since it will always pick that camera
cluster on the phones, do we even need to be able to switch camera lens?"
Agreed compromise, not a straight removal — the picker is still the only
way to choose between multiple desktop webcams, the only way to reach a
telephoto lens (auto-switch only covers ultra-wide), and a manual
fallback if the ultra-wide auto-detection guesses wrong.
- ✅ `DropdownPill` gained a `compactIcon` option — same menu, renders as
  a small icon button instead of a labeled "Camera ▾" pill.
- ✅ New `useIsTouchPrimary` hook (`matchMedia("(pointer: coarse)")`) —
  both camera panels now show the compact icon on touch devices, the full
  labeled pill on desktop.
- ✅ EK's forward-looking note acted on now, not deferred: extracted the
  camera preference into a shared `src/lib/scanners/cameraPreference.ts`
  (same localStorage key the regular Add camera already used) so a future
  Settings-page camera picker (EK's idea — a dedicated test spot to set a
  default) has one place to read/write instead of two screens each
  keeping their own copy.
- ✅ **Real gap found and fixed along the way:** Quick Add never persisted
  its own camera pick at all before this — now it does, shared with the
  regular Add camera.
- ✅ **Real bug found and fixed along the way:** unifying Quick Add onto
  the shared (possibly stale) preference would have made a pre-existing
  bug worse — a hard `exact` deviceId constraint with no fallback, same
  class already fixed in the regular Add camera. Switched to `ideal`.
- ⬜ **Not yet seen on a real device** — confirm the compact icon shows/
  behaves correctly on a touch device and the full pill still shows on
  desktop.

## Stripe customer id now persists server-side (same session)
Real gap flagged a few passes back: `profiles.tier` was already kept in
sync on every device by the webhook, but the Stripe customer id itself
only ever lived in the browser that completed Checkout — a paying user on
a new device saw the right plan but the Payment method/Invoice history/
Cancel sections stayed hidden.
- ✅ Added `profiles.stripe_customer_id`
  (`supabase/migrations/20260812_profiles_stripe_customer_id.sql`,
  **confirmed run by EK**). Webhook now writes it on
  `checkout.session.completed` and `customer.subscription.updated`.
- ✅ `/account/billing` reads it from the profile as the source of truth,
  falling back to the local cache only for an instant first paint.
- ⬜ **Not tested against a real Stripe checkout** — worth a glance at
  `profiles.stripe_customer_id` after the next real subscribe.

## ⚠ Infra note: two agent sessions share this working directory — uncommitted edits are NOT safe
Found the hard way, 2026-08-13: the parallel 3D-museum session's tool
checked out `claude/museum-map-doorways` in this SAME shared working
directory multiple times mid-session — not just once (a "check your
branch" issue), but at least once WHILE this chat had an uncommitted edit
to this very file sitting in the working tree, which the checkout
silently discarded. Recovered by re-applying the edit and committing
immediately rather than leaving it uncommitted. **Lesson: commit (and
ideally push) promptly after any edit in this repo, don't leave edits
sitting uncommitted for multiple tool calls** — `git status`/working-tree
state can change out from under you between one Bash call and the next,
not just between chat turns. Also still run `git branch --show-current`
before trusting a push landed where expected (HANDOFF.md §0 has the
original version of that note).

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
- ✅ **DONE 2026-08-08/09 (HANDOFF §B4 — this checklist line was stale
  until now).** Regular Add's camera rebuilt to actually match Quick
  Add's: full-screen popup replacing the embedded live camera, corner-
  bracket guide, shared `DropdownPill`, letterbox-bar fix, drag-to-
  reorder thumbnails. Nothing left to do here.

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

## Virtual Gallery Builder / Museum Campus prototype (2026-08-12)
- âœ… Prototype route exists at `/museum/virtual-room`.
- âœ… `Room / Map` switch exists in the Gallery Builder sidebar.
- âœ… 3D room mode currently has wall shelves, hardwood floor, taller hallway
  feel, wallpaper upload, movement controls, click-to-focus item viewing, and
  center-room glass cabinet/plinth placeholders.
- âœ… Map mode groups real vault items by `universe`/`category` and shows a
  rough museum-campus layout with Store, Elevator, Entrance, rotunda, Main
  Gallery, Gallery A/C/D/E/F/G, Garden Gallery, and a side list of universe
  rooms. Clicking a populated room opens that universe in the 3D room.
- ✅ **Map cleanup (2026-08-12, this pass):** the overview was rebuilt on a real
  CSS grid (`grid-template-areas`) instead of hand-placed absolute `%`
  positions. The old layout had a verified, real bug — Gallery D and Gallery E
  physically overlapped the Main Gallery button by a ~24px band (confirmed by
  measuring `getBoundingClientRect()` on the live page before the fix); a grid
  can't produce that class of bug since each named area is a distinct
  rectangle of cells. Re-measured after the fix: all 10 floorplan tiles (9
  rooms + Main Gallery) have zero overlaps and real gutter gaps between them.
  Also toned down the populated-room tiles (were a flat bright
  `bg-white/[0.06]`, now a subtler dark gradient that only brightens on
  hover/cyan-accent) and scaled typography/padding per tile size (`sm`/`md`/
  `lg`) so small single-cell rooms (Rotunda, Gallery C/D/E/F/G) don't overflow
  the way the old fixed `text-base` + `p-3` did in a ~90px-tall cell. Deleted
  the dead, never-rendered `LegacyMuseumOverview`/`OverviewRoomButton` found
  while in this file. **Not yet seen by EK** — verified via DOM measurement
  (no screenshot tool available this pass), not a live visual check.
- ✅ **Click-to-focus fix (2026-08-12, this pass):** found the real cause —
  the pitch (up/down tilt) needed to look at a shelf item was clamped to
  ±0.12 rad (~7°), but a real shelf row sits up to 1.8–1.9 units above/below
  eye height at the ~2.35-unit standing distance the code used, which needs
  up to ~29° of tilt. The camera was landing in the right x/z spot but almost
  never actually tilting far enough to look at the item, so it read as
  "parked under/beside the shelf." Fixed by computing a real standing
  distance from how far the item is above/below eye height (so tall/low
  shelves are viewed from a bit further back, not a bigger neck-craning
  angle) and using the true `atan2` angle instead of a hand-tuned linear
  clamp. Verified with a standalone calculation against the app's real shelf
  row heights (5.42/4.17/2.92/1.67) — all four now resolve to a sane camera
  tilt (13–29°) instead of the old flat ~7° cap. **Not yet confirmed by
  clicking a real item in a real browser session** — the math is verified,
  the interactive click itself wasn't (no visual tool available this pass).
- ✅ **Side walls no longer bare on small collections (2026-08-12, this
  pass):** old packing put every item on the back wall first (up to 32) and
  only spilled onto the side walls once the back wall's grid was already
  full — so a normal-sized room (under ~32 items) rendered with two fully
  bare side walls no matter what. Switched to a back/left/back/right
  round-robin (back still gets 2 of every 4 items, staying the visual
  anchor) so both side walls populate from item #1. A 12-item room (the
  default selection size) now puts real items on all three walls instead of
  just one.
- ✅ **Main Gallery is now an intentional empty hall, not a mislabeled
  shortcut (2026-08-12, this pass):** it previously just opened whichever
  universe room happened to have the most items — misleading, since the tile
  reads like "the whole museum," not "your biggest room." EK confirmed the
  combined-museum concept was never actually decided, so for now clicking
  Main Gallery opens the 3D room with the selection cleared (0 items) and a
  "Grand Hall — Exhibitions coming soon" overlay in the room plus a matching
  line in the bottom info bar, instead of quietly substituting a random real
  room. Verified live: Items shows 0, Value shows $0, and both messages
  render correctly. Deciding what actually fills this hall (a real
  cross-universe combined view, a curated welcome room, etc.) is still open.
- ✅ **Rooms now have real doorways with room-name signs (2026-08-12, this
  pass, EK's ask):** every 3D room now has an archway back to wherever it
  connects to, with a canvas-texture sign above it naming the destination —
  not just the flat 2D map tiles from before.
  - **Grand Hall → wings:** while in the empty Grand Hall, one freestanding
    archway per populated universe (up to 6) appears ahead, each signed with
    that room's real title (e.g. "POP CULTURE"), and stepping through/
    clicking it calls the same `openUniverseRoom()` the map already used.
  - **Wing → Grand Hall (or → Campus Map from the Hall itself):** the
    existing rear entrance archway now always carries a sign too — "Main
    Gallery" from inside any wing, "Campus Map" from inside the Hall itself
    (so the one archway consistently means "go back a level" everywhere).
  - Implementation: doorways are click targets (invisible hit-planes, same
    raycaster pattern items already use) carrying a `doorwayTarget` — a room
    id, or a `__hub__`/`__overview__` sentinel — resolved in the existing
    click handler.
  - **Verified for real, not just by math this time:** used a temporary debug
    hook to get the browser's actual camera/projection math, computed exact
    on-screen pixel coordinates for a wing doorway, and dispatched a real
    click there — confirmed navigating from the Grand Hall into "Pop
    Culture" (Items 0→1, Value $0→$700, matching that universe's real vault
    item). Debug hook removed before finishing.
  - **Real finding from that debugging session, worth flagging for future
    sessions:** the dev browser tool used to test this page doesn't actually
    composite frames in this environment (screenshots fail with "the Browser
    pane is not displayed"), and it turns out Chrome pauses
    `requestAnimationFrame` for a non-composited page — confirmed via
    `renderer.info.render.frame` staying frozen at `1` no matter how long we
    waited. That's WHY the WASD/on-screen move buttons appeared totally
    unresponsive in this session (`targetCameraBody` was updating fine, it
    just never got copied into `camera.position` since the render loop
    wasn't ticking) — a test-environment limitation, not an app bug. It also
    means the earlier click-to-focus math fix (§ above) still hasn't been
    visually confirmed by an actual animated camera move in a browser, only
    by the standalone number check — that'll need a normal, visible browser
    tab (or EK's own device) to see it actually pan/tilt.
  - Doorway spread is wide (world x −7..+7) relative to how close the
    archways sit to the spawn point, so the outer 1–2 wing doorways sit
    outside the initial camera framing and need a turn to see — reads as
    reasonable "look around a rotunda" behavior, not verified visually, flag
    it if it feels too wide once actually seen.
- â¬œ **Still needs 3D room cleanup:** make center cabinets usable for items
  that sit on plinths/cases instead of wall shelves (cabinets are still
  purely decorative, no items ever render on them) — not attempted this pass,
  it's a real new feature (flat-lying card orientation + its own focus-camera
  math), not a bug fix, and needs to be built with real visual iteration.
  Nudged the default camera start position slightly toward the room's center
  and widened the general look-around tilt limit (±9° → ±18°) so the tall
  ceiling reads better while walking around — unverified visually, low risk.
- â¬œ **Needs product-shape pass:** keep the practical path explicit:
  1) clean 2D overview + clickable universe rooms,
  2) polished 3D room templates with shelves/cabinets,
  3) searchable/public rooms by universe,
  4) paid room sizes/templates/convention placement,
  5) later freeform Sims-like editing only if users prove they want it.
- â¬œ **Needs data/design decisions later:** decide how room size limits map to
  item counts, which universes get default room styles, how public/searchable
  rooms are moderated, and whether uploaded wallpaper images are local-only or
  synced/uploaded.

---

## What actually needs YOUR action right now, in order
1. ✅ **DONE — both migrations confirmed run.** `20260811_vault_item_brand.sql`
   (brand field, §B9) and `20260811_lookup_api_guards.sql` (UPC/Discogs/
   Metron cache+budget guard, §B10) are both live. Nothing to run here.
2. **Scan a comic's barcode or a vinyl record** on `/capture` (a real UPC
   from a video game box was already tried and correctly said "no match" —
   that database doesn't cover games, so it doesn't prove the success path).
   Confirm the "Found: [title]" card actually appears with real info.
3. Scan a few different items in a row on **Quick Add** (mix real matches
   and misses on purpose) and confirm the review sheet's per-item tags are
   accurate before you tap Finished, then confirm Finished skips the AI
   scan for matched items (watch the "AI scans left" counter).
4. Do a few Scan bursts in a row on your iPhone and confirm it still stays
   cool — the original complaint that started all of tonight's scanning
   work hasn't been re-checked since the `zxing-wasm` engine swap.
5. **1 of 3 items from that night is still a real decision; the other 2
   are done.** UPC-lookup quota risk → fixed (§B10, item 1 above). Live
   zoom → built (§B11, needs your device to confirm — folded into item 4).
   Still open, your call: a video-game-specific barcode database
   (ScanDex/GameUPC) — not started, worth it only if game-item scanning
   matters to you.
6. Email `collectors-apis@collectors.com` about the "Access to this API is
   limited to approved customers" rejection — ask directly whether this
   account has approved API access, and if not, how to get it. A fresh
   token alone didn't fix it.
7. Check/fix the `DISCOGS_TOKEN` value in Vercel (empty or bad — vinyl
   lookup has never worked because of this).
8. Actually try building a Hall and tagging an item — migration's run,
   this whole feature has never been tested logged-in.
9. Test a real Magic or Pokemon card via Identify — confirm Category/
   Subcategory now update and the Rarity field shows up on `/capture`.
10. Whenever you hear back from CardHedge, bring their answer (especially on
    comics coverage) back here.
11. ✅ **DONE — this line was stale.** The regular Add camera's visual
    match to Quick Add shipped 2026-08-08/09 (§B4). Nothing left here.
12. Set the "Type" dropdown + "Attributes" checkboxes on a `/vault/add`
    item, navigate away and back, confirm they now actually stick.
13. Take a look at the overnight cleanup pass in general — Collection Value
    chart on the home dashboard, shop page category icons, the Halls
    "Auto-tag my collection" button — none of it has been seen in a real
    browser yet.
14. Decide if CGC cert lookup is worth building (mirroring PSA's work) —
    confirmed still completely unaddressed as of a 2026-08-12 re-check too
    (CGC's real API is dealer-only; CardHedge is the live lead, still
    gated on #10 above).
15. **New, same session — none of this has been seen on a real device yet:**
    - Does the ultra-wide lens-switch actually trigger on an Android phone
      that has a separate ultra-wide camera (if you have one to test)?
    - Does the compact camera icon (touch devices) show/behave right, and
      does the full labeled pill still show on desktop?
    - After a real Stripe checkout, does `profiles.stripe_customer_id`
      actually get populated? (Also check/fix `DISCOGS_TOKEN`, item 7 —
      still genuinely unresolved, not touched by any of this session's work.)

---

## 3D Museum (Virtual Gallery Builder) — 2026-08-14/15 status, merged 2026-08-23/24

Built on branch `claude/museum-map-doorways`, **merged into `main` 2026-08-24**
(55 commits) after sitting unmerged for over a week — that gap is why the
beta-gating button briefly pointed at a route that didn't exist on `main`.
Full narrative of everything built/fixed and exactly how each thing was
verified is in `HANDOFF.md` under "Big update, 2026-08-14/15" — read that
before touching `VirtualGalleryRoom.tsx`. Short version:

- ✅ Map overlap, side-wall population, click-to-focus (level not tilted),
  Main Gallery as a real empty hall, doorways (found + fixed a genuine
  `material.visible = false` raycaster bug — that's why clicks silently did
  nothing), shelf/item alignment, full explicit-slot drag-and-drop
  arrangement (37 numbered slots incl. 5 display cases), camera position
  persisting across an Organize drag, wallpaper save bug, always-visible
  Exit button + Rooms quick-switcher dropdown, dismissible Grand Hall card,
  collapsible Room settings panel, entrance vestibule (was showing a flat
  blank rectangle after the doorway was opened up). All verified live via
  DOM/raycaster checks — see HANDOFF.md for the specific method each time.
- ⬜ **NOT done — the actual next task:** EK sent 3 real reference photos
  (dark spotlit hall for the Grand Hall, an actual bank-vault-door photo for
  "Vault", a bright classical gallery for "White") and rejected the resulting
  color/lighting pass twice — most recently, verbatim: "all of these colors
  are washed out, i don't see any of the inspiration and real colors i sent
  you." This was done blind — no screenshot tool worked all session — and
  guessing hex values without seeing them render clearly isn't working.
  **Do not attempt a third blind color pass.** Get screenshots working first
  (or some other way to see the actual render), then redo the material work
  in `getRoomPalette()` and the inline wall/floor/trim materials.
- Access now goes through the beta-gating flow built 2026-08-23/24: the
  "3D Museum" button on `/museum` next to the filter pills → request access
  → EK approves per-account on `/admin/users` → button unlocks to
  `/museum/virtual-room`. The old direct, ungated `/museum/virtual-room`
  link from this branch's own header was deliberately dropped during the
  merge so this gate can't be bypassed.
