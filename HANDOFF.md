# VLTD — Session Handoff (updated, sixteenth pass — Web Push confirmed live; NEW: placeholder/incomplete-feature audit in §2 — PSA/Discogs/Vault-Scan/Lounge-charts need attention, read before claiming anything is "done")

Read this top to bottom, then start on **§2 "What's LEFT."** This is written so a
brand-new chat can pick up with no prior context.

---

## 0. RULES — follow exactly (this is the source of truth)

Rules also live in the auto-memory index `MEMORY.md` (loaded each session) and the
`memory/*.md` files it points to. If this handoff and a memory ever disagree,
ask EK.

**Who you're working with:** EK, the founder. **Non-programmer.** Explain in plain
language, never jargon. Give a recommendation, not an option-dump. If something
is risky or can't be done, say so plainly.

**Hard product rules:**
- **No fake data.** Numbers/descriptions/counts/images come from real sources.
  No invented data, no stock-art stand-ins, no fake "autosaved" claims.
- **No emoji / generic icons in the UI.** Use the themed `Glyph` component
  (`src/components/ui/Glyph.tsx`) or inline stroke SVGs. NOT violations: the `✦`
  brand star, `✓`/`✕` affordances, and the user-chosen avatar-emoji feature.
- **Background locked to the site standard.** No per-page full backgrounds. Use
  the theme vars (`--bg`, `--surface`, `--border`, `--fg`, `--pill`, `--muted`).
- **"Curator" = the individual user; "collectors" = the community/market.**
- **Internal ID system is permanent** — `260312-0001-000142` (`YYMMDD-account-item`).
- **⚠ ASK BEFORE REMOVING A FEATURE.** EK was (rightly) upset when a pass removed
  the Universe selector to "simplify" without asking. Rearrange/restyle freely;
  **confirm before deleting functionality.**
- When EK gives pixel notes, **don't change pill/frame/button sizes** unless asked.
- **NEVER stretch pills / dropdowns / small buttons to fill width** (no `w-full`/
  `flex-1` when the label is short). Size them to their content (`w-auto`). EK has
  flagged this 20+ times — a "Vivid" dropdown should be ~as wide as the word, not a
  full-row box. Full-width is only for a genuine primary CTA. See [[no-full-width-pills]].

**Deploy / infra:**
- **Vercel auto-deploys on push to `main`.** Never tell EK to redeploy.
  **Deploys are SLOW right now (3–5 min, queue up).** Don't call something "live"
  until you re-checked the deployed page.
- **Supabase migrations run MANUALLY by EK** (no CI). Write idempotent `.sql`,
  ask EK to run it. **Never add a new column to the cloud row map
  (`src/lib/vaultCloud.ts`) without the migration** — unknown columns make the
  `vault_items` upsert throw.
  **✅ NO MIGRATIONS PENDING.** `supabase/migrations/20260822_vault_documents.sql`
  (private `vault-documents` storage bucket + `vault_documents` metadata
  table, see §2's placeholder-audit follow-up work) — **confirmed run by EK
  2026-08-22.** Documents (certs/receipts) now really sync to the cloud in
  a private bucket, with a real time-limited Share link -- was fully
  local-only before this.
  `supabase/migrations/20260820_conversation_prefs.sql`
  (star/hide table + RLS, and re-creates `touch_conversation_on_message()` to
  un-hide on new activity) and `supabase/migrations/20260820_fix_dm_active_profile_scope.sql`
  (fixes the multi-profile conversation-vanishing bug, see §2's Messages
  entry) — **both confirmed run by EK 2026-08-20, and re-verified live**:
  compose search, starting a new conversation (now actually persists —
  confirmed surviving a hard reload), sending, starring (persists), and
  hiding (persists) all tested working via the connected Chrome session.
  The resurface-on-hide-when-new-message-arrives trigger is unverified live
  (needs a second account to send the reply) but was reviewed and is simple.
  `supabase/migrations/20260812_profiles_stripe_customer_id.sql`
  (adds `profiles.stripe_customer_id`, see §2I) — **confirmed run by EK
  2026-08-12.** The webhook can now persist the real customer id;
  cross-device billing (Payment method/Invoices/Cancel) is live, not just
  local-cache. Still not tested against a real Stripe checkout — worth a
  glance at `profiles.stripe_customer_id` after the next real subscribe.
  Also confirmed run by EK 2026-08-18: `20260818_gallery_alias.sql` (per-
  exhibition curator Alias — hide your real name/avatar when sharing, see
  §2's Alias entry) and `20260818_lounge_posts.sql` (real "Ask the Lounge"/
  "Post Update" backend, see CHECKLIST.md for detail) — both fully live.
  `supabase/migrations/20260811_lookup_api_guards.sql`
  (generic permanent-cache + daily-budget guard for the upcitemdb/Discogs/
  Metron lookup APIs, see §B10) — **confirmed run by EK 2026-08-11.** The
  cache/budget protection is now actually live, not just fail-open.
  `supabase/migrations/20260811_vault_item_brand.sql` (the Brand/
  Manufacturer/Publisher field, §B9) — **confirmed run by EK 2026-08-11,
  cloud-sync wiring now done too.**
  `supabase/migrations/20260808_bug_report_replies.sql`
  (adds `admin_reply`/`admin_replied_at`/`updated_at` to `bug_reports`, for
  the reporter-notification feature below) — **confirmed run by EK.**
  `supabase/migrations/20260806_vault_item_tags.sql`
  (adds `vault_items.tags text[]` + a GIN index, for the Halls search/tags
  rebuild — see §B5) — **confirmed run by EK.** Tags now persist to Supabase
  for real.
  (`supabase/migrations/20260806_psa_api_guard.sql` — PSA cert-cache +
  daily-call-budget guard, see §B3 — **confirmed run by EK**, that guard is
  live. `20260803_saved_events.sql` and `20260803_profile_identity_fields.sql`
  were both confirmed run by EK on 2026-08-04 night — still fine.)
- Live site: `https://vltd.vercel.app`. `vltd.app` intentionally not set up yet.
- **AI vision is LIVE.** `ANTHROPIC_API_KEY` has been set in Vercel for months;
  `/api/ai/analyze-item` (AI Assist, bulk scan, Quick Add scan) all use it. Don't
  tell EK to set it or hedge that it "might not be configured."
- Windows + Git Bash. Commit trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**Verifying (hard-won — do this):**
- EK does NOT run localhost. Verify on the LIVE site via **Claude in Chrome**
  (`mcp__claude-in-chrome__*`, load via ToolSearch).
- **Screenshots work** (`computer {action:"screenshot"}`). **Verify VISUALLY, not
  just that DOM elements exist** — "elements present" ≠ "looks right." That gap
  cost trust earlier.
- **Mobile:** resize the browser (`resize_window` ~414×896) to see the phone
  layout EK annotates — but the true test (rear camera, etc.) is EK's own phone.
- Iterate fast without waiting on deploys: apply CSS-only tweaks live via
  `javascript_tool` and screenshot to preview a layout fix before committing.
- Always `npx tsc --noEmit` + `npx eslint <files>` + `npm run build` before push.

**⚠ PARALLEL EDITING.** Another tool (Codex) edits some files outside the chat.
Confirmed edited by it: `src/app/community-board/page.tsx` (rewritten into a "VLT
LOUNGE clubhouse"). **Re-read any file before editing it, and confirm with EK
who owns a screen.** EK is aware of this.
- **`community-board/page.tsx` split ownership, clarified 2026-08-18 by EK
  directly: Codex owns the VISUAL/design pass only. Functional bugs on this
  page are — and always were — this chat's to fix.** An earlier pass wrongly
  treated the whole file as off-limits and skipped real functional fixes
  (dead buttons, fake "Live" indicator) because of this file's design-
  ownership note — that was too broad a reading. Don't repeat that: fix real
  bugs here same as anywhere else; only hold off on restyling/redesigning it.
  **Exception, also EK-directed 2026-08-18:** the header block specifically
  (title/description/strip) now uses the shared `PageHeader` component — see
  the "Full-bleed PageHeader rollout" item below. That's a layout-mechanism
  change EK explicitly asked for, not a restyle of Codex's clubhouse content
  below it.
- **`/capture` (normal Add) is THIS chat's now** — EK confirmed 2026-07-31 that
  Codex isn't on it; this chat added multi-photo + crop-zoom there. Still re-read
  before editing in case that changes.
- **As of 2026-08-11 — not this chat's, do not touch:** `src/app/museum/
  virtual-room/`, `src/app/owner-lab/`, `src/components/owner-lab/`,
  `src/components/gallery/VirtualGalleryRoom.tsx`,
  ~~`src/app/museum/page.tsx` (modified)~~ **UPDATE 2026-08-18: EK confirmed
  the 3D-museum work is now local-only on the other chat's machine —
  `museum/page.tsx` is this chat's again.** (See the PageHeader rollout entry
  in §2 — its title/header was already converted.)
  `src/components/NavShell.tsx` (modified),
  `src/components/ProtectedRoute.tsx` (modified), plus a `marketing/` folder
  and a `product/` folder at the repo root. EK flagged the `forge/` (3D-printer
  app) placement under `/museum` as likely misplaced/unintended and is asking
  about it separately — don't try to fix or move it, that's EK's call once
  they've looked. `src/app/forge/` and `src/app/vault/forge/` are empty
  directories (no `page.tsx`), harmless, safe to ignore.
- **⚠ CHECK YOUR BRANCH BEFORE PUSHING.** 2026-08-12/13: the parallel
  session's 3D-museum work happened on a branch called
  `claude/museum-map-doorways` (not `main`) — and at some point mid-session
  this repo's checked-out branch silently changed from `main` to that one
  (not something this chat did on purpose; the parallel tool shares the same
  working directory). A commit made after that point landed on
  `claude/museum-map-doorways` instead of `main` and did NOT auto-deploy,
  since Vercel only watches `main`. Caught it because the push output said
  `claude/museum-map-doorways -> claude/museum-map-doorways` instead of the
  usual `main -> main` — recovered by cherry-picking just that one commit
  onto `main` (not merging the whole branch — those 3D-museum commits
  aren't this chat's to judge ready or push live) and switching back.
  **Run `git branch --show-current` before trusting that a push landed
  where you think it did** — don't assume you're still on `main` just
  because you were a few messages ago.

---

## 1. Where things stand (screens)

- **Add / Capture (`src/app/capture/page.tsx`)** — currently **camera-first**
  ("New Vault Item" with an inline live camera, Quick Add, builder form below).
  This chat's earlier "builder-first" version was overwritten by the parallel
  editor — **re-read the file before editing.** Approved mockups live at
  `C:\Users\EK\.codex\generated_images\019e6d3a-5dd3-7ed1-be13-942347ebb5c9\`
  (`vltd-concept-19-capture-desktop.png` = the builder/review layout).
- **Quick Add scanner (`src/components/ScanCapturePanel.tsx`)** — REBUILT to EK's
  spec (see §4). Opens from the capture screen's Quick Add. Manual fast camera.
  **Finish → metered AI fill → verify sheet → Save** (see §4, the locked flow).
- **Review sheet (`src/components/ScanReviewSheet.tsx`)** — top-anchored, ~5
  scrollable items, controlled removals; **removed items sink to the bottom**
  (Undo kept); tap a thumbnail to enlarge.
- **Verify sheet (`src/components/ScanVerifySheet.tsx`)** — the AI-fill review
  grid the scanner lands on after Finish (name/category/subcategory/value per
  item, per-item Rescan, confidence chip, scan ticker).
- **Bulk upload (`src/app/vault/bulk/page.tsx`)** — DONE (device + camera → one
  Universe → optional AI, metered → review grid → Add all).
- **Admin → Scan Limits (`src/app/admin/scan-limits/page.tsx`)** — DONE (per-tier
  + per-user AI-scan limits). Migration `supabase/migrations/20260723_bulk_scan_quota.sql`
  (EK ran it). Lib: `src/lib/bulkScanQuota.ts`.
- **VLT Lounge (`src/app/community-board/page.tsx`)** — clubhouse redesign by the
  parallel editor; not this chat's.

---

## 2. What's LEFT to do (prioritized)

### NOT DONE, READ FIRST — placeholder/incomplete-feature audit (2026-08-21)
After the DM saga above (things previously called "100% confirmed live"
that turned out to have real bugs — search visibility, no live-update, push
needing extensive debugging), EK directly asked: "any other items that have
placeholders that are really 100% done?" Full codebase audit run in
response — ranked by how likely a real user hits it and gets misled. None
of this has been fixed yet; it's a punch list, not a done-list.

**HIGH — looks fully working, isn't:**
1. **PSA cert lookup on `/vault/add`** — real input + "Look up" button, but
   `runPSALookupForCode()` (`src/app/vault/add/page.tsx` ~line 1228) has
   `const ENABLE_PSA_LOOKUP = false;` hardcoded. Clicking does nothing but
   show a quiet status message. Even if re-enabled, PSA's own API is
   currently rejecting the account ("limited to approved customers") —
   external blocker, nothing to build until they approve.
2. **Vinyl lookup (Discogs)** — `src/app/api/vinyl-lookup/route.ts:86`
   returns "Discogs token not configured" whenever the server-side
   `DISCOGS_TOKEN` is empty/bad. Per EK's own earlier note in
   `CHECKLIST.md` ("this has never worked"), this was flagged before with
   no later confirmation it got fixed. Every vinyl scan across Capture,
   Add, and Quick Add likely fails silently. **Needs checking**: is
   `DISCOGS_TOKEN` actually set correctly in Vercel?
3. **"Scan" button on the main Vault page's Add-to-Museum modal** —
   `src/app/vault/VaultInner.tsx` ~lines 1186 and 1621 — shows a toast
   "Barcode scan coming soon..." Confusing specifically because scanning
   *does* work everywhere else (Quick Add, `/capture`, `/vault/add`) — this
   one specific entry point is the dead one.

**MEDIUM — real gaps, lower traffic or partly disclosed:**
4. **VLT Lounge "Market Pulse"/"Volume" mini-charts are fake** —
   `src/app/community-board/page.tsx`: `Spark()` (~line 142) and `Bars()`
   (~line 150) always render the same hardcoded shape/heights, sitting
   right next to the REAL percentage/dollar figures from the
   `get_collector_signals` RPC. Same "hardcoded value next to real data"
   pattern already fixed everywhere else in the app except here.
5. **CGC-graded card/comic lookup doesn't exist at all** — not misleading
   (nothing implies it works), just a real gap if EK has CGC-graded
   inventory expecting a hit.
6. **Documents + avatar image uploads are honestly labeled but
   device-only** — no cloud sync/backup at all (`DocumentsSection.tsx`,
   `account/page.tsx` ~line 659). Clearing browser data or switching
   devices permanently loses them. Worth knowing since Documents is
   pitched specifically for certs/receipts — the exact thing people expect
   to be safe.
7. **`/clubs` is a real, reachable nav page that's 100% "Coming soon."**

**LOW / verified NOT an issue, listed for completeness:** the incognito
toggle on `/account` is honestly disabled with a visible "Paid feature —
coming soon" label (not misleading); Redeem Codes, 2FA/TOTP, and the
comic-release scrapers were all independently verified as genuinely real,
not stubs.

**Also unverified (self-flagged in this same file's own earlier entries,
not independently re-checked in this audit)**: the barcode scanner's
successful-match path, ScanDex end-to-end on a real device, camera zoom/
lens-switching on real Android hardware, and Vault Halls search — all
previously noted as "compiles clean but never confirmed on a real device."
Given this project's track record, worth EK spot-checking rather than
assuming built means working.

**Suggested order discussed with EK**: check/fix `DISCOGS_TOKEN` first
(quick), then fix the misleading Vault "Scan" button (wire it or remove
it), then decide on the fake Lounge charts (remove or make real). PSA
stays blocked on their approval — nothing to build there yet.

### DONE (2026-08-22) — Four items from the audit above, actually fixed
EK picked these four to start with:
1. **Vault page's dead "Scan" button** (`VaultInner.tsx`'s "Add to Museum"
   modal) — wired to the same `CameraCapturePanel` used everywhere else.
   That modal only has Front/Back photos + a bare Title field (no
   category/value — it's the lightweight quick-add path, not the full
   Quick Add scanner), so Scan here captures into whichever photo slot is
   empty and fills Title if a barcode resolves to a real lookup match.
2. **Fake Lounge charts** — removed `Spark`/`Bars` (hardcoded shapes that
   never changed) from Market Pulse/Volume. No real day-by-day trend data
   exists server-side to plot honestly (`get_collector_signals` returns one
   snapshot, not a series) — matches the other two stats in the same row
   (Active Listings, Sales), which already show just the real number.
3. **`/account`'s avatar upload was a second, disconnected, local-only
   path** — the home page's own avatar picker already uploads for real
   (the `avatars` bucket → `profiles.avatar_url`); `/account` had its own
   separate compress-to-a-data-URL-and-cache-locally code that never
   touched Supabase. Pointed `/account` at the same real upload. Also added
   `avatar_url` to `updateProfile()`'s allow-list (`auth.ts`) using an
   `"avatar_url" in patch` check rather than a truthy-string one, so
   switching back to the Emoji tab can explicitly clear a previously-
   uploaded image to null (otherwise it'd keep showing everywhere, since
   `resolveAvatarSrc` prefers `avatar_url` over `avatar_emoji` whenever
   `avatar_url` is set at all).
4. **Documents (certs/receipts) now really sync to the cloud** — real
   product conversation with EK first: every OTHER bucket in this app
   (vault-images, avatars, vault-videos) is deliberately PUBLIC ("helps
   build the site out quicker," and EK wants private-photos to become a
   PAID feature later — noted, not built yet, needs its own plan since
   flipping existing public buckets private risks breaking live sharing
   features). Documents are different: private by default, ALWAYS, for
   everyone — but still need to be shareable on purpose. Built: a new
   PRIVATE `vault-documents` bucket (the one bucket in this app that isn't
   public) + a `vault_documents` metadata table, both owner-scoped RLS.
   `vaultDocuments.ts` rewritten from IndexedDB/localStorage to real
   Supabase Storage — viewing your own doc uses a short-lived (10 min)
   signed URL, and a new `shareDocument()` generates a longer-lived (7
   day) signed link ONLY when the owner explicitly taps Share. Migration
   `20260822_vault_documents.sql` — **confirmed run by EK 2026-08-22.**
   Old local-only documents from before this change were not migrated
   (the feature never actually synced across sessions anyway, so there
   was nothing real to carry over).

None of these four re-tested live yet — same caution as everything else in
this file, "compiles clean" isn't "confirmed working."

**Still open from the same conversation, not started:**
- **Private Photos as a paid feature** — EK's direction: free accounts
  keep public photos (status quo, not a bug); paid accounts should be able
  to make photos genuinely private. Real architecture decision needed
  before building (all-images-through-signed-URLs vs. a second private
  bucket that existing photos migrate into on upgrade) — flagged, not
  scoped yet.
- **`/clubs`** — EK wants the full version: real clubs/discussion boards
  with real moderation, PLUS syncing with Discord and Reddit (not just
  link-out). Proposed build order: (1) real native clubs + discussion +
  moderation, no external dependencies; (2) Discord — post club activity
  to a webhook EK sets up in their own server; (3) Reddit — cross-post via
  a Reddit developer app EK registers. Waiting on EK's go-ahead to start
  #1 — not started.

### DONE, CONFIRMED WORKING LIVE (phone + desktop) — Web Push notifications for DMs (2026-08-21)
EK asked: can someone get alerted about a new message even with the app
fully closed, if they've installed VLTD to their home screen? Yes — **Web
Push**, genuinely free. Built: `push_subscriptions` table + RLS, a
`pg_net`-based trigger on `direct_messages` firing the instant a message
lands, `public/sw.js` (VLTD's first service worker), `src/lib/pushNotifications.ts`
(subscribe/unsubscribe), `src/app/api/push/send-internal` (the actual send
via `web-push`), and a "New message alerts" toggle in Account Settings —
**plus a banner right on `/messages` itself** (added after EK correctly
pointed out nobody would ever find the toggle buried in settings). **v1 is
DMs only** — alerts (follows/comments) are a trivial fast-follow on the
same pipeline later.

**⚠️ SECURITY INCIDENT, fully closed — read this if touching push again.**
The first migration hardcoded `PUSH_INTERNAL_SECRET` in plain text in the
trigger function, committed to this PUBLIC repo. An outside security
researcher (responsible disclosure, verified via a harmless read-only test)
and GitGuardian's automated scanner both caught it independently. Same
mistake put the full Web Push secret set (VAPID keypair included) in a
table in this file, also committed publicly.

**The lesson**: giving EK a secret value directly in chat for one-time
setup is fine (chat isn't a public repo). Writing that same value into ANY
committed file — migration, this doc, anything — is never fine on a public
repo, no matter how "internal" it feels. **Fully remediated**: everything
rotated (new VAPID keypair, new internal secret, values given only in
chat, never committed again); the secret was moved out of SQL entirely
into Supabase Vault (`supabase/migrations/20260821_push_secret_to_vault.sql`
— encrypted at rest, referenced by name, the correct pattern for any
future trigger secret); and **the two tainted commits were removed from git
history** (squashed + force-pushed at EK's explicit request, confirmed no
other sessions were using the repo at the time) — `main`'s history no
longer contains either leaked secret anywhere.

**Live-verified working, after an extensive real-device debugging session**
(worth reading if push ever seems broken again): the full pipeline —
subscribe → DB trigger → `pg_net` → send-internal → `web-push` → Google's
push service → OS notification — was confirmed delivering real
notifications to both EK's iPhone (lock screen banner) and Windows desktop
(Notification Center). Two real gotchas hit along the way, worth knowing:
1. **Claude-in-Chrome runs a separate browser/profile from EK's everyday
   Chrome** — subscribing "through Claude" doesn't subscribe the browser EK
   actually uses. Any future live push testing must be done by EK clicking
   the toggle themselves, in their own browser.
2. Chrome's background push connection can go **stale mid-session** under
   heavy testing (many reloads/profile-switches/devtools-interactions in a
   short window) — pushes get accepted server-side (`{"sent":1}`) and
   queued by Google, but silently don't arrive until Chrome fully restarts,
   at which point queued ones land all at once. Not a code bug; if push
   seems to stop working mid-testing-session, a full Chrome restart is the
   first thing to try before assuming something broke.
3. DevTools' Application → Service Workers → "Push" test button simulates
   a push locally, bypassing real encryption/delivery entirely — useful to
   confirm the service worker code itself is fine, but a "yes" there
   doesn't prove real end-to-end delivery works.

**Also fixed same day, found via this same testing**: account settings
toggles now turn **green** when on instead of gold-vs-grey ("two shades and
i don't know what is what" — EK); and `/messages` didn't live-update a new
message without leaving and reloading the page — fixed via Postgres
realtime on `direct_messages`/`conversations`
(`supabase/migrations/20260821_dm_realtime.sql`, same pattern as the
existing auction-bids realtime), confirmed run.

(The seed-character system came up again during this testing — see the
search-visibility entry below for the full context, not repeating it here.)

### DONE (2026-08-21) — Real accounts invisible to collector search (4 migrations, live-verified)
EK: "Search is not working for me, are real users in here? ... I have more
than one person signed up here but I don't see any real people." Real bug,
found and fixed live with EK's help testing back and forth — worth reading
in full since it's a good example of a bug with two separate causes layered
on top of each other.

**Cause 1 — sync only ran from two pages.** `syncPublicProfile()`
(`src/lib/publicProfile.ts`) is the only thing that writes a profile into
`public_profiles` — the table Messages' `searchCollectors()` queries. It was
only ever called from the home dashboard and `/account`. Any real account
that only ever visited a deep-linked page (EK confirmed "FreckArgent" added
real vault items via a direct link) never triggered it, so it stayed
invisible to search forever, with "Last active Never" in Account Rights
(unrelated presence-tracking system, red herring). **Fixed for good**: new
`PublicProfileSync.tsx` component, mounted in the root layout next to
`PresenceHeartbeat`, syncs the active profile on every authenticated page
load (and on profile switch) — not just those two routes, so this can't
recur for future accounts.

**Cause 2 — stale placeholder names on old rows.** A handful of accounts
(FreckArgent, Debi, cat_uh_tonick) already HAD a `public_profiles` row from
an early sync, before they'd set a real display name — stuck on whichever
placeholder branch fired at the time ("collector" or the older "User").
They later set a real name on their own account, but nothing ever re-synced
`public_profiles` since Cause 1 was still unfixed at the time. This meant
the one-time backfill (which only inserts rows for profiles with NO
existing row) correctly skipped them, leaving them stuck. Needed a second
migration to actively refresh any row still stuck on a placeholder using
the real name already sitting in `profiles.display_name`.

**Four migrations, all confirmed run and live-verified working:**
`20260820_backfill_public_profiles.sql` (one-time insert for profiles with
no row), `20260820_refresh_stale_public_profile_names.sql` (refresh rows
stuck on "collector" — subsumed by the next one), `20260820_refresh_stale_public_profile_names_v2.sql`
(widened to also catch "User" — **this is the one to trust**), and the
`PublicProfileSync.tsx` component (no migration, just a code change) fixing
the root cause going forward. All 11 of EK's real accounts (EK's
Collection, Kellogg Collection, FreckArgent, Dre, Debi, Baig, JerK,
cat_uh_tonick, aureum, Jared032, Ema) confirmed searchable and messageable
by EK directly, live.

**Also surfaced, not a bug — worth knowing:** VLTD has a pre-existing seed
character system (`/admin/characters`, 22 fictional collector personas like
"Cornelius Vanderbilt", backed by real `profiles` rows so they're
searchable/messageable too) built to make the app look populated before
there are enough real users. EK's early search tests were mostly hitting
these, which read as "fake people" until the real-account bug above was
separately diagnosed and fixed. This is intentional, pre-existing, and not
something to remove without EK asking.

### DONE (2026-08-19, overnight, EK asleep) — pill sizing, server-side tier limits, ScanDex, real direct messaging
EK asked for a full, accurate backend punch list before bed, caught that
"items 3/4 need money" kept getting repeated pointlessly, and directed:
finish item 1 (tier bypass) and item 5 (game barcode DB), then build real
Messages/Alerts. All four done overnight, committed and pushed in stages.

**1. Pill sizing standardized** — every action button inside a page's
pinstripe strip (Vault's Halls/For Sale/Import/Sold/Quick Add/Export,
Insights' Filters/Export Report, Exhibitions' filter/sort/Create, Activity's
All/Scans/Sales) now uses Lounge's own exact recipe (`px-4 py-2.5 text-sm
font-bold`, `rounded-[6px]`) — that recipe was already proven to fit the
42px strip exactly (see the PageHeader section below), so converging
everyone to it fixed the inconsistency at once instead of guessing per-page.

**2. Billing tier bypass — closed server-side, not just client-side.**
`vaultModel.ts appendItems()` and `museum/new/page.tsx` only ever checked
the CLIENT's local tier (`getTierSafe()`, a localStorage read) before
enforcing the 50-item / 4-exhibition free-tier caps — anyone could set
`localStorage["vltd_tier"]` to "FULL" in devtools and bypass both. This had
been flagged before and NOT actually fixed despite EK believing it was —
that's why it was still #1 on the list. New migration
(`20260819_server_side_tier_limits.sql`) adds `BEFORE INSERT` triggers on
`vault_items` and `galleries` that check the real `profiles.tier` column
server-side and reject (or, for gallery visibility, coerce to PUBLIC) —
the client's claim no longer matters. Only gates new inserts, doesn't touch
existing rows. **Migration confirmed run by EK 2026-08-20 — live.**

**3. Video-game barcode lookup (ScanDex).** Researched the real APIs before
writing code — GameUPC (the other option HANDOFF previously named) turned
out to be board-game/BoardGameGeek-focused, not video games, so it
wouldn't have solved the actual gap (a Nintendo Switch UPC that
upcitemdb's general catalog didn't have) — skipped it, don't revisit unless
EK specifically wants BGG/board-game mapping for a different reason.
ScanDex (barcode → IGDB metadata) is the real fit; pulled their actual API
contract from public docs (base `https://scandex.gamery.app/api/v2`,
`GET /lookup?value=<code>`, `Authorization` header). Wired into
`/api/upc-lookup` as a fallback when upcitemdb comes up empty — same
permanent-cache pattern as Discogs/Metron (no invented daily quota; ScanDex
doesn't have a confirmed hard cap, it's "free during launch period").
**Needs `SCANDEX_API_TOKEN` in Vercel** — EK has to create a developer
account at scandex.gamery.app to get one; no-ops silently until then, same
as `DISCOGS_TOKEN`.

**UPDATE 2026-08-20 — DONE, confirmed working, and a real bug found +
fixed along the way.** EK added `SCANDEX_API_TOKEN` and redeployed, but the
original test UPC still returned nothing. Traced it all the way through
(ruled out every caching layer, middleware, routing) and finally found it
in Vercel's Runtime Logs "External APIs" panel: the request was calling
`openlibrary.org` / `googleapis.com/books`, not upcitemdb at all. Root
cause, in `src/lib/bookIsbn.ts`'s `isValidIsbn13()`: it validated the
EAN-13 check-digit formula but never checked the actual Bookland prefix
(978/979) that makes an EAN-13 an ISBN specifically. That checksum
algorithm is shared by the ENTIRE EAN-13/GS1 standard, not just books, so
virtually any well-formed 13-digit product barcode also passes a valid
EAN-13 checksum — meaning almost every real UPC/EAN (not just games) was
being silently misidentified as a book and routed away from the actual
product lookup this whole time. **This was a real, pre-existing bug well
beyond ScanDex** — fixed by adding the missing `/^97[89]/` prefix check.
Verified live against two real UPCs: the original Nintendo Switch gap
(`0810148574819`) now correctly returns "Contra: Operation Galuga", and
ScanDex's own doc example (`0711719577966`) returns "Horizon Forbidden
West: Complete Edition". Nothing left to do here — token's in, bug's
fixed, confirmed working end to end.

**4. Real direct messaging + wired into the existing alerts system.**
Replaced the "Inbox coming soon" `/messages` placeholder — both it and
TopNav's chat icon had explicit code comments saying this was stubbed and
"wired later." New migration (`20260819_direct_messages.sql`):
`conversations` + `direct_messages` tables, RLS scoped to participants only,
`get_or_create_conversation()` RPC, `mark_conversation_read()` (recipient
only, mirrors the `hide_lounge_post` narrow-RPC pattern rather than a broad
UPDATE policy). New `src/lib/directMessages.ts` client lib. UI: real
two-pane inbox at `/messages`, a new `MessageButton` next to `FollowButton`
on public profiles (there was previously no way to actually start a
conversation), and a real unread badge on TopNav's chat icon (polled every
30s). The Alerts bell already had a REAL working feed (follows +
exhibition comments + bug reports, not fake) — its own code comment said
"messages can be folded in next," so this fold-in was already anticipated;
added a `"dm"` alert kind, one alert per conversation with unread messages
(not per message). Also relabeled the old `"message"` alert kind from
"Message" → "Comment" on `/notifications` since it's actually exhibition
comments — that label was genuinely ambiguous once real DMs exist too.
**Migration confirmed run by EK 2026-08-20 — live.**

**Not done, explicitly deferred (EK: "at the bottom of the list" until
there's money):**
- PSA/collectors-apis account approval — still waiting on a reply from
  `collectors-apis@collectors.com`.
- CGC cert lookup — gated on the above; CardHedge was the live lead.
Don't keep re-listing these as if they're actionable — they're not, until
EK says otherwise.

### DONE (2026-08-20) — Messages: compose-from-inbox, star, hide + a real multi-profile bug found and fixed
EK looked at the empty inbox and correctly called it out as incomplete: "no
way to send or star a conversation with a user or other basics mail/chat
features." Added all three, plus found (via live testing, not a report) a
real pre-existing bug in the DM RPCs.

**Compose/star/hide** — new migration `20260820_conversation_prefs.sql`:
`conversation_prefs` table (`profile_id`, `conversation_id`, `starred`,
`hidden`), RLS scoped to the owning profile, and `touch_conversation_on_message()`
re-created to un-hide a conversation for both participants whenever a new
message arrives (archive-then-reply behavior, not a delete). `/messages` got
a "+ New Message" button that opens a debounced collector search
(`searchCollectors()` in `directMessages.ts`, searches `public_profiles.display_name`)
so you can start a conversation without going to someone's profile first;
each row in the inbox got a hover-reveal star (starred sort to the top) and
a hide button.

**Real bug found live-testing this:** starting a conversation from the new
compose panel worked once, then the conversation vanished from the inbox on
reload. Root cause: `get_or_create_conversation()` and
`mark_conversation_read()` each resolved "the caller's profile" with an
unscoped `select id from profiles where user_id = auth.uid()` — but
accounts can own more than one `profiles` row (personal/business, see
`src/lib/auth.ts`), so that pick is ambiguous. The RPC created the
conversation under a DIFFERENT profile id than the client's actual active
profile (`getStoredActiveProfileId()`), so it was invisible to every
subsequent `listConversations()` call even though it genuinely existed.
Fixed in `20260820_fix_dm_active_profile_scope.sql`: both RPCs now take the
caller's profile id as an explicit parameter (same pattern `sendMessage`
already used) and verify it belongs to `auth.uid()` server-side instead of
guessing. Updated `directMessages.ts` and both call sites (`messages/page.tsx`,
`MessageButton.tsx`) to pass it through.

**Both migrations confirmed run by EK 2026-08-20 and re-verified live** via
the connected Chrome session: compose search returns real collectors,
starting a conversation now actually persists (confirmed surviving a hard
reload — this is the exact case that was broken before the fix), sending a
message works and updates the list preview, starring fills cyan and
persists across reload, hiding removes the row and persists across reload.

### DONE (2026-08-18) — Full-bleed PageHeader rollout: Lounge, Messages, Insights, Vault, Discover, Exhibitions
EK spotted a dark "pinstripe" strip behind the title on Lounge and Messages but
not on Exhibitions/Insights, and asked to make it deliberate: a real, full-bleed
(edge-to-edge of the browser viewport) header strip, applied everywhere.

**Root cause found:** `src/app/theme-override.css` (~line 42-48) has
`[data-vltd-theme] body header { background: var(--theme-nav-bg) !important; }`
— a global rule meant for the top nav that also matches ANY literal `<header>`
tag anywhere in the page. Lounge/Messages used a `<header>` element (got the
strip by accident); Exhibitions/Insights used a `<div>` (didn't).

**Built:** `src/components/layout/PageHeader.tsx` — a reusable component that
renders a genuinely full-bleed strip (background `var(--theme-nav-bg)`) using
the CSS breakout pattern. The colored band is a FIXED `lg:min-h-[42px]`,
independent of title size — `pt-6`/`pb-6` live on a transparent OUTER wrapper
so the vertical rhythm never gets painted into the strip (an earlier version
put padding inside the colored div and left the page's own `pt-6` in place
too, so it stacked and made the header look bigger than it should — EK caught
it immediately). Row uses `lg:items-center` (not `items-end` — was making
action buttons look off-center on rows with mixed content heights), and the
actions container has `flex-wrap` so a 3+ item toolbar (like Exhibitions')
doesn't overflow on narrow screens without breaking the fixed strip height at
`lg:`. Accepts `title`, `description`, `actions`, `contentClassName` (per-page
max-width), and `titleClassName` (optional per-page override — as of
2026-08-18 NOTHING overrides it; see below).

**FINAL policy, confirmed explicitly by EK 2026-08-18 — one title style, no
exceptions:** every page's title uses `PageHeader`'s single default
`titleClassName`: `font-serif text-[28px] leading-[1.2] sm:text-[34px]
text-[color:var(--fg)]` (28/34px, regular weight, mixed-case, `leading-[1.2]`
not `leading-none` — see the descender note below). This went through two
wrong turns before landing here, both worth knowing if this ever needs
revisiting:
1. First pass forced every page into Lounge's bold-uppercase style
   (`text-[38px] font-extrabold uppercase leading-[0.9] sm:text-[46px]`). EK
   rejected this for Insights specifically ("too bold... too much in your
   face") and had it reverted to Insights' own original `font-serif` style.
2. Second pass then let EACH page keep its own font family, only shrinking
   size to fit the 42px band (Vault/Exhibitions kept Lounge's uppercase style,
   Insights/Discover got a shrunk serif style). EK rejected THIS too — "the
   text font and size doesn't match, you didn't make them all match" — and
   when asked directly, chose **Insights' style as the universal standard**,
   not Lounge's.
So: `titleClassName` is only for a future exception EK explicitly asks for.
Do not silently diverge a page's title style again — if a title looks off on
some page, that's a global `PageHeader` default change (affecting every
page), not a per-page override, unless EK says otherwise.

**Descender note:** the original `leading-[0.9]`/`leading-none` attempts only
worked visually on Lounge's title because "VLT LOUNGE" is uppercase (no
descenders exist after the CSS transform). Mixed-case titles like "Insights"
have a real lowercase "g" descender, and `leading-none` (line-height:1)
reserves zero room for it, so it rendered poking out below the strip — EK
caught this with a screenshot too. Measured the actual fix via canvas
`fontBoundingBoxAscent`/`Descent` metrics rather than guessing: at 34px,
Inter's natural line-height is ~41px, so `leading-[1.2]` (34×1.2=40.8px)
reserves a real ~7px ink cushion. Don't reintroduce `leading-none` on any
mixed-case title.

**Events** has no standalone page-title block at all (goes straight into a
featured-event hero section) — intentionally left untouched, nothing to
convert.

**Toolbar-in-strip pattern:** every page's top-level actions (Lounge's
Ask/Post, Vault's action row, Insights' Filters/Export, Exhibitions'
filter/sort/Create) live in `PageHeader`'s `actions` slot now, not below the
strip. Secondary/tab-style navigation (Lounge's Live-feed tabs, Exhibitions'
filter-pill row) stays below the strip in the page's own content area — that
distinction (primary actions in the strip, secondary nav below it) is the
line to use when adding this pattern to a new page.

**Ownership note:** EK confirmed 2026-08-18 the 3D-museum work is now
local-only on the other chat's machine, so `src/app/museum/page.tsx` is no
longer under the "not this chat's" flag — it's this chat's now (see the old
flag at ~line 106, now superseded by this line).

**Left to sweep, if EK wants it:** any other page that hand-rolls its own page
title instead of using `PageHeader` (e.g. `/watchlist`, `/saved`, `/sales`, the
admin pages) — not audited yet.

### A. Quick Add scanner — needs device re-test after real bugs got fixed
EK tested live and found a real bug: the scanner's Universe dropdown hardcoded a
default of "TCG", so unless manually changed, everything got tagged/AI-hinted as
TCG — comics scanned as "Magic: The Gathering" etc. Fixed 2026-08-03 (see §4).
Still want confirmation the fix actually holds up on a real batch of mixed items.

### B. Barcode / QR live detection — REBUILT 2026-08-10 as tap-to-scan, native detector + JS fallback. Needs a real-device test.
**STATUS 2026-08-10: rebuilt, not yet device-tested.** Was fully OFF since
2026-08-07 (`ENABLE_LIVE_BARCODE = false`, both camera panels) after ~8 rounds
of the JS/ZXing decode loop (a) never reliably reading a code and (b)
overheating the phone by pinning the CPU continuously for the whole time the
camera was open. EK's own steer at the time: a normal camera app scans without
heating up because it hands the work to the OS, not a JS loop.

**What changed:** new `src/lib/scanners/onDemandBarcodeScan.ts`. Two real fixes,
independent of each other:
1. **Engine** — tries the browser-native `BarcodeDetector` API first
   (`window.BarcodeDetector`, feature-detected at runtime). Where it's
   supported, the OS does the decoding, not JS — near-zero CPU cost. Where
   it isn't, falls back to the existing ZXing JS loop
   (`liveBarcodeReader.ts`). **Checked live on the deployed site 2026-08-10:
   Windows desktop Chrome does NOT have `BarcodeDetector`** (confirmed via
   `'BarcodeDetector' in window` → `false` in a real Chrome-148 browser) —
   per current browser-support data, it's Android Chrome and macOS
   Chrome/Safari only, NOT Windows or iOS. So on EK's iPhone (Safari) and any
   Windows desktop testing, this always runs the JS fallback, same as
   before — the engine choice alone was never going to fix Safari.
2. **On-demand, not always-on** — THIS is what actually fixes the heat/
   battery complaint on every platform, including Safari where the JS engine
   still runs. A new "Scan" button (Glyph icon, both `CameraCapturePanel.tsx`
   and `ScanCapturePanel.tsx`) starts one bounded ~8-second burst per tap;
   nothing decodes at all until it's tapped, and the burst stops itself on a
   match or after 8s ("no code found" message). Total JS-loop runtime per
   session dropped from "however long you spend framing a photo" to one
   short, deliberate window — that's the real fix, independent of which
   decoder is running underneath.

**Also fixed in the same pass, found while auditing the pipeline (not
something EK reported directly, but plausibly the actual explanation for
"wasn't scanning anything but burning up my credits with PSA"):**
`vault/add/page.tsx`'s generic Identify path (`handleIdentifyCurrentScan`,
used whenever `scanType` isn't already pinned to book/comic/graded_card/card)
tried a PSA cert lookup **FIRST** on any bare 7-10 digit barcode decode,
before UPC/book/comic/vinyl ever got a chance. EAN-8 — a completely ordinary
retail barcode format — is exactly 8 digits, so it collided head-on with the
"looks like a PSA cert" heuristic: scanning a normal product could silently
burn a real, metered PSA API call (and overwrite Universe/Category to Sports
Cards) before the correct, free UPC lookup ever ran. Fixed: PSA is now tried
**last**, only after UPC/book/comic/vinyl have all failed, and only for
barcode formats that are structurally plausible for a slab's cert code (QR/
Code128/Code39/DataMatrix/unknown) — UPC/EAN-format codes are excluded
outright since they can never legitimately be a PSA cert, not just
deprioritized.

`tsc --noEmit` / `eslint` / `npm run build` all clean. **Not yet tested on a
real device — please do, this is genuinely new code, not a re-test of the old
broken version:**
- Tap Scan on both the regular Add camera and Quick Add, on your iPhone.
- If you have an Android phone with Chrome, test there too — that's the one
  platform that should get the fast native path.
- Point at a real barcode/QR, confirm it decodes and roughly how fast.
- Do several scan bursts in a row and check the phone doesn't warm up the way
  it did before — this is the main thing that needs confirming.
- Confirm the "no code found" message shows if you let a scan run with
  nothing in frame.
- Ask EK: PSA credit spend should now be visibly lower / not spent on
  everyday product scans at all — worth a spot-check if PSA lookups are used
  again for anything.

**Update, same night, after a third real device test + a deeper fix:** EK
reported the timeout message "disappears too fast" to even screenshot — the
2.5s auto-clear on the "no code found" message was genuinely too fast for a
human to read on a phone. Removed the auto-clear entirely in both camera
panels; the message now just stays up until the next Scan tap (which
already resets it), no timer needed.

More importantly: **swapped the fallback decoder from `@zxing/library`
(unmaintained) to `zxing-wasm`** (WebAssembly build of the actively-
maintained zxing-cpp engine — reported faster AND more accurate on
real-world images). Two different approaches built on the OLD library both
failed on the same clearly-legible QR code tonight (whole-frame decode: 9
tries/6.7s, region-cropped decode: presumably similar) — that's not a tuning
problem, the underlying engine itself is the ceiling. Implementation:
- `src/lib/scanners/zxingWasmSetup.ts` — one-time init pointed at a
  self-hosted `.wasm` binary (`public/zxing_reader.wasm`) instead of the
  library's default CDN fetch. `scripts/copy-zxing-wasm.js` copies it from
  `node_modules` on `npm install` (wired via a new `postinstall` script) so
  a fresh Vercel build always has it; the current copy is also committed
  directly as a belt-and-suspenders safety net for the very first deploy.
- `onDemandBarcodeScan.ts`'s fallback engine now tries 4 crops per tick
  (full frame, center, top band for slab labels, bottom band for retail
  UPCs) via `readBarcodes()`. **If wasm fails to load for any reason, each
  tick falls back to the older, already-proven `scanBarcodeFromVideoFrame`
  JS decoder** instead of the feature going completely dark — worse
  accuracy, but still working. This matters because none of this could be
  verified live before pushing (EK was asleep) — the fallback-within-the-
  fallback is the safety net for that.
- Added `normalizeWasmFormat()` — real, silent-bug-shaped gotcha caught
  before shipping: zxing-wasm's format names ("UPCA", "EAN13") don't use
  the underscored convention the existing `normalizeFormatName()` matches
  on ("UPC_A", "EAN_13"). Without a dedicated mapper, every wasm-decoded
  barcode's format would've silently come back "UNKNOWN" — which would have
  quietly defeated the PSA auto-fire format-exclusion fix from earlier
  tonight for every code read through this new engine (UPC/EAN formats are
  specifically excluded from ever reaching a PSA lookup; "UNKNOWN" isn't
  excluded).
- Camera panels now call `warmupZXingWasm()` on mount (not on first Scan
  tap) so the ~1MB wasm binary is already loading by the time someone taps
  Scan, rather than eating a cold-load delay inside the 8s burst.
- `ScanCapturePanel.tsx`'s `getUserMedia` had **no resolution constraint at
  all** (a real gap, unlike `CameraCapturePanel.tsx`) — aligned it to that
  file's own already-settled `width: {ideal: 1280}` rather than inventing a
  new number. **Deliberately did NOT bump resolution further in either
  file** — `CameraCapturePanel.tsx`'s own comments record two earlier
  rounds of raising it not helping sharpness and even making capture
  slower; no reason to re-litigate that here.

**CONFIRMED WORKING 2026-08-11 morning** — EK's first test after waking up:
the exact same CGC slab that failed twice the night before (whole-frame
decode, then region-cropped decode, both on the old unmaintained library)
now decoded clean on the first try — green "QR code read: 3905790037795"
badge, regular Add's camera. The wasm asset was also independently verified
serving correctly in production before this test (200, `application/wasm`,
byte-exact size match) via a direct fetch from a live browser session, so
both the infrastructure risk (self-hosted binary actually serving on
Vercel) and the accuracy problem (the engine swap itself) are confirmed
resolved, not just "should work."

**Not yet tried, worth a quick check next:**
- The horizontal linear barcode under the QR on that same slab (confirms
  linear/1D formats decode too, not just QR/matrix).
- Quick Add's camera (`ScanCapturePanel.tsx`) — only the regular Add camera
  (`CameraCapturePanel.tsx`) has been tested so far; both go through the
  same `onDemandBarcodeScan.ts`, so this should work, but hasn't been seen.
- A genuine retail UPC/EAN on an ordinary product (this test was a slab
  QR, not a linear retail code).
- Whether it still runs cool over several repeated bursts — heat was the
  ORIGINAL complaint that started this whole rebuild; decode accuracy is
  now confirmed, heat hasn't been re-checked since the engine swap.

PSA lookups are still paused (`ENABLE_PSA_LOOKUP = false`, §B3) — this was
a CGC slab, so this test didn't touch that path. Still needs EK's explicit
go-ahead before flipping it back on.

**Update, same day, after two real device tests:** the "Scanning" banner is
confirmed visible on a real phone (EK sent screenshots showing "Scanning…
(11 tries, 5.0s)" and "(7 tries, 3.1s)") — the earlier "I don't see it even
flicker" report was a genuine UI-visibility gap, now fixed, not a
session-never-ran bug. A first real decode attempt on a CGC-slab QR+barcode
came back "js-fallback, 9 tries in 6.7s" — a real burst, real attempts,
still no match, on a code that was clearly legible on screen. Diagnosed:
the fallback engine was decoding the WHOLE video frame at once (ZXing's
`decodeContinuously`), which loses too much relative resolution on a code
that's small against the full frame -- the exact problem the OLD hand-rolled
region-cropping scanner existed to solve. Swapped the fallback to a new
`startRegionScan()` (still in `onDemandBarcodeScan.ts`) driving the existing
`scanBarcodeFromVideoFrame()` region-crop+upscale+contrast-variant decoder,
still bounded to the same on-demand burst so the heat fix holds. **Not yet
confirmed whether this actually decodes better — that result hasn't come
back in yet.**

**PSA lookups fully PAUSED, EK's explicit request:** while decode accuracy
is being tested, no PSA lookup should spend real quota. Added
`ENABLE_PSA_LOOKUP = false` inside `runPSALookupForCode`
(`vault/add/page.tsx`) — short-circuits before any network call, covers all
three paths that reach it (auto graded_card flow, generic auto-Identify
fallback, manual "Look up" button), shows a clear status message instead of
silently no-oping. **Flip back to `true` once decode reliability is
confirmed** — if a future session sees PSA "not working," check this flag
before assuming something broke.

`BarcodeScanCamera.tsx` (a separate, older always-on scanner used by
`vault/add/page.tsx`'s `isBarcodeScanOpen` state) was found dead/unreachable
while auditing this — nothing in the app ever sets that state to `true`, so
it can never actually open. Flagged as a spawned task, not touched here
(deleting it or wiring a real entry point on the new on-demand system is a
separate, smaller decision for EK). ~~Original notes:~~
EK tested the previous fix live: **still didn't work, on both Quick Add AND
regular Add.** That confirmed the digits-gate bug (real, and still worth
having fixed) wasn't the whole story. Two more real things found:

1. **Quick Add (`ScanCapturePanel.tsx`) never had ANY barcode detection code
   at all** — grepped the file, zero matches. So "either way it doesn't
   work" was literally true for Quick Add: there was no badge to fire,
   period. **Added it tonight**, matching the regular Add camera's badge.
2. **The regular Add camera's mechanism itself was the deeper problem.**
   `CameraCapturePanel.tsx`/`BarcodeScanCamera.tsx` both hand-rolled their own
   loop: crop 10 regions of the video frame to a canvas every ~450ms tick,
   try 3 contrast variants on each. That's the thing that went through THREE
   rounds of tuning this week (bottom-only region → added top regions →
   round-robin throttle) and apparently still didn't reliably decode a real
   frame even with the digits-gate bug fixed. Rather than guess-tune a fourth
   time, **replaced it with ZXing's own supported continuous-video-decode
   API** (`BrowserMultiFormatReader.decodeContinuously` — new
   `src/lib/scanners/liveBarcodeReader.ts`), which decodes the WHOLE frame
   each attempt using the library's own internal canvas/pacing instead of our
   bespoke region system. This is the standard way this library expects live
   video to be scanned; worth trying as a different mechanism before tuning
   the old one a fourth time.
   - Gotcha found and worked around: ZXing's higher-level
     `decodeFromVideoElementContinuously()` wrapper waits for the video's
     `'playing'` event before starting — which **never fires** for a video
     that was already playing before the reader attaches (our case, always —
     the camera panel starts its own stream first). That would have silently
     hung forever. Used the low-level `decodeContinuously()` instead, which
     starts immediately with no such wait.
   - Also fixed a real, separate, previously-unnoticed bug while in here:
     `BarcodeFormat` is a numeric enum (`QR_CODE = 11`), so the old
     `normalizeFormatName()`'s `String(rawFormat).includes("QR")` was
     stringifying the *number* (`"11"`) — that check could never match
     anything, so the `.format` field was silently always `"UNKNOWN"` on
     every real scan, ever. Fixed to reverse-index into the enum properly.
   - `CameraCapturePanel.tsx`, `BarcodeScanCamera.tsx`, and the new Quick Add
     badge all now go through this shared module. The old per-tick region
     system (`scanBarcodeFromVideoFrame` in `barcodeScanner.ts`) is
     untouched and still used for the STILL-IMAGE paths (`scanBarcodeFromFile`
     — after a photo's already taken, comics' addon-code decode, etc.) —
     those aren't what was reported broken and don't have the same
     already-playing-video timing issue.
   - **Not yet confirmed on a real device — please test again.** This is a
     bigger, more fundamental change than the digits-gate fix, so it needs a
     fresh real test, not an assumption the previous "fixed" note still
     holds.

**Please test again once the deploy finishes (3-5 min after push):**
- Quick Add AND regular Add, aim at a real QR/barcode (slab, retail UPC,
  random QR) — does the badge pop up now, and roughly how fast?
- If it's *still* broken, the next thing to check (not yet tried) is whether
  it's a camera-permissions/resolution issue specific to your phone, since
  the scanning mechanism itself has now been swapped for the library's own
  supported path rather than our bespoke one — say exactly what you see
  (nothing at all vs. a delay vs. an error) so the next pass doesn't have to
  guess between "still not firing" and "a new, different problem."

### B2. Cards auto-fill — real bug found + fixed: Pokemon match wasn't setting Category/Subcategory
EK tested: **it read the title, matched a real card, correctly put the match
info in the description — but never set Category/Subcategory to "Pokemon."**
Real cause: the lookup was gated on Subcategory **already being exactly**
"Magic: The Gathering" or "Pokemon" *before* scanning — which defeats the
point of Identify (you're scanning *because* you don't know what it is yet).
Since that gate was never satisfied, the DB match's own fields (which never
included Category/Subcategory in the first place) never got a chance to
correct anything.
**Fixed both:**
- Gate is now just **Universe = TCG** (no exact-subcategory requirement).
  `runTcgCardLookupForFile` (`vault/add/page.tsx`) and `lookupTcgCardFromFile`
  (`capture/page.tsx`) now try **both** Magic (Scryfall) and Pokemon (Pokemon
  TCG API) off the same OCR'd title/number — cheap since both APIs are
  free/keyless — and use whichever one actually matches.
- On a match, Category/Subcategory now get **explicitly set** to `"TCG / CCG"`
  / `"Magic: The Gathering"` or `"Pokemon"` (not just filled if blank — same
  "confirmed match corrects a wrong/blank pick" rule the comic scanner
  already uses), so the dropdowns actually update instead of only the notes
  text mentioning it.
- **Rarity field**: EK also couldn't find a Rarity field on `/capture` at
  all. Real reason: `/capture`'s builder form has **no per-universe fields
  whatsoever** (unlike `/vault/add`, which has full TCG/Sports/etc. sections)
  — every universe just gets the same generic title/subtitle/number/grade
  fields, so a matched card's rarity only ever landed in the description
  text, never in its own field. **Added one** — a plain text input labeled
  "Rarity," shown only when Universe=TCG, right next to
  Subcategory. Wired to save via `VaultItem.tcgRarity` (already a real,
  existing, local-only field — same one `/vault/add` uses — no migration
  needed since it was never a synced Supabase column to begin with).
- **Not yet retested — please test again**: scan a real Magic or Pokemon
  card via either Add flow with Universe=TCG selected (Subcategory can be
  blank or wrong now, that's the point), confirm Category/Subcategory both
  update to the real match, and that the Rarity field on `/capture` shows up
  and holds a value.

### B3. PSA graded-card lookup — REAL CAUSE: daily API quota exhausted, NOT a bad token (previous notes below were a wrong diagnosis)
EK: "if this isn't free, then we don't have it yet or it doesn't work" — hit
`/api/psa-lookup` directly, got a `403`. **First guess (wrong): assumed
403 = bad/expired token,** since that's a common convention — sent EK to
regenerate a fresh `PSA_TOKEN` from https://www.psacard.com/publicapi and
update Vercel. **Still failed after a real redeploy with the fresh token.**
Had EK test PSA's API directly (their own curl/PowerShell sample, bypassing
our app) to isolate the problem — that returned PSA's actual error text for
the first time:
> `"API calls quota exceeded! maximum admitted 100 per Day. Please contact collectors-apis@collectors.com"`

**The token was never bad.** PSA's account has a hard 100-calls/day cap, and
it was exhausted — almost certainly by this session's own repeated live
testing (direct curl checks + a couple of polling loops used to verify the
earlier "fixed" deploys), not by EK (confirmed: "I haven't tested anything
today or in the last month"). The original `/api/psa-lookup` code only ever
checked `res.status` and GUESSED what it meant (401/403 = bad token) instead
of reading PSA's actual response body — which is also flatly wrong per PSA's
own documented error codes (https://www.psacard.com/publicapi): **500**
usually means bad credentials, **4xx** usually means the request
path/format itself is invalid, neither is "401/403 = token." That wrong
guess is what sent EK on a pointless "regenerate the token" detour.
**Fixed properly this time:**
- `/api/psa-lookup/route.ts` now reads PSA's actual response body text on
  any non-OK status and surfaces it directly, instead of guessing from the
  status code alone. A quota message gets its own clear callout (resets on
  PSA's own daily schedule, or email `collectors-apis@collectors.com` to
  raise the limit); anything else states PSA's exact wording rather than a
  made-up explanation. Falls back to a **status-code-accurate** guess (per
  PSA's real docs, not the old assumption) only if PSA's body is empty.
- Added a `204` (empty request) case so that doesn't crash trying to parse
  an empty body as JSON.
- `lookupPSACert()` (client wrapper) still throws the real message through
  instead of silently swallowing every error into `null` (from the earlier
  pass) — now that message is actually accurate.
- **⚠ A live PSA token was pasted into this chat session** (EK ran the
  direct-test command with the real value substituted, and it echoed back
  in the terminal paste). Flagged to EK as exposed; recommended treating it
  as compromised. **If the next chat sees PSA lookups failing again, check
  whether that token was ever rotated after this — it should be.**
- **Retested once, deliberately (not a loop), after EK confirmed the quota
  had reset and the guard migration (§B3b) was run. Got a THIRD, different
  rejection:** `"Access to this API is limited to approved customers."` Not
  a bad token, not quota-exceeded — PSA is saying the account itself isn't
  approved for API access at all, even with a syntactically valid, freshly
  generated token. Generating a token via PSA's portal apparently doesn't
  by itself grant usable API access. **This needs PSA support directly**
  (`collectors-apis@collectors.com`) to clarify what "approved customer"
  status requires and whether this account has/had it — not a token refresh
  or redeploy problem. **EK's action item now.**

### B3b. PSA quota guard — built same night, so this can't happen again (migration confirmed run)
Two real gaps this exposed, both fixed now:
1. **Nothing was caching cert lookups.** A PSA cert's grade/subject/etc.
   never changes once issued — every repeat lookup of the same cert
   (someone re-scanning, two users with the same card, or diagnostic
   testing) was a wasted real PSA call. Added a **permanent** cache
   (`psa_cert_cache` table) — once any cert has been looked up once, ever,
   it never touches PSA again.
2. **Nothing stopped the app before PSA had to say no.** Added a hard
   internal daily budget (`psa_api_usage` table + `psa_usage_try_reserve()`)
   capped at **90** (leaving real headroom under PSA's actual 100), checked
   *before* every PSA call. The moment PSA itself does reject a call as
   quota-exceeded, `psa_usage_mark_exhausted()` flips a flag so every other
   call the rest of that day short-circuits instantly with a friendly
   "paused for today" message instead of spending another real call (and
   getting another rejection) to find out the same thing again.
   Both live in `supabase/migrations/20260806_psa_api_guard.sql`.
   **✅ RUN — confirmed by EK.** The cert cache + 90/day budget guard are now
   live and protecting every `/api/psa-lookup` call.

**⚠ Bigger, unsolved problem — flagged, not fixed:** PSA's public API is
explicitly a developer/test tier (100 calls/day, shared across the WHOLE
app, not per-user). **This does not scale to a real subscriber base** — even
a few dozen active users scanning graded slabs would exhaust it same-day,
guard or no guard; the guard only stops today's diagnostic-testing failure
mode from recurring, it doesn't create real capacity. Getting graded-slab
lookup to actually work for paying subscribers needs EK to contact PSA about
their commercial/paid API tier (higher volume) — that's a cost/business
decision for EK to make with PSA directly, not something the next chat can
code around. Worth raising proactively if EK hasn't brought it up.

### B4. Regular Add camera should visually match Quick Add's — DONE 2026-08-08/09 (this heading was stale)
EK's own instruction, explicit ordering: fix barcode/Cards first, THEN
make the regular Add camera visually match Quick Add's. **Corrected
2026-08-11/12: this note said "not started" but the work actually
shipped 2026-08-08/09** — see the full writeup under §4's "2026-08-08/09
— Regular Add's camera, rebuilt to actually match Quick Add" entry
(embedded live camera removed in favor of a full-screen popup matching
Quick Add's structure, corner-bracket guide, shared `DropdownPill`,
letterbox-bar fix, drag-to-reorder thumbnails). Leaving this pointer here
so a future pass doesn't restart already-finished work a second time.

### B5. Vault Halls — a dead-session draft got replaced with EK's actual spec; new cross-category search + real tags built
A previous session died mid-work on `src/app/vault/halls/` — found it
uncommitted, asked EK what direction it was going. The draft: a hardcoded
list of ~40 pop-culture franchises (Marvel, DC, Star Wars, etc.), auto-
tagging items by keyword match, raw emoji as hall icons (fixed the page
chrome's emoji first, then EK clarified the REAL spec was different and
bigger — read it back twice to confirm before building):

**EK's actual spec:** pick your own search terms; each term's matches get
ADDED to a working result set (OR, not a narrowing AND) — search "Marvel"
then "Spiderman" and both sets show up together, even a non-Marvel-branded
Spider-Man item. Everything found is selected by default; deselect what you
don't want; name and save the rest. Has to work for every universe (Music,
plants, bar items, everything), not just pop-culture. "Spider-Man"/"Spider
Man"/"Spiderman" need to match as one term automatically, no manual
spelling list. Hashtags matter for BOTH this search AND social sharing (EK's
original spec) — confirmed hashtags already existed for sharing
(`SocialExportSheet.tsx` generates them fresh each export) but never as a
saved, searchable field.

**Built:**
- `src/lib/vaultSearch.ts` — the search engine. Normalizes text (strips
  punctuation/case) so spelling variants match without a curated list;
  searches title/subtitle/subject/category/universe/every manufacturer-ish
  field per universe (comic publisher, toy brand, vinyl label, watch brand,
  sports team, etc.)/tags. Universe+Category filter narrows (AND) on top of
  the OR'd terms.
- `src/app/vault/halls/page.tsx` — full rewrite. Term-chip search box, live
  results (all pre-selected, tap to deselect), Universe/Category dropdowns,
  name + "Save as Hall" → reuses the existing gallery/exhibition system (a
  saved Hall is a real private gallery, shareable later the same way any
  exhibition is). **Deleted** the old franchise-registry version, the
  `[franchise]` detail route, and `src/lib/franchiseDetect.ts` — viewing a
  saved Hall is just the existing `/museum/[galleryId]` page now, no
  separate route needed.
- **Real `tags` field added to `VaultItem`**, synced to Supabase
  (`supabase/migrations/20260806_vault_item_tags.sql` — **confirmed run by
  EK**) with the same graceful-fallback-if-column-missing pattern
  `vaultCloud.ts` already uses for other optional columns (belt-and-
  suspenders now that it's live).
- `src/lib/generateHashtags.ts` — extracted `SocialExportSheet`'s
  universe/category/title-keyword hashtag suggestion logic into a shared
  module (was duplicated nowhere else, but would have started drifting the
  moment a second consumer needed it). New items now auto-save a few of
  these as real tags on creation (`/capture` and `/vault/add` both) — so
  Halls search has real data from day one instead of depending on everyone
  remembering to tag manually.
- Added a Tags editor (chips + one-tap suggestions pulled from the same
  generator) to the item detail page, for editing tags on any item —
  including the entire existing vault, which has zero tags today since this
  field didn't exist before tonight.
- `tsc`/`eslint`/`npm run build` all clean; verified via local dev server
  that `/vault/halls` compiles and server-renders without error. **Not
  tested with a real login at all** — the whole flow (search behavior,
  save-as-Hall, tag editor) needs a real device/account test.
- **Since built:** a "browse existing tags" chip row in the search bar
  (most-used tags across the vault, tap to add as a search term), and an
  "Auto-tag my collection" button on `/vault/halls` that backfills tags on
  every item that predates this feature. Both were "suggested, not started"
  as of the last handoff pass — now done, still needs a real login to test.

### B6. Overnight cleanup pass — a real data-loss bug fix + dead-code/fake-data/emoji/pill sweeps
EK asked, after the Halls work: "what else can you work on over night" →
"do 1-4 and any other clean sweeps you can do to clean up any code." Ran
four sweeps, all verified with `tsc`/`eslint`/`npm run build` after each:

1. **Real data-loss bug, found while reviewing the tags work, now fixed.**
   `normalizeOne()` in `vaultModel.ts` is a strict allow-list — any
   `VaultItem` field missing from its return object gets silently dropped
   the next time the vault reloads, and `loadRawItems()` immediately
   persists that stripped copy back to storage (so it's not just a display
   glitch, it's permanent). Confirmed four real fields hitting this by
   programmatically diffing every type field against what `normalizeOne`
   actually returns, rather than eyeballing 700+ lines:
   - `itemType`/`itemAttributes` — the "Type" dropdown + "Attributes"
     checkboxes on `/vault/add` (`getTypeOptions`/`getCheckboxOptions`,
     real active UI) saved correctly, then vanished the very next time the
     vault loaded (navigate away and back, refresh). No sync path exists
     for these either — once dropped, gone for good, not recoverable from
     Supabase.
   - `videoClip` — same local bug, though `vaultCloud.ts`'s sync already
     handled this one correctly, so a Supabase-connected user's video
     *could* recover on the next sync (not before, and not for local-only
     use).
   - `itemCode` — the permanent, server-assigned tracking code (explicitly
     documented "never edited by the client") gets set via a cloud-sync
     merge, then dropped by the very next local normalize pass before
     another sync could reconfirm it. `mergeById()` calls `normalizeOne()`
     directly, so this hit the sync-merge path too, not just page reloads.
   All four fixed by adding them to `normalizeOne`'s return object.
2. **Dead-code sweep**: 11 more files deleted (early AI-integration stubs,
   a chained dead pair, a duplicate metrics/theme system, a superseded
   sell-item helper). Delegated discovery to an Explore agent, verified its
   findings myself before deleting, `tsc` clean after.
3. **Fake-data sweep**: found the same bug shape as prior rounds (hardcoded
   value sitting next to real data) in `watchlist/page.tsx` (fake per-item
   value-history chart + dead non-clickable time-range tabs),
   `goals/page.tsx` (fake "Goal Value Impact" chart), `more/page.tsx`
   (hardcoded "1 year" tenure for every account), and `HomeClient.tsx` (the
   home dashboard's "Collection Value" chart showed the exact same fixed
   path to every user regardless of real history). Fixed all four — the
   home dashboard one now uses real data from `valueHistory.ts` (already
   built, already used elsewhere, just never wired in here); the other
   three had no real per-item/per-goal history to chart, so got an honest
   message instead of a fabricated one, matching this app's own established
   pattern elsewhere on the same pages.
   **Found but NOT touched**: `community-board/page.tsx` has the identical
   fake-mini-chart pattern next to real "Market Pulse"/"Volume" numbers —
   that file is explicitly Codex's per §0's parallel-editing note, flagging
   for whoever owns it rather than editing across that boundary.
4. **Pill sweep**: one real violation — `museum/page.tsx`'s "Exhibit
   Status" modal had two `w-full` dropdowns for one-word options,
   inconsistent with the same file's own correctly-sized toolbar filters
   just above them. Fixed to `w-auto`.
5. **Emoji sweep**: addressed the specific sites this handoff had
   previously deferred as needing real visual judgment rather than a
   mechanical swap — `kickstarter/page.tsx`, `shop.tsx` (category chips +
   empty state only; the ~34 individual product icons need their own
   per-item judgment call, left alone rather than guessed), 
   `v/[profileId]/page.tsx` (replaced a local emoji map with the shared
   `universeGlyphName()` helper that already existed for this exact
   purpose), and `HomeClient.tsx` (social-platform icons, an upload
   button, a decorative sparkle). Added 4 new icons to the shared `Glyph`
   component (rocket, globe, book, wrench). **Deliberately left alone**:
   `SeasonalBanner.tsx`'s falling snowflake/ball/leaf/pumpkin particle
   animation (an intentional decorative effect, not icon substitution) and
   the user-chosen avatar-preset emoji (explicitly exempted already).
- **Nothing in this pass has been visually verified in a real browser** —
  everything compiles/builds/server-renders clean, but several are real,
  user-visible UI changes (a chart, icons, a dropdown width). Worth a look
  next time EK is in the app, especially the home dashboard and `/shop`.

### B7. Fresh iPhone bug report — all 3 issues FIXED
EK tested live on an iPhone (Safari, `vltd.vercel.app`, system set to Light
Mode), reported with a screenshot. All three fixed and pushed:

1. **Hero card text was low-contrast.** Root cause: `HomeClient.tsx`'s local
   `C.muted`/`C.muted2` design tokens were a hardcoded `#61656B` — only
   ~2.5:1 contrast against the hero/gallery cards' own hardcoded dark
   panel background (that panel is intentionally always-dark, a "premium
   console" look, and never switches with site theme — so this wasn't
   actually a light/dark-switching bug, it was a real contrast bug that's
   been there in both modes, just more noticeable next to a light-mode page).
   Fixed: bumped to `#9BA0A6` (the app's own `deep-vault` theme's
   `textSecondary` value — not invented, already used elsewhere) — ~6:1
   contrast, fixes both modes since the panel itself doesn't change.
2. **VLTD logo washed out in Light Mode.** Root cause: `TopNav.tsx` applied
   a hardcoded `grayscale(1) brightness(1.4) contrast(1.05)` CSS filter to
   the logo image, tuned to brighten it for a dark navbar — against a light
   navbar the same +40% brightness filter washed it out. Fixed: removed the
   filter entirely. The logo's own dark+gold artwork is legible against
   either navbar color on its own; no filter or theme-detection needed.
3. **"Add to Home Screen" prompt did nothing on tap.** Root cause:
   `PWAInstallBanner.tsx`'s iOS branch was pure static text with no tap
   handler at all — styled like a button, wasn't one. (iOS Safari has no
   `beforeinstallprompt` API, so there's no way to trigger the native
   install dialog from JS — confirmed, not a bug to "fix" by finding a
   missing handler.) Fixed: made the banner body tappable — it now expands
   to show the actual two-step instructions ("Tap the Share icon in
   Safari's toolbar, then Add to Home Screen") instead of silently no-oping.

### B8. Barcode scans connected to real lookups (2026-08-11) — /capture, /vault/add, Quick Add. Partially device-tested; one path unconfirmed.
EK's real question after the scanning rebuild (§B) worked: "what can
scanning a barcode do at this point?" Honest answer at the time: nothing.
It confirmed the read (green badge) and stopped there — the actual lookups
only ran later, inside the after-a-photo Identify pipeline, and even then
silently auto-filled fields with no confirmation screen. EK also asked two
concrete questions that shaped this: (1) does taking one photo of a comic
that also has a barcode already combine both signals smartly? — checked
the code, answer is genuinely yes, `capture/page.tsx`'s `runAiIdentify`
already runs vision + barcode + comic-OCR in parallel and merges them (has
for a while, independent of §B's scanner work) as long as Universe/
Category are already set to Pop Culture/Comics. (2) scan 10 barcodes in
Quick Add then batch it — how would you know it worked? Checked: it
wouldn't, at all — `CapturedItem` had no barcode field, the scan result was
thrown away the instant the checkmark faded. Researched how real batch
scanners (Scandit, CLZ) solve this: live per-scan feedback, a visible
running list/count as you go, never a silent wait to the end.

**Built**, per EK's "build all 3, we'll see if it's fast enough":
- New `src/lib/scanners/barcodeLookup.ts` — the missing link. Given just
  the decoded digits (no photo), tries comic (Metron then GCD), vinyl
  (Discogs), then the generic UPC/book lookup, in that order (narrower/more
  specific DBs first) since a comic/vinyl hit is always more useful than
  the generic product-title lookup would return for the same code.
  Deliberately excludes PSA (metered/paused per §B3) and AI vision
  (metered, needs a real photo) — this is the free-lookup layer only.
- `CameraCapturePanel.tsx` gained a new `onLiveBarcodeScan` prop, fired
  once the lookup settles for a scanned code.
- **`/capture` + `/vault/add`**: wired to the new prop, filling only BLANK
  fields (a confirmed database match is treated as MORE trustworthy than a
  later AI vision guess, deliberately not using `runAiIdentify`'s own
  "vision wins if non-empty" merge rule for this). `/vault/add` reuses its
  existing `scanSession`/`applyScanFieldsToEmpty` machinery (plus a direct
  `setValues` pass for comicPublisher/vinylLabel-style fields that have no
  slot in the shared `ScanSessionFields` shape) rather than inventing a new
  UI.
- **Quick Add (`ScanCapturePanel.tsx` + `ScanReviewSheet.tsx`)** — the real
  answer to "will I waste time." The lookup starts the instant a scan
  succeeds (not on capture), attaches to whichever item gets shot right
  after, and the review sheet shows a live tag per item — "Matched: X" /
  "No barcode match — AI will identify" / "Looking up..." — **before**
  Finished is ever tapped. A confident match pre-fills that item's draft
  via the same `visionToDraftPatch` taxonomy-matching path AI results use
  (via a new `barcodeMatchToVision()` synthesizer) and **skips the metered
  AI scan for that item entirely**.

**Real bug found on first test, fixed same session:** EK scanned
immediately — code read fine, "nothing visible happened." The confirmation
card lived on the PAGE; `CameraCapturePanel` is a full-screen modal ON TOP
of that page, so the card was firing and filling fields correctly the whole
time on a layer EK literally could not see without closing the camera
first. **Fixed:** moved the lookup call AND its result display into
`CameraCapturePanel` itself — it now runs `lookupByBarcodeOnly()` directly
and shows "Looking up…" / "Found: X" / "No match" right in the camera view,
below the existing green checkmark badge. `onLiveBarcodeScan` now hands the
parent the already-resolved match instead of each parent re-running its
own lookup (fixed a duplicate-network-call inefficiency in the same move).

**Second test, after the visibility fix:** scanned the same CGC slab again
— correctly showed "No match found," which is the RIGHT answer (CGC isn't
in any of the wired-up databases; no CGC lookup exists at all, same gap as
PSA — see below). EK's question: could it say something more useful than a
flat "no match" that reads like a failure? **Built `guessWhyNoBarcodeMatch()`**
(`barcodeLookup.ts`): if the raw scanned text contains a known grading
company's own domain (CGC/PSA/Beckett/SGC all put their verify URL in the
QR), names the exact service confidently; if it's just a QR with no
recognizable domain that matched nothing, says it might be "a
grading-company certificate" — softer, since retail UPC/EAN codes are
essentially never QR-encoded in practice but this can't name WHICH service
without the domain signal. A genuinely unrecognized linear barcode still
gets the honest generic "no match" message.

`tsc --noEmit` / `eslint` (zero new warnings) / `npm run build` all clean
throughout. **Status as of the last real test:**
- ✅ Scanning mechanism itself: confirmed working (§B).
- ✅ "No match" path: confirmed correct and now informative (this section).
- ⬜ **"Found: X" success path: NOT yet confirmed** — every device test so
  far has been against a graded slab's cert QR, which structurally can
  never match (no cert-lookup DB is wired up). **Needs a scan of something
  that SHOULD match** — a comic's own barcode, a vinyl record, or a plain
  retail product — to prove the actual lookup-and-fill works, not just that
  it correctly says no when there's nothing to find.
- ⬜ Quick Add's live per-item tags: not yet seen on a real device at all.
- ⬜ Whether scanning still stays cool over repeated bursts: not re-checked
  since the `zxing-wasm` engine swap (§B) — the original complaint that
  started this whole thread.

**CGC lookup — confirmed still fully unaddressed.** No CGC API integration
exists anywhere in the app (same status as before tonight). If EK wants
this built, it would mirror the PSA cert-lookup work (§B3/§B3b) — a new,
separate effort, not started, and not something the "connect existing
lookups" work above touches.

**Third real test, 2026-08-11: a Nintendo Switch game's real retail UPC
(`0810148574819`) correctly decoded but found no match.** Not a bug in the
decode or lookup logic — genuinely a coverage gap, and it surfaced a real
risk worth flagging clearly:
- **No video-game-specific barcode database is wired in.** `lookupUpcItem`
  only hits upcitemdb (general retail) + OpenLibrary (ISBNs) — neither
  specializes in games, and this specific title just wasn't in upcitemdb's
  free-tier catalog. Real options exist (ScanDex combines barcode+IGDB
  metadata; GameUPC has a REST API) if EK wants a dedicated games lookup
  added to the cascade, same pattern as comics (Metron+GCD) and vinyl
  (Discogs) — not started.
- **Bigger, more urgent finding: upcitemdb's free tier is capped at 100
  requests/DAY, shared across the whole app** — the exact same shape of
  problem PSA had before the quota guard was built (§B3b), and there's
  currently **no cache, no budget guard, nothing** protecting this one.
  Before tonight, UPC lookups only fired during a full photo-based Identify
  (relatively rare per session). Tonight's live-scan feature (§B8) now ALSO
  fires a UPC lookup on every single scan across `/capture`, `/vault/add`,
  AND every Quick Add item — meaningfully more call volume through the
  exact same free tier. **Worth building the same cert-cache + daily-budget
  pattern used for PSA before this becomes a real outage, not a hypothetical
  one.** Flagged to EK, not yet built — needs a decision on priority.
- **Confirmed: no live zoom control while framing a shot.** Checked both
  camera panels directly — neither has any `zoom`/`MediaStreamTrack`
  constraint code at all. The AFTER-capture crop/review step
  (`ScanCropEditor.tsx`) DOES already have real pinch/scroll zoom (the
  "Pinch or scroll to zoom" hint is genuine, already shipped) — EK's
  question was about the LIVE camera view before capture, which has none.
  Browser `getUserMedia`/`MediaStreamTrack.applyConstraints({zoom})` can do
  this on supporting hardware/browsers, similar to the focus-constraint
  research from §B — not started, real feature request if EK wants it.

### B9. Real Brand/Manufacturer/Publisher field added (2026-08-11) — was computed, then silently discarded
Same test that found the video-game UPC gap above also surfaced this: AI
Identify correctly named the game (Contra Operation Galuga), category, and
notes — but there was nowhere for "Nintendo" itself to go, and EK pointed
out the identical gap applies to a comic's publisher (Marvel/DC) or a
card's manufacturer (Topps). Checked the code before building anything:
this wasn't a missing-feature gap so much as a missing-FIELD one — AI
vision's response already includes a `brand` field on every Identify call,
and the generic UPC lookup already returns one too (upcitemdb genuinely
has "Nintendo" on file for this exact game) — both were computed and then
thrown away because nothing existed to hold them.

**Built:**
- `vaultModel.ts`: new `brand?: string` on `VaultItem`, distinct from the
  existing `subject` field (who/what an item is ABOUT — a player,
  character, artist; used for the vinyl "artist" and the Registry
  leaderboard) — brand is who MADE it. Added to `normalizeOne()`'s
  allow-list too, so it doesn't repeat the exact "silently dropped on next
  reload" bug class fixed earlier this week for other fields.
- New migration `supabase/migrations/20260811_vault_item_brand.sql` for the
  matching `vault_items.brand` column — **not yet run.** Deliberately did
  NOT touch `vaultCloud.ts`'s row map yet (an unknown column throws on
  every synced item's upsert, not just this field) — that's the next step,
  only after EK confirms the migration ran.
- `capture/page.tsx`: new "Brand / Manufacturer / Publisher" field in the
  Identity accordion (same lock/remembered-value support as Item Name),
  wired into the vision+UPC merge.
- `barcodeLookup.ts`: comic publisher and vinyl label now also populate
  this same universal field in addition to their existing specific ones —
  a live barcode scan fills Brand too, not just notes text.

**Scoped to `/capture` only** (where EK demonstrated the gap) — `/vault/add`
already has narrower per-universe equivalents (`comicPublisher`,
`vinylLabel`) that work correctly, just aren't unified under one generic
name; extending it there too is a smaller, separate fast-follow if EK wants
consistency across both screens.

`tsc`/`eslint`/`build` all clean (one build attempt hit a transient Google
Fonts network fetch failure unrelated to this change — clean on retry, not
a real problem, just noting it in case a future build hiccups the same way
for no code-related reason).

**DONE 2026-08-11:** EK ran the migration ("Success. No rows returned"),
so `vaultCloud.ts`'s row map is now wired both ways (plus the same
missing-column fallback pattern already used for `tags`/video/etc., kept
as belt-and-suspenders even though the migration is confirmed). Brand now
syncs to Supabase for real, not just local-only.

### B10. Safety guards built for every metered QR/barcode lookup API — 2026-08-11, needs one migration run
EK's ask, after §B8's upcitemdb-quota-risk flag: "Build all the safeties
that can be used for QR readers." Built the same permanent-cache +
daily-budget pattern PSA already has (§B3b), generalized this time
instead of copy-pasted per provider — new
`supabase/migrations/20260811_lookup_api_guards.sql` (`lookup_api_cache`
+ `lookup_api_usage` tables, provider-keyed) + a shared server helper
(`src/lib/server/lookupApiGuard.ts`).

**Applied precisely, not uniformly — the three providers don't actually
have the same failure mode, so they don't get the same guard:**
- **upcitemdb** — confirmed hard 100/day cap, same shape as PSA's. Gets
  the FULL guard: permanent cache + daily budget (safe cap 90). This
  also required moving the call server-side for the first time — it used
  to `fetch()` upcitemdb directly from the BROWSER
  (`src/lib/upcLookup.ts`), which meant nothing server-side could ever
  gate it no matter what guard existed. New `/api/upc-lookup` route now
  does the actual fetch; `upcLookup.ts` is now a thin client wrapper that
  calls that route (same exported function signature, so no caller
  needed to change). ISBN/book codes route through the same endpoint to
  OpenLibrary/Google Books — cached, but deliberately NOT daily-budget
  gated, since neither has a confirmed hard cap; inventing one would just
  block real lookups for no reason.
- **Discogs** (vinyl) and **Metron** (comics) — both are per-MINUTE rate
  limits per their own docs (Discogs 60/min authenticated, Metron ~30/min),
  not daily caps. Gave both the permanent cache (a real, big win — a
  repeat scan of the same barcode/release/issue never re-hits the API
  again) but deliberately did NOT invent a fake daily-budget pause for
  either — that would be dishonest given neither actually has one. Instead
  added real 429 handling: a clear "rate-limiting right now, wait a few
  seconds" message instead of the previous generic error.
- **GCD** (comics) — no guard needed or added; it's self-hosted data in
  this app's own Supabase (`gcd_comic_search`), not a rate-limited
  third-party call at all.

`tsc`/`eslint`/`npm run build` all clean (only pre-existing, unrelated
warnings — the React Compiler try/finally advisories already documented
elsewhere in this file, and one pre-existing `stopCameraStream` missing-
dep warning in `CameraCapturePanel.tsx` that predates this change).

**DONE 2026-08-11:** EK ran the migration ("Success. No rows returned").
The cache + daily-budget guard is now actually live for upcitemdb/
Discogs/Metron, not just fail-open. Not yet observed in action on a real
scan (no way to tell from the migration alone whether a cache hit or a
budget reservation has actually fired) — first real multi-scan session
is worth a glance at the `lookup_api_cache`/`lookup_api_usage` tables to
confirm rows are actually accumulating.

### B11. Live zoom on the camera preview (before capture) — 2026-08-11, feature-detected, needs a real device to confirm
EK's question: the zoom EK meant was on the LIVE camera view while
framing a shot, not the after-capture crop step (`ScanCropEditor.tsx`
already has real pinch/scroll zoom there, confirmed working — that one
was never in question). Checked what's actually possible: browsers expose
an optional `zoom` capability on a camera's `MediaStreamTrack`
(`track.getCapabilities().zoom` / `track.applyConstraints({zoom})`) —
but it's NOT part of the base `getUserMedia` spec, it's a capture-
extensions addition each browser opts into individually, similar in
spirit to the `BarcodeDetector` feature-detection this app already did
for native barcode scanning (§B). **Honest expectation: per current
browser-support data this is Android Chrome (and some other Chromium
browsers) on supporting hardware — iOS Safari and most desktop
browsers/webcams expose no `zoom` capability at all, and there's no
software way to fake real optical/driver zoom from JS.** On your iPhone,
this most likely will NOT show a zoom control at all — that's a real
platform limitation, not a bug to chase further.

**Built:** new `src/hooks/useCameraZoom.ts` — feature-detects the
capability the moment a stream's video track attaches, exposes a small
vertical slider (bottom-right of the camera frame, only rendered when
actually supported) AND real two-finger pinch-to-zoom over the whole
live camera view. Wired into both `CameraCapturePanel.tsx` and
`ScanCapturePanel.tsx` — one shared hook, not two separate
implementations, same reasoning as `DropdownPill` being extracted
earlier this week.

**Update 2026-08-11, same night:** EK tested on desktop with a mouse —
correctly reported no zoom control at all, confirming the prediction
above (desktop webcams essentially never expose hardware zoom) but that
turned out to be too big a gap to leave as "expected": with the
hardware-only first version, the control was invisible everywhere except
one specific browser/hardware combo. **Added a universal digital
fallback** so a zoom control now exists on every platform: CSS-scales
the live preview and — this is the part that actually matters, not just
a cosmetic zoom-looking effect — crops the captured frame to match at
the moment of capture (`getCaptureCrop()` in the hook, wired into both
`captureFrame()` in `ScanCapturePanel.tsx` and `handleCapture()` in
`CameraCapturePanel.tsx`) so what you see zoomed is actually what gets
saved, not a zoomed-looking preview that silently captures the full
unzoomed frame. Driven by scroll wheel on desktop and pinch on touch;
hardware zoom is still preferred and used automatically on the
Android-Chrome-class devices that actually expose it — digital only
kicks in where hardware doesn't exist.

**Still not yet confirmed on a real device** (only the earlier absence
was tested, not this fix) — worth checking: the slider/scroll now shows
up and works on desktop, scroll wheel doesn't fight page scroll behind
the camera, pinch works on a phone, and a zoomed-in capture actually
looks zoomed in the saved photo (not just the live preview).

**Update, same night — lens-switching (EK's follow-up question).** EK
asked directly: on mobile, does zooming use the phone's multiple rear
cameras (ultra-wide/main/telephoto), or just one? Honest answer at the
time: no, nothing did that — hardware zoom only ever adjusted the SAME
active camera's own driver-level zoom, and digital zoom is a pure crop
of that same single feed. Neither ever switches physical lenses.

Researched what's actually possible here, since there's no standard Web
API to ask "which lens is this" (no focal length/FOV capability exposed):
- Many phones (especially ones with camera-HAL-level multi-camera fusion)
  already expose their whole lens set as ONE logical back camera —
  `enumerateDevices()` only ever shows one entry, and the OS silently
  switches/blends between physical lenses internally as the existing
  hardware `zoom` capability moves through its range. **Nothing needed
  building for these phones — they already get real lens-switching for
  free through the zoom work already shipped.**
- Some phones DO expose each physical rear lens as a separate device.
  For those, **built** `src/lib/scanners/cameraLenses.ts` —
  `classifyBackCameras()`, a best-effort label-text classifier (there's
  no other signal available) that picks an ultra-wide camera out of the
  device list. Wired into both camera panels: scrolling/pinching out
  past the current camera's own zoom floor now switches to that ultra-
  wide device (reusing each panel's existing camera-restart machinery,
  not a new stream path); zooming back in switches back to the main
  camera. A small "Wide" badge replaces the numeric zoom label while on
  it.
- Deliberately scoped to ultra-wide only, not telephoto — digital zoom
  already covers "zoom in further" reasonably within a single lens's own
  quality ceiling, whereas ultra-wide is the one direction digital zoom
  fundamentally can't fake (can't invent a wider field of view from a
  narrower one). Telephoto-lens label detection is also far less
  standardized across OEMs than ultra-wide's — lower value for the
  added guesswork.
- iOS Safari never exposes multiple rear lenses this way at all
  (consistent with the zoom feature's own platform split) — this is
  Android-only in practice, and even there, only on phones that don't
  already fuse their lenses at the OS level.

**Explicitly NOT verified on real hardware** — label-based lens
classification cannot be confirmed without an actual multi-lens Android
phone to test against; a mislabeled device would misclassify silently.
Worth a real test: does a phone with separate ultra-wide/main entries
actually get detected and switched correctly, does the switch feel
reasonably smooth (a brief reconnect blip is expected and fine, a long
freeze or wrong-lens-forever would not be), and does a phone with fused
lenses correctly show nothing extra (no `ultraWideId` found, silent
no-op, existing zoom behavior unchanged).

### C. DOCUMENTS (capture builder §5 accordion) — DONE 2026-08-03
EK's answer: "everything should be private unless shared" — that's a
clear enough steer to build, not a decision that needed your dashboard. Built
it **local-only**: new `src/lib/vaultDocuments.ts` stores files in this
browser's IndexedDB + a localStorage index, completely separate from
`VaultItem.images` — never uploaded to Supabase, never synced, never
touches the (public) `vault-images` bucket, so none of the existing photo
carousels/exports/public share pages can ever surface one. New "DOCUMENTS"
section on the item page (`src/app/vault/item/[id]/page.tsx`, via new
`src/components/DocumentsSection.tsx`) with **Upload file** / **Take photo**
buttons, a list with View/Remove. Genuinely private since it never leaves
the device — the one tradeoff is it doesn't sync across your devices yet;
say so if you actually want cross-device sync (that would need the private
Supabase bucket + your dashboard access after all).

### D. Crop: skippable now, everything else already fine
- DONE (a67af29): crop-stays-small.
- DONE (cc4f29e): multi-photo per item.
- CORRECTED 2026-08-03: auto-crop-to-frame-guide was already wired on every
  capture (`computeGuideCrop()` in `CameraCapturePanel.tsx`), not just after
  background removal — the old note here was stale from the start (predates
  this handoff).
- DONE 2026-08-03: added a **"Use as-is"** button next to Retake/Save so a crop
  step can be skipped in one tap (only shown when the crop isn't already
  full-frame).

### E. Small polish — mostly already done, one item needs your eyes
- CORRECTED 2026-08-03: the "MEDIUM CONFIDENCE" badge was already gated behind
  `identified` (only shows after an actual AI result) — this note was stale.
- The "Syncing…" chip styling ask is dropped — EK doesn't have a specific
  target for this and said so twice; not re-raising it.

### G. Profile/avatar sync bug — FIXED tonight (EK confirmed the fix direction)
Was: `src/lib/publicProfile.ts` `syncPublicProfile()` wrote the
`public_profiles.display_name` shown to OTHER users (Lounge, `/u/[username]`,
museum pages) from the local-only `/user/profile` store instead of the real
`profiles.display_name` set on `/account` — so a user who only ever used
`/account` had the wrong name shown publicly. **Fixed:** `syncPublicProfile()`
now reads `display_name`/`avatar_emoji` straight off the real `profiles` row
it already fetches, instead of the stale local copy. Removed the now-unused
`getProfileSafe` import from `publicProfile.ts`.

### H. `/user/profile` merged into `/account`, real email-change flow added — DONE (2026-08-04 night, both migrations confirmed RUN by EK)
EK's call (given twice): (1) build DOB/age-verification/marketing-opt-in as
real, saved fields (self-declared age check — user types their birthdate,
same kind of gate most consumer sites use; **not** government ID
verification, flagged that distinction to EK); (2) yes, merge the two
settings pages into one, and build a real email-change flow. Both migrations
(`20260803_saved_events.sql`, `20260803_profile_identity_fields.sql`) came
back "Successful" from EK directly — no longer pending, the ⚠ note in §0 is
stale as of this pass, safe to ignore/remove next time this file is edited.

Shipped:
- `updateProfile()`'s allow-list (`src/lib/auth.ts`) now accepts
  `avatar_emoji`/`date_of_birth`/`age_verified`/`marketing_opt_in`.
- **`/account` is now the one real settings page.** Added three sections
  merged from the old `/user/profile`: **Avatar** (emoji is real/synced via
  `avatar_emoji`; image upload stays local-only/device-only, no storage
  bucket wired yet — said so in the UI), **Identity & Security** (DOB + Verify
  Age button + marketing opt-in checkbox, one combined save calling
  `updateProfile()` + `syncPublicProfile()`), and **Data Controls** (Export
  Vault JSON, Clear Local Cache). All load real values from
  `getOnboardingStatus()` on mount, same pattern the rest of the page
  already used for display name/username/bio/contact info.
- **`/user/profile` is now a redirect to `/account`** (`router.replace`,
  not deleted outright) — so a bookmarked or externally-linked
  `/user/profile` URL still lands somewhere real instead of 404ing. Updated
  the two "Edit public profile" links on `/more` to point at `/account`.
- **Real email-change flow, added to `/account/security`** (not `/account`
  itself — matches where the existing password-reset flow already lives,
  under "Login credentials"). Click "Change" on the Email row → type a new
  address → "Send confirmation" calls `supabase.auth.updateUser({ email })`
  → Supabase emails a confirmation link to the new address; the login email
  does NOT change until that link is clicked. No new secrets/services
  needed — this is Supabase Auth's own built-in flow, same mechanism the
  password-reset email already used.
- Removed the top-level "Reset" button that used to reset the *entire*
  profile (including cloud-synced fields) to defaults in one click — real
  data-loss risk once these fields went live. The avatar-image-specific
  "Remove" button (inside Avatar) still covers the one thing that's
  genuinely local-only.
- "Clear Local Demo Data" became "Clear Local Cache" and stopped wiping the
  local vault-items cache (`vltd_items_v2`) — that was never actually demo
  data for a signed-in user.
- Reworded all "demo"/"in a real app this would..." copy — the fields
  behind it are real now.

**Not done, still open:** avatar image upload has no backend (device-only,
said so honestly in the UI) — would need a real storage bucket + upload
flow, a separate ask if EK wants it. Two-factor auth card on `/account/security`
(`TwoFactorAuthCard`) wasn't touched/audited this pass.

### I. Billing plan — smaller fix than expected, SHIPPED tonight
`/account/billing` was hardcoding `currentPlan = "free"` for every user, with
a comment claiming the Stripe webhook wasn't built. **That comment was
stale — the webhook (`src/app/api/billing/webhook/route.ts`) already exists
and already keeps `profiles.tier` in sync**, and `src/lib/subscription.ts`
(`getTierSafe()`) already mirrors that real tier locally — it's used
elsewhere (scan quotas). Fixed: the billing page now reads the real tier via
`getOnboardingStatus()` + `getTierSafe()` instead of a hardcoded literal. No
migration needed, nothing new to configure.
**Gap FIXED 2026-08-12 (overnight, while EK slept):** the Stripe
`customerId` used to only be cached in that device's `localStorage`
(`billingClient.ts`), never persisted server-side — a real paying user
opening billing on a NEW device would see the correct plan (tier is
server-synced) but the Payment method/Invoice history/Cancel sections
stayed hidden. Added `profiles.stripe_customer_id`
(`supabase/migrations/20260812_profiles_stripe_customer_id.sql` —
**confirmed run by EK 2026-08-12**) and the webhook now writes it on
`checkout.session.completed` and `customer.subscription.updated` (same
events that already sync tier), with a graceful fallback that was only
needed pre-migration. `/account/billing` now reads the customer id from
the profile as the source of truth, falling back to the local cache only
for an instant no-flash first paint.
**Not tested against a real Stripe checkout** — the webhook logic was
verified by reading, not by triggering an actual `checkout.session.completed`
event; worth confirming the column actually gets populated after a real
subscribe.

### F. Bigger / later (needs your device or your decision — not started)
- **Events saved-list sync — DONE 2026-08-03 (night), needs your migration run.**
  Saved events (`/events`) were localStorage-only (per-device). Added
  `supabase/migrations/20260803_saved_events.sql` (owner-only RLS, mirrors the
  wishlist/watchlist convention) + `src/lib/savedEventsModel.ts` (same
  local-cache + best-effort-sync pattern as wishlistModel.ts) and wired
  `/events` to it. **Please run `20260803_saved_events.sql` in Supabase** —
  until you do, saves still work (falls back to local-only, same as every
  other model here before its migration lands), they just won't sync across
  devices yet.
  Event **category is still keyword-guessed** (`categoryFor()` in
  `events/page.tsx` — guesses from real event name/description text). Left
  this alone: it's a real classification of real events, not fabricated data,
  and a real "category" column would need someone to actually assign correct
  categories to existing events (a content/ops task, not just a schema
  change) — didn't want to guess at that data blind. Also left
  `savedSuggestionIds` (saved *search results* from the Google Events/SerpApi
  lookup, key `vltd_event_search_saved_v1`) local-only — those aren't real DB
  rows, syncing them would need storing a full snapshot per save (like
  watchlist does for external items), lower priority than the curated-events
  list above.
- Two more possible improvements EK raised, not started: (a) AI comic-book ID
  accuracy — added visual-cue guidance to the vision prompt 2026-08-03 (§4),
  needs a real test against the same comics that triggered the original bug;
  (b) a Subcategory-level pre-set pill next to Category on the scanner screen —
  EK asked for "another box" after picking Category; only added the Category
  pill so far (§4), didn't add a 3rd Subcategory pill since it wasn't clear
  that's literally what was meant vs. just wanting the Category pill. Ask
  before building a 3rd cascading pill.

---

## 3. Options / decisions waiting on EK
- **Profile/avatar sync bug** (2G) — DONE 2026-08-03 night, no longer open.
- **`/user/profile` real DOB/age/marketing fields, merge into `/account`,
  real email-change flow** (2H) — ALL DONE 2026-08-04 night, no longer open.
  Both migrations confirmed run by EK. Only leftover: avatar image upload
  is still device-only (no storage bucket wired) — separate ask if wanted.
- **Capture-screen "Auto ID" metering** — DONE 2026-08-03 (see §4), no longer open.
- **Watchlist vs Wishlist** name — DONE 2026-08-03, renamed to `/watchlist`, no longer open.
- **PillButton-everywhere migration** (2F) — landed on `main` via "Pill sweep"/
  "PillButton everywhere" commits from elsewhere; no longer open, check
  current code rather than assuming a green-light is still needed.
- **ai/review + ai/drafts cyan color** — NOT a decision anymore: confirmed
  2026-08-03 this is the app's actual primary-CTA standard
  (`.vltd-action-module__block`, 25 files), not an off-brand mistake. No change made.
- **/admin/\* visual skin** — confirmed 2026-08-03 it's a deliberately separate
  internal-tool look (own dark bg, amber accents, emoji icons), not drift. Left
  alone. Say so if you actually want it reskinned to match the main app — bigger
  job, not started.
- **~55 orphaned component/lib files found 2026-08-05 — FULLY RESOLVED same
  night, per EK's "do all A/B/C" then "delete the rest" calls:**
  - **Comic barcode/OCR scanner** — real feature, finished wiring it in.
    **Not yet tested against a real comic cover — do that first.** See §4.
  - **Multi-workspace switching** — confirmed dead/superseded, deleted. See §4.
  - **Dashboard chart widgets** (PortfolioIntelligencePanel,
    CollectionValuationScoreCard, GoalsProgressWidget, SubjectRankingsWidget)
    — real, all reading data already live elsewhere; placed on `/portfolio`
    Insights. See §4.
  - **Everything else (~55 more files, including the analytics/repo-
    abstraction layer)** — deleted. `tsc` clean. See §4's "D." entry.
  - **No more open dead-code items from this sweep.**
- Everything else in §2 is a go; just needs building/verifying/a migration.

---

## 4. Done recently (don't redo)
- **2026-08-22 — picked up work after the 3D-museum session's chat ended;
  EK: "dig in anywhere and complete any task you can."** Checked the
  3D-museum branch (`claude/museum-map-doorways`) status first — confirmed
  it's still unmerged, not this branch's to touch, most recent real fix
  there (Hero "huge box" + Salon/Store contrast) already landed clean.
  Then swept `main` for genuinely completable (not device-blocked) items
  from the placeholder audit + older open notes:
  - **Fixed: Collector Level badge always scored followers as 0.**
    `computeCollectorLevel()` already supports a followers term, but
    `TopNav.tsx` called `loadMyCollectorLevel()` with no argument. Now
    fetches the real count via the existing `getFollowerCount()` (same
    helper `/more` uses) before computing the level.
  - **Fixed: Type dropdown + Attributes checkboxes on `/vault/add` never
    survived cloud sync.** `itemType`/`itemAttributes` are real `VaultItem`
    fields, correctly saved locally, but `vaultCloud.ts`'s Supabase row map
    never included them in either direction — dropped silently on every
    cloud round-trip. Added to both directions + the standard missing-
    column fallback (matches the existing tags/brand pattern) so saves
    keep working even before the migration runs. New migration:
    `20260822_vault_item_type_attributes.sql` (adds `item_type text`,
    `item_attributes text[]`) — **not yet run, ask EK.**
  - Confirmed already fixed by a concurrent session mid-sweep (no
    duplicate work needed): the dead "Scan" button in Vault's Add-to-
    Museum modal, and the fake Lounge Market Pulse/Volume sparkline charts.
  - Reviewed but found no bug (code reads correctly, just genuinely
    unverified live): Halls' "Auto-tag my collection" button — traced the
    full handler (`suggestAutoTags` → `saveItems` → `syncAllItemsToCloud`),
    all real, all correctly wired.
  - Left alone, correctly: PSA/Discogs lookups (blocked externally/on an
    EK env-var check), CGC lookup (no viable free API, real gap not a
    bug), Documents/avatar local-only storage (honestly disclosed,
    already EK's explicit call), `/clubs` (honestly labeled "Coming soon,"
    not misleading).
- **2026-08-12 overnight, while EK slept — lens-switch on zoom (§B11) +
  Stripe customer-id persistence (§2I).** EK asked whether zoom uses a
  phone's multiple cameras; it didn't, so built best-effort ultra-wide
  lens detection/switching (`src/lib/scanners/cameraLenses.ts`) wired
  into both camera panels' existing zoom gesture — Android-only in
  practice, unverified on real multi-lens hardware. Also fixed the
  billing gap flagged a few passes back: Stripe customer id now persists
  to `profiles.stripe_customer_id` via the webhook instead of only living
  in one device's localStorage — migration not yet run. Also corrected a
  stale §B4 note that still said the regular-Add-camera visual-match work
  "hadn't started" when it shipped back on 2026-08-08/09.
- **2026-08-11 — Lookup-API safety guards (upcitemdb/Discogs/Metron) + live
  camera zoom.** Full detail in §B10/§B11. Generic permanent-cache +
  daily-budget guard (same shape as PSA's), applied only where a real
  daily cap exists (upcitemdb); Discogs/Metron get the cache plus honest
  429 handling instead of an invented quota. Migration
  `20260811_lookup_api_guards.sql` — **not yet run**, fails open until
  then. Also: feature-detected live pinch/slider zoom on the camera
  preview before capture (`src/hooks/useCameraZoom.ts`), expected to work
  on Android Chrome only — don't be surprised if it shows nothing on an
  iPhone, that's the honest platform limit, not a bug. Same pass also
  finished wiring the Brand field's cloud sync (§B9) now that its
  migration is confirmed run.
- **2026-08-10 — Barcode/QR scanning rebuilt as tap-to-scan (native detector +
  JS fallback), PSA auto-fire bug fixed.** Full detail in §2B above — don't
  re-litigate the engine choice or re-add an always-on effect; the "on-demand,
  bounded burst" design is deliberate, not a placeholder. Confirmed working on
  a real device the same night, after also swapping the fallback decoder to
  `zxing-wasm` — see §2B for the full saga.
- **2026-08-11 — Barcode scans now connect to real lookups** (comic/vinyl/
  UPC/book) across `/capture`, `/vault/add`, and Quick Add, instead of just
  confirming a code was read. Full detail in §2B8 — includes a real
  visibility bug (fixed) and a "no match" message that now names what an
  unmatched code probably is (CGC/PSA-style certificate) instead of reading
  like a failure. The actual "found a real match" success path is still
  unconfirmed on a real device — don't assume it works without checking §2B8's
  open items first.
- **2026-08-08/09 — Regular Add's camera, rebuilt to actually match Quick
  Add** (many rounds — EK's patience on this one is worth documenting so
  the reasoning doesn't get re-litigated from scratch):
  - **Removed the embedded live camera entirely** from the Add screen. It
    used to sit permanently inline next to the builder form (in TWO places:
    a dead "idle" phase nobody could reach, and the default "review" phase
    view before any photo existed) — deleted both, plus the whole dead
    idle/loading/error `phase` state machine that one of them lived in
    (confirmed unreachable: nothing ever set `phase` to anything but
    `"review"` except a button inside the equally-unreachable error
    branch). The Add screen now shows a plain static "Add a photo" tile;
    tapping it opens the camera as its own full-screen popup — the same
    self-contained screen Quick Add uses, never live-embedded in the page.
  - **The popup's actual visual structure now matches Quick Add's, not just
    its behavior**: one header row (was two stacked), no padding/rounded
    corners on the panel itself (header/video/footer each own their edge
    instead), video edge-to-edge (was sitting in its own padded card),
    corner-bracket guide instead of a ring outline, front-facing cameras
    filtered out of the picker (device labels reliably say "facing
    front"/"facing back"). Extracted `DropdownPill` out of
    `ScanCapturePanel.tsx` into `src/components/ui/DropdownPill.tsx` so
    both screens render the literal same dropdown component, not two
    versions that can drift apart — added a Frame picker using it (that
    state already existed in `CameraCapturePanel.tsx`, just had no UI).
  - **Fixed the letterbox bars two different ways before landing on the
    right one.** First tried switching the video to `object-cover`
    (crop-to-fill, like Quick Add) — this broke capture accuracy: a
    capture always grabs the camera's full native frame regardless of how
    it's displayed, so the live preview started showing a tighter crop
    than what actually got saved. Reverted that. Landed on the real fix:
    once the camera's actual aspect ratio is known
    (`videoWidth`/`videoHeight` on `canplay`), the video's own *container*
    is shaped to match it via CSS `aspect-ratio`, instead of sitting in an
    arbitrary flex-sized rectangle — `object-contain` then shows ~zero
    bars because the box already matches the footage, with no cropping
    happening anywhere and therefore no preview/capture mismatch possible.
  - **Confirmed with EK: the remaining small gap when testing is a desktop-
    webcam artifact, not a bug** — a landscape webcam (16:9) squeezed into
    a portrait-shaped popup can't fill it without cropping something,
    full stop. A real phone's rear camera already outputs video shaped to
    match how it's held, so this shouldn't show up there. **Explained why
    Quick Add and Add's camera intentionally use different object-fit
    (`cover` vs `contain`)** — not inconsistent code, two different real
    needs: Quick Add never lets you crop afterward (straight into a batch),
    so cropping the live view costs nothing; Add always has a crop-editing
    step after the photo, where the live view has to show the whole,
    uncropped frame for the crop tool to be trustworthy. **Added this
    explanation as a permanent Guide entry** (`src/app/guide/page.tsx`,
    "Why Add's camera looks different from Quick Add's") so it's answered
    for any user who asks, not just tribal knowledge from this thread.
  - **Added drag-to-reorder to the thumbnail rail** (press, hold, drag any
    photo onto any slot — dragging onto the first slot makes it the cover).
    Generalized the old `makeCover` (front-only) into `reorderImages(from,
    to)`. Pointer events, not native HTML5 drag-and-drop (poor/inconsistent
    touch support) — a plain tap still selects the thumbnail; a press that
    moves past an 8px threshold becomes a drag, with a live green
    drop-target highlight.
  - Also fixed along the way: the "Add a photo — optional" empty-state tile
    was forced into a 4:5 aspect-ratio box sized for showing an actual
    photo, even with nothing to show — now only applies that ratio once a
    photo exists.
- **2026-08-08 — bug-report two-way communication.** EK: resolving a bug
  report should tell the reporter, and EK should be able to reply, not just
  flip a status pill. Built in-app only (EK's explicit call — email would
  need a new third-party service, deferred for now, may revisit later).
  Migration `20260808_bug_report_replies.sql` (confirmed run by EK) adds
  `admin_reply`/`admin_replied_at`/`updated_at` to `bug_reports`. Admin bugs
  page (`/admin/bugs`) now shows any existing reply + a reply composer per
  report. `notificationFeed.ts` gained a new source that reads the
  *reporter's own* rows (RLS already allowed this — `user_id = auth.uid()`,
  wasn't being used) and surfaces a "resolved" or "reply" alert via the
  existing Alerts bell once you resolve or reply.
- **Follow-up (2026-08-05 night), after EK reviewed the orphaned-files report
  and said "do all A/B/C":**
  - **A. Comic barcode/OCR scanner wired in** — `runAiIdentify()` in
    `capture/page.tsx` now runs `scanComicRegionsFromFile()` (from
    `comicBarcode.ts`) in parallel with the existing vision+barcode calls,
    gated on Universe=Pop Culture + Category=Comics already being selected
    (the OCR pass is real CPU cost, shouldn't run on every capture). Results
    merge additively -- comic-derived title/issue number only fill blank
    fields, never overwrite vision's answer; the parsed issue/cover/printing
    breakdown always gets appended to notes. **Not verified against a real
    comic cover** -- please test and report back on accuracy.
  - **B. Dead multi-workspace-switching code removed** — `workspaces.ts`
    trimmed to just `getRoleDefaults` (the one real, used piece);
    `WorkspaceMembersPanel.tsx` + `MemberRoleBadge.tsx` deleted (both fake
    data, zero other importers, confirmed by `tsc` staying clean).
  - **C. Analytics widgets placed on `/portfolio` Insights** — added a new
    "Collection Intelligence" section at the bottom of
    `InsightsOverview.tsx`: `PortfolioIntelligencePanel` +
    `CollectionValuationScoreCard` (both driven by the same `metrics` object
    the page already computes), `GoalsProgressWidget` (added a `goals` state
    + `syncGoalsFromSupabase()` load, this page never touched goals before),
    `SubjectRankingsWidget` (computed straight from the page's existing real
    `items`). All 4 already handle their own empty states.
  - **D. Everything else deleted too** — EK's follow-up call ("just delete
    all of them, same logic as workspace cleanup"): removed the remaining
    ~55 files from the original orphan sweep, including
    `src/lib/analytics/portfolio.ts` and `src/lib/repo/vaultRepo.ts` (the
    "still open" pair above). Before deleting, re-verified the list against
    the CURRENT repo state (not the stale pre-A/B/C sweep) so nothing from
    A/C got caught by mistake, and caught 7 false-positive "still
    referenced" hits from an initial basename grep (generic words like
    "index"/"tokens"/"portfolio" matching unrelated code, not real imports)
    — re-verified each with a precise import-path grep before touching
    anything. Also found one more genuine orphan the original sweep only
    mentioned in passing (`VirtualizedVaultGrid.tsx`). `tsc --noEmit`
    stayed clean after all 55 deletions — nothing referenced any of them.
    **This closes out the entire dead-code review from tonight — nothing
    left flagged.**
- **Third overnight pass (2026-08-05 night), while EK slept — camera fixes,
  pill sweep #2, dead-code cleanup:**
  - **Camera capture (`CameraCapturePanel.tsx`, `capture/page.tsx`,
    `barcodeScanner.ts`, `ScanCropEditor.tsx`)** — a long back-and-forth with
    EK over several rounds (their phone vs. the app's camera, side-by-side
    screenshots). Landed on: (1) throttled the live barcode-scan loop from
    checking all 10 regions x 3 decode variants EVERY ~450ms tick down to a
    round-robin of 2 regions/tick (this was almost certainly the "everything
    feels slow" cause — up to 30 synchronous ZXing decodes every half-second,
    continuously, while the camera was open); (2) found and fixed a real
    regression I introduced earlier the same night: a `deviceId: {exact:...}`
    hard constraint in `getUserMedia()` that could hang for seconds on a
    stale device id before falling back — switched everything to soft
    `ideal` constraints; (3) reverted an ill-advised resolution bump (tried
    1080p then ~4K "ideal" — neither measurably helped sharpness and the 4K
    attempt likely caused a reported "longer than wide" aspect issue by
    requesting an explicit landscape pair); (4) added a dedicated "Take Real
    Photo" button (separate from "Upload", which stayed a plain file/drive
    picker) that hands off to the phone's actual native camera app via
    `capture="environment"`, then routes the result through the same
    ScanCropEditor crop step the in-app camera gets — this is the *honest*
    answer to "why does the photo look worse than my phone's camera": web
    `getUserMedia` structurally cannot reach HDR/multi-frame processing a
    native camera app uses, no constraint tuning closes that; (5) removed the
    7-preset Filter dropdown (all ~5-10% CSS tweaks, indistinguishable from
    each other — confirmed real, just too subtle) and replaced it with one
    real one-tap "Brighten" toggle (sun icon, meaningfully brighter, next to
    the existing background-removal button); Fine Tune sliders stay for
    manual control; (6) fixed the multi-photo thumbnail rail in
    `capture/page.tsx` — tapping a non-cover photo used to do nothing but
    show a tiny "Set cover" button; now tapping ANY thumbnail previews it
    big above with a glowing border, and "Make Cover" is its own explicit
    action shown only when a non-cover photo is selected; (7) trimmed
    repeated "still have to scroll" complaints across several rounds:
    removed the page subtitle entirely, removed CameraCapturePanel's
    duplicate internal header when inline, tightened header-to-content
    margins. Left a temporary on-screen capture-timing readout
    (`captureTiming` state in `CameraCapturePanel.tsx`) in case the ~10s
    complaint isn't actually fully resolved — remove once confirmed fixed.
  - **Pill sweep #2** — ran a fresh Explore-agent sweep (the "finished"
    claims from earlier same-night work + a concurrent session's own "Pill
    sweep"/"PillButton-everywhere" commits were both wrong). Verified before
    touching: confirmed `vltd-primary-button` + `rounded-full` combos
    (login/signup/PublicHomeClient/BugReporter) are NOT bugs -- `vltd-
    primary-button`'s `border-radius:4px` lives in an unlayered stylesheet
    (`vltd-design.css`, plain `import` in `layout.tsx`, not routed through
    Tailwind's `@layer`), which always wins over Tailwind's layered
    `rounded-full` utility per the CSS cascade-layers spec regardless of
    source order -- those already render squared. Fixed 4 real ones: two
    "Close" buttons in `CameraCapturePanel.tsx` (missed by the same night's
    earlier Retake/Save fix), the new "Make Cover" button, 4 Link-styled
    CTAs in `insurance/page.tsx` ("Smart Scan"/"Add manually"/"Back to
    Vault"/"Portfolio"), and 2 in `ai/review/page.tsx` ("View vault"/"Back
    to queue"). If a THIRD sweep ever seems needed, don't just re-trust
    whatever the last "done" claim says -- grep it yourself.
  - **Dead-code cleanup** — ran an Explore-agent sweep for orphaned files
    (zero import references anywhere in the repo) under `src/components/**`
    and `src/lib/**`. It found ~65 candidates and claimed 5 were "old code
    superseded by a live replacement" -- I verified each claim myself before
    deleting anything, and 2 of the 5 turned out to be **wrong**: the
    claimed "live replacement" (`src/lib/analytics/portfolio.ts` and
    `src/lib/repo/vaultRepo.ts`) had zero importers either, so those weren't
    simple old-vs-new swaps. Only deleted what I could personally confirm
    had a real, currently-used replacement:
    - `src/lib/vaultIntelligence.ts` (real replacement: `itemIntelligence.ts`,
      confirmed used in 8+ files)
    - `src/lib/vaultBackup.ts` (real replacement: `RestoreVaultButton.tsx`/
      `VaultExportButton.tsx`, confirmed used in vault pages)
    - `src/lib/sellItem.ts` (real replacement: `vaultActions.ts`/
      `salesModel.ts`, confirmed used in `activity`/`sales`/drop-review flows)
    - `src/lib/vaultRepo.ts`, `vaultRepo.local.ts`, `vaultRepo.api.ts`,
      `vaultRepo.index.ts` (a self-contained 4-file cluster that only
      referenced each other, zero external callers -- deleted the whole
      cluster together; did NOT delete `src/lib/portfolioAnalytics.ts` or
      `src/lib/repo/vaultRepo.ts` since their "replacements" turned out to
      also be unused, so calling either direction "superseded" wasn't
      actually true)
    `npx tsc --noEmit` stayed clean after every deletion -- a real safety
    net here: if any of these had a live importer I'd missed, the build
    would have failed immediately with "cannot find module."
    **NOT deleted, flagged for EK's decision (see §3):** ~55 more orphaned
    files the sweep found, plus a short list of unused exported functions
    inside otherwise-live files (`signUpWithPassword` in `auth.ts`,
    `redeemReferralCode` in `referral.ts`, `removeSaleById` in
    `salesModel.ts`, `getPublicVaultUrl` in `publicProfile.ts`,
    `effectivePricingValue` in `pricingMvp.ts`, and the entire
    multi-workspace-switching surface in `workspaces.ts` which nothing calls
    except `getRoleDefaults`). Several of the orphaned files read as
    scaffolded, never-wired features rather than leftover cruft --
    `comicBarcode.ts` (~380 lines, a whole comic-barcode-scan pipeline),
    `workspaces.ts`'s switching UI, a cluster of dashboard chart/widget
    components (`NeonBarChart`, `NeonDonut`, `MiniSparklines`, `TiltCard`,
    `SubjectRankingsWidget`, `CollectionValuationScoreCard`,
    `PortfolioIntelligencePanel`, etc.) -- didn't want to guess whether these
    are intentional WIP or genuinely abandoned, so left them alone per the
    "ask before removing a feature" rule rather than assume either way.
- **Second overnight pass (2026-08-03 night), while EK slept — production-readiness
  fake-data sweep, prompted by EK asking to check the whole app:**
  - Watchlist "7d change" (`-$2,340`, always shown even empty) — removed, no
    value-history tracking exists for watchlist items.
  - `/more` StatStrip — `"+12.6% (30D)"` and `"276"` followers were static
    literals on every visit (both desktop + mobile stat strips). Now real:
    30D change from `valueHistory.ts` (same fallback pattern
    `InsightsOverview.tsx` uses), followers from `lib/follows.getFollowerCount`.
  - VLT Lounge (`community-board/page.tsx`) — `"128 online"` + the "Lounge
    Live"/"Hot Threads" mock arrays were static, shown to every signed-in user
    with zero backend behind them. Replaced with honest empty states.
  - `goals/page.tsx` — GoalRow "due dates" (`"Due Aug 31, 2025"` etc.) were
    assigned by array index; `GoalProgress` has no due-date field. Removed.
  - `InsightsOverview.tsx` (`/portfolio`) — removed a fake, non-functional
    date-range button (`"Apr 18, 2024 - May 18, 2026"`, no onClick) next to
    the real KPIs; fixed the Total Vault Value card's sub-stat, which
    hardcoded a `+`/green regardless of actual ROI sign and mislabeled
    all-time ROI as "vs last 30 days."
  - `VaultInner.tsx` — reworded a leftover "Existing demo items may not have
    subcategories yet" tip shown to real users with real (non-demo) vaults.
  - `/account/billing` — fixed the hardcoded Free-plan display; see §2I.
  - Ran a parallel Explore-agent sweep across every route in the app (~46
    directories) for the same two bug shapes (hardcoded stat/list literal
    next to real data; demo-seed calls bypassing the `getActiveProfileId()`
    guard). Confirmed clean elsewhere — see git commit messages for the
    full per-directory rundown if you want it.
  - Investigated but deliberately NOT fixed — see §2G, §2H, and the
    `stripe_customer_id` gap noted in §2I. All three need your decision, not
    a guess, before touching them.
  - Verified insurance report/packet/item pages (EK flagged via a suggested-
    task chip) — already correctly guarded, false alarm, no change needed.
  - **Events saved-list sync** (§2F) — added the `saved_events` migration +
    `savedEventsModel.ts` + wired `/events`. Migration not yet run — see the
    ⚠ note in §0.
  - **`/user/profile` real identity fields + display-name sync bug fix** (§2G,
    §2H) — EK confirmed: real self-declared age verification, not ID
    verification. Added the `profiles.date_of_birth`/`age_verified`/
    `marketing_opt_in` migration (not yet run — §0 ⚠), wired `/user/profile`
    to load/save through the real `profiles` row (`updateProfile()` +
    `syncPublicProfile()`), fixed `syncPublicProfile()` to read the real
    display name/avatar emoji instead of the stale local copy, made the fake
    editable email field an honest read-only display of the real login
    email, removed the "Reset to defaults" button (was one click away from
    wiping real cloud-synced fields once they went live), and renamed/scoped
    down "Clear Local Demo Data" so it no longer touches the local vault
    cache under a false "demo" label.
  - Merged `main` in twice mid-session (other work landed on `main` while
    this ran: a "Vision prompt" commit, then a 3-commit "Pill sweep"/
    "PillButton everywhere" migration) — both merges were clean fast-forwards
    with no conflicts, `tsc` verified after each.
- **Follow-up (2026-08-04 night), after EK ran both pending migrations and
  said yes to merging the profile pages + building real email-change:** see
  the rewritten §2H above for full detail — `/user/profile` merged into
  `/account` (Avatar/Identity & Security/Data Controls sections added),
  `/user/profile` now redirects to `/account`, real email-change flow added
  to `/account/security` via `supabase.auth.updateUser({ email })`. `tsc` +
  `eslint` clean (only pre-existing React Compiler try/finally advisories,
  same shape already present elsewhere in these files). Also matched the
  concurrent emoji-sweep pass below: swapped the one "Verified ✅" chip
  copied into `/account`'s new Age Verification section for the themed
  `Glyph` (`check`) treatment.
- **Third overnight pass (2026-08-03, after the above two), EK asleep again —
  emoji sweep + Documents feature:**
  - **Emoji sweep**: replaced raw emoji glyphs with the themed `Glyph`
    component across `UniverseRail.tsx`, `account/page.tsx`,
    `onboarding/page.tsx` (the three remaining raw `UNIVERSE_ICON[key]`
    sites), `ai/drafts`/`ai/review` missing-fields warning chip, the museum
    Announce button, `ThemeToggle`, `CameraCapturePanel`'s soft-image
    warning, the auction countdown chip, the public profile's
    vault-not-found lock icon, `vault/readiness` (missing-thumbnail + empty-
    state icons), `TopNav`'s museum nav-card icon, the public `share/[itemId]`
    missing-image placeholder, `account/billing`'s plan-star icon,
    `ScanVerifySheet`'s AI-disagreement flag, `user/profile`'s two "age
    verified ✅" chips, and `vault/item/[id]`'s Export-for-Social/
    Start-Auction/Registry-collector-count icons (+ updated `guide/page.tsx`'s
    doc text that quoted the old raw emoji). Deliberately left alone:
    `vault/frames/page.tsx`'s "⭐ Key Item"/"🔥 HOT" stickers — that screen
    rasterizes the live DOM to a downloadable PNG via html2canvas, so
    swapping to an SVG glyph risks a compositing regression in the exported
    image I can't verify without opening a browser; needs a visual pass, not
    a blind edit. Also not touched: `kickstarter/page.tsx`'s 🚀 (no themed
    glyph is a good semantic match for "rocket" yet), and the longer tail of
    more speculative/design-heavy sites (shop.tsx's ~34 product icons,
    HomeClient's social-platform brand icons, SeasonalBanner's decorative
    seasonal icons, v/[profileId]'s expanded UNIVERSE_EMOJI map) — all need
    real visual judgment, not a mechanical swap.
  - **Documents (§2C) — built, see that section.** EK's answer ("everything
    should be private unless shared") was a clear enough steer to build
    local-only rather than a decision that needed a Supabase dashboard call.
  - Dropped two recurring asks per EK's explicit feedback: the
    background-removal-freeze device check and the "Syncing…" chip styling
    ask — EK said twice they don't know what these mean; not re-raising them.
  - **Full-width pill/dropdown sweep — the 4 known offenders, fixed:**
    `EventTypeSelect` (`events/page.tsx`) was stretched via a
    `grid-cols-[minmax(0,1fr)_170px]` container next to the fixed-width
    "Saved Events" button — switched the container to `flex flex-wrap` and
    the select to `w-auto`. `WishlistCard`'s "Move to Vault" and
    `GoalCard`'s "Add N to Want List" both had `flex-1` while their sibling
    buttons didn't — dropped `flex-1`, added matching padding. Checked and
    ruled out a 5th suspected site: `VaultWallView.tsx`'s Advanced-filters
    Status `<select>` — its `w-full` matches every sibling text input in
    the same filter grid (Grade/Category/Storage/Source), a genuine
    uniform filter-form pattern, not a stretched pill. Left alone.
- **Second overnight/late-night pass (2026-08-03), after EK woke up and tested live:**
  - **Rename `/wishlist` → `/watchlist`** (EK's decision) — moved the route,
    fixed the two `href="/wishlist"` links, added a permanent redirect from the
    old path, updated `AddToWishlistButton`'s visible copy. Left the underlying
    `wishlistModel.ts`/`watchlistModel.ts`/`comicWishlistModel.ts` library files
    alone — three genuinely different data sources the Watchlist page merges
    into one list, not a naming collision.
  - **Real bug found + fixed: Quick Add locked items into the wrong Universe.**
    `ScanCapturePanel.tsx`'s Universe dropdown hardcoded a default of "TCG" —
    EK scanned 3 comics, they came back as "Magic: The Gathering..." at low
    confidence, and there was no way to fix the Universe in Verify (only an
    auto-flag that fires when the AI disagrees with itself, which didn't fire
    since the AI was hinted "the collector says this is TCG" and just complied).
    Three fixes: (1) Universe dropdown now remembers your last pick
    (`localStorage`, `SCAN_UNIVERSE_PREF_KEY`) instead of resetting to TCG,
    (2) added a real Universe dropdown to `ScanVerifySheet` so you can always
    fix it manually, (3) softened the AI hint wording to explicitly favor what
    it sees over the stated Universe.
  - **Review sheet (`ScanReviewSheet.tsx`) can now edit Universe/Category
    per item AND has a "Skip AI" checkbox** (opposite the thumbnail) — skipping
    doesn't spend a scan, item stays blank for manual entry. Both wired through
    a new `onPatch` prop that updates the source `capturedItems` state directly.
  - **Added a Category pill next to Universe** on the scanner screen
    (`categoryLabel` state already existed, just had no control) — EK wanted
    the whole batch pre-settable, not just Universe. See §2F for the
    Subcategory-pill follow-up question.
  - **Verify sheet: split Value into Cost ($) + Value ($)** — `purchasePrice`
    was silently dropped before; now threaded through the draft → saved item.
  - **Item Notes: pencil-icon direct edit + Clear button** next to
    Regenerate (`vault/item/[id]/page.tsx`) — `Section` component now takes an
    optional `action` slot for this. Regenerate itself (`generateItemCopy.ts`)
    was already deterministic/field-based, not random — just needed more
    fields filled in for a better result, not a code fix.
  - **Vision prompt: added comic-vs-card visual cues**
    (`api/ai/analyze-item/route.ts`) — cover size, publisher logos, staples —
    and told the model to give an honest vague title instead of a confident
    wrong one when text isn't legible. Prompt-only, needs a real test.
  - **Capture-screen "Auto ID" is now metered** the same as Quick Add
    (1 scan/image, `consumeBulkScans`) — EK's call: "any AI scan should be
    limited" on the free tier. Barcode/UPC lookup stays free (local decode).
  - **Pill sweep, actually finished this time.** ~55 files total across two
    passes: every genuine `rounded-full` straggler (a real action button in the
    wrong shape) app-wide. Confirmed NOT violations and left alone: `/admin/*`
    (separate internal-tool skin), toggles/chips/badges/avatars/icon-only
    buttons, and anything using `vltd-pill-main-glow`/`vltd-primary-button`/
    `.vltd-action-module__block` (verified some of these against their actual
    CSS, not just the class name, before ruling them out).
  - **PillButton-everywhere, actually migrated** (not just shape-matched).
    Extended `src/components/ui/PillButton.tsx` with `href` (renders as
    `next/link`), a `danger` variant, and a `style` passthrough for bespoke
    colors — then migrated every standard-sized (h-10/11/12, text-sm) action
    button/nav-pill onto the literal component across ~20 files. Deliberately
    NOT migrated: glossy gradient primary CTAs (their own established tier),
    the compact toolbar/mass-select-bar tier (~38px, smaller text — forcing
    PillButton's fixed 44/40px in would risk row overflow), and per-item
    micro-chips in dense rows (Review/Verify sheet rows, card action rows).
    These three tiers are already correctly shaped, just not literally
    PillButton, which was never sized for them.
  - Investigated and ruled out two more suspected fake-data bugs: the insurance
    report pages' `DEMO_ITEMS` (via `loadItemsOrSeed()`) only shows demo data to
    logged-out marketing visitors, never a signed-in user's real (possibly
    empty) vault — correctly guarded, not a bug. Same for the "+X% (30D)" stat
    on `/more` — real computed value-history data, not hardcoded.
- **Overnight pass (2026-08-03), while EK slept:**
  - **Field locks on the capture builder** (was §2A) — ported the `/vault/add`
    lock UX onto capture's Identity/Category fields, own storage module
    `src/lib/captureAddState.ts` (kept separate from `bulkAddState.ts` since the
    two screens' "number" field means different things — reusing one map would
    cross-contaminate). Verified end-to-end (lock → reload → value carries over).
  - **Removed dead Quick-Add-toggle code path** in `capture/page.tsx`
    (`handleQuickAddCapture`/`quickAddCountRef`/singular `persistCapturedImage`)
    — unreachable since both `CameraCapturePanel` calls already pass
    `bulkToggle={false}`.
  - **Removed fake AI-draft demo seeding** (`aiCatalogDrafts.ts` seeded
    Jordan/Charizard/Spider-Man drafts for signed-in users) — no-fake-data rule.
    Also deleted `src/_delete-after-testing/seedDemoIfEmpty.ts` +
    `src/lib/demoSeed.ts` (same pattern, already-dead code).
  - **Barcode scan: added top-of-frame regions** for graded-slab QR/Code128 —
    see §2B, needs your device test.
  - **Capture: capped long-edge resolution to 2200px** on high-res camera
    streams (`CameraCapturePanel.tsx`) — keeps filter/crop/upload fast on
    phones that stream past 3000px.
  - **Crop: added "Use as-is"** to skip cropping in one tap.
  - Fixed `SellItemModal.tsx` (solid black box in light mode — theme vars now).
  - Re-verified `REWORK_PUNCHLIST.md` + `EVENTS_PUNCHLIST.md` against current
    code: Events' dead controls + fake stats/fallback events were already fixed
    same-day back on 2026-07-17 (docs just never got updated). Still-open items
    from those two docs folded into §2F above.
  - Corrected two stale "still open" claims in this handoff that were already
    fixed in code (auto-crop-to-guide, MEDIUM CONFIDENCE badge) and one wrong
    claim in `THEME_SWEEP.md` (the cyan CTA color is correct, not off-brand).
- **Capture panel tighten** (`CameraCapturePanel.tsx`): remembers last-used camera
  (localStorage); description → info "i"; removed "Retry"; "File" → "Upload";
  Upload/Quick Add/camera-picker moved into one compact top row with squared pills.
- **Perf:** turned OFF the live object-detection ML (TF.js + coco-ssd) that ran
  every ~900ms in `CameraCapturePanel.tsx` (flag `ENABLE_OBJECT_DETECTION=false`).
  The fixed frame guide + barcode scan are unaffected.
- **Quick Add scanner rebuilt to EK's spec** (`ScanCapturePanel.tsx`, full rewrite):
  manual-only shutter (removed auto-lock + Front/Back/Next + Quick/Bulk); **3
  squared dropdown pills — Universe / Frame / Camera** (titles stay constant,
  pick highlights in the menu); **Done → Finished** (brushed look); removed the
  upload icon; **rear-camera default + Camera picker** (fixes stuck-on-front);
  **top-left ghost counter**; **last-shot thumbnail on the LEFT, tap it = Review**;
  **light-blue frame corners** (bold, dark outline so they don't wash out on
  holo cards) that brighten on capture; **soft ghost-green capture flash**;
  panel sits **above the bottom nav** (`100dvh − var(--bottomnav-h)`);
  **app-theme background** (`--bg/--surface/--border/--fg`).
- **Review sheet** (`ScanReviewSheet.tsx`): top-anchored above the nav; ~5 items
  then scrolls; **removals persist** (state lifted to the scanner; sheet is now
  controlled via `removed/onRemove/onUndo`); camera stays live behind it (review
  is an overlay) so closing it (X) returns to the camera to keep adding.
  **Removed items now sink to the bottom** (Undo kept, stable "Item N" number);
  **tap a thumbnail to enlarge** (front + back).
- **Quick Add AI-fill + verify flow (LOCKED)** — `ScanCapturePanel` + `ScanVerifySheet`.
  Flow: capture many → review/remove → **"Add N to Vault"** (this is the commit
  point — AI ONLY runs here, not during capture) → **AI identifies each kept photo
  (metered: 1 scan/image, per-plan quota via `getBulkScanStatus`/`consumeBulkScans`)**
  → progress overlay → **verify sheet** (compact rows: name/category/subcategory/
  value, per-item Rescan, confidence chip, ticker, tap-thumb to enlarge) →
  **"Save N to Vault"** commits (IndexedDb + sync queue) and **routes to `/vault`**.
  **No camera after saving; the group is LOCKED once you hit Add** — to add more you
  start a new group (no append-after-commit, by EK's decision).
  - Category mapping: curator's chosen Universe wins; AI category matched within it,
    and the game/type the AI calls a "category" is matched into the **Subcategory**
    (e.g. TCG has one category "TCG / CCG"; Pokemon/Magic/etc. are subcategories) —
    `visionToDraftPatch` never wipes a valid category to blank. If AI clearly detects
    a *different* Universe it shows an amber **flag** ("AI thinks this is X — tap to
    switch"), it doesn't silently discard it.
  - Full AI result rides on the draft (`vision`) and is saved onto the item
    (subtitle/number/year/grade/condition/certNumber, `notes`=AI description) so the
    item page is populated like a normal single scan.
  - Camera-page counters (ghost badge, `Finished (N)`, thumb) read the **kept** count.
  - Hardening (32b479b): 60s timeout per AI call (stall → manual entry), items saved
    with `status:"COLLECTION"`, `parseValue()` strips $/commas, verify sheet won't
    close on a backdrop tap (drafts cost scans). NOTE: `vaultCloud` is an allow-list —
    AI `year`/`condition`/`conditionReason` are NOT columns, so they stay local-only
    (grade/subtitle/number/cert/notes/category/value/status DO sync). No upsert throw.
  - **Legacy manual Quick Add form DELETED.** `src/app/vault/quick/QuickAddClient.tsx`
    is now a ~25-line launcher that just mounts the scanner and routes to `/vault`
    on close (cancel or after save). The old "Image first. Save fast." hand-entry
    form / Recent Saves / crop editor / AI-Assist that used to live there is gone —
    it was orphaned once the scanner replaced it. File uploads live in Bulk (`/vault/bulk`).
- Bulk upload + scan quota (migration + admin + lib + `/vault/bulk`) — verified live.
- Emoji→glyph on user-facing pages (Discover/Goals/AutoShare/Patreon).

---

## 5. Key files
- **`CHECKLIST.md`** (repo root) — scannable done/pending list of everything
  from the 55-file dead-code sweep through tonight's barcode/Cards/PSA/
  Discogs work, plus a clear "what needs EK's action right now" list at the
  bottom. Update this alongside HANDOFF when a checklist item's status
  changes — it's meant to stay a quick scan, not prose.
- Capture screen: `src/app/capture/page.tsx`
- Inline camera panel: `src/components/CameraCapturePanel.tsx`
- Quick Add fast scanner: `src/components/ScanCapturePanel.tsx`
- Scan review sheet: `src/components/ScanReviewSheet.tsx`
- Field-lock system: `src/lib/bulkAddState.ts` (`/vault/add`) · `src/lib/captureAddState.ts` (`/capture`, its own module — see §4)
- Barcode: `src/lib/scanners/barcodeScanner.ts` · Crop: `src/lib/scanners/cropImageFile.ts`
- Cloud save (column map): `src/lib/vaultCloud.ts` · Vault model: `src/lib/vaultModel.ts`
- AI vision: `src/lib/ai/openaiVision.ts` · Scan quota: `src/lib/bulkScanQuota.ts`
- Theme vars + `--bottomnav-h`: `src/app/globals.css`
- Approved mockups: `C:\Users\EK\.codex\generated_images\019e6d3a-5dd3-7ed1-be13-942347ebb5c9\`
- **`GRADING_AND_PRICING_APIS.md`** (repo root) — living reference (not a
  handoff note, keep it updated) for which grading companies/categories have
  a real cert-lookup or pricing API wired in vs. free-text-only, and what's
  being explored (CardHedge for cards) vs. ruled out (CGC's own dealer-only
  API, Apify scrapers). **CGC-graded comics are explicitly unaddressed** —
  don't let that get lost; PSA never covered comics to begin with (they
  don't grade comics), so it's not something the PSA work already solved.

---

## 6. First moves for the new chat
1. Read this + `MEMORY.md`. Confirm with EK **who owns `/capture` right now**
   (this chat vs the parallel Codex edits) before editing capture files. Also
   re-check the new not-this-chat's file list in §0 (Aug 11) before touching
   anything under `museum/`, `owner-lab/`, or the repo-root `marketing/`/
   `product/` folders.
2. **No migrations pending** — `20260820_conversation_prefs.sql` (star/hide)
   and `20260820_fix_dm_active_profile_scope.sql` (fixes the multi-profile
   conversation-vanishing bug) were both confirmed run by EK 2026-08-20 and
   re-verified live — see §2's 2026-08-20 Messages entry. `20260819_server_side_tier_limits.sql`
   (server-side billing enforcement) and `20260819_direct_messages.sql`
   (real DMs) were both confirmed run by EK 2026-08-20. `SCANDEX_API_TOKEN`
   is also DONE — set, deployed, and confirmed working live 2026-08-20 (see
   §2 item 3's update) — don't re-flag any of these.
   Everything before that (Stripe customer-id, lookup-API guard,
   gallery-alias, lounge-posts) is confirmed run. Cross-device billing
   (Payment method/Invoices/Cancel) is live; worth a glance at
   `profiles.stripe_customer_id` after the next real Stripe checkout to
   confirm it's actually populating (webhook logic was verified by
   reading, not by triggering a real checkout event).
3. Ask EK what they found testing overnight: does the digital-zoom
   fallback work on desktop/iOS now (§B11)? Does zooming out actually
   switch to a real ultra-wide lens on any Android phone that has one
   (§B11's newest addition, `cameraLenses.ts` — completely unverified on
   real multi-lens hardware, watch for a misclassified/wrong-lens report)?
   Did a real barcode/UPC/vinyl/comic scan actually fill fields (§B8's
   still-open "found a match" success path)? Does scanning stay cool over
   repeated bursts since the zxing-wasm swap (§B)?
4. Then whichever open §3 decision or §2 item EK wants to pick up next —
   PSA's "approved customer" block (§B3, needs EK emailing PSA directly) and
   a CGC lookup (confirmed still fully unbuilt) are the two biggest gaps on
   the grading-lookup side if EK asks what's left there.
5. Verify each **visually** on `vltd.vercel.app` (screenshot; resize for mobile).
   `tsc`/`eslint`/`build` before every push. Deploys are slow — preview CSS-only
   tweaks via live JS injection to iterate faster.
