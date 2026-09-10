# VLTD — App Map (structural reference, not a changelog)

**What this file is for:** a map of everything that currently EXISTS in this codebase —
routes, admin tools, database tables, background jobs, and key patterns — so a new
session (or developer) can find out something already exists *before* building a
duplicate of it. This document exists because on 2026-08-23/24 a session built an
entire standalone `/admin` hub page plus an `/admin/events` management page without
realizing a real, 2200+ line admin console shell already existed at
`src/app/admin/characters/page.tsx`. That was genuine wasted work, caught only
because EK said "I do not see any new Event tab."

**This is NOT a chronological history.** For that, read:
- **`HANDOFF.md`** — narrative log of recent sessions, decisions, and the full list
  of standing rules in §0 (product rules, deploy/verification rules, the
  parallel-editing risk, etc.) — read §0 there, it is not repeated in full here.
- **`CHECKLIST.md`** — the done/pending punch list.

This file should be kept current: if you find it's stale or wrong while working,
fix it in the same pass, the same way you'd fix `HANDOFF.md`.

---

## 1. Public-facing routes

One line each, grouped by area. Route path is the folder path under `src/app/`
per Next.js App Router conventions.

### Vault (collection management)
- `/vault` — Main vault dashboard: browse, sort, and filter owned collectibles with wall/gallery/shelf/flip views, sync, and value tracking.
- `/vault/[universe]` — Vault view filtered/scoped to a single collecting universe (e.g. TCG, Music) with its own museum/shelf/swipe views.
- `/vault/add` — Full item-capture flow (camera, barcode/UPC, comic, TCG card, PSA cert, vinyl scanning) for adding a single vault item with AI-assisted lookups.
- `/vault/bulk` — Bulk photo-upload flow: pick a batch of images, tag them to one universe, optionally AI-identify, then review and add them all to the vault at once.
- `/vault/for-sale` — Listing-readiness dashboard per resale platform (eBay, Whatnot, Mercari, Discogs, PWCC, Facebook) showing missing fields/gaps for each item.
- `/vault/frames` — Generates shareable "frame" graphics (grade slab, one-touch, case, comic, neon) around a vault item's photo for social export.
- `/vault/halls` — Builds a custom cross-category collection ("exhibition hall") by combining OR-matched search terms plus universe/category filters, then saves it as a private gallery.
- `/vault/import` — Spreadsheet import page for bulk-loading vault items from a file.
- `/vault/item/[id]` — Single item detail/edit page: pricing, images, documents, video clips, auction setup, sharing, and social export.
- `/vault/item/[id]/present` — Full-screen "stream display" presentation mode for a single vault item.
- `/vault/print` — Printable insurance/appraisal-style report of all vault items grouped by universe with total value.
- `/vault/quick` — Quick-add client-rendered item entry page (thin wrapper deferring to `QuickAddClient`).
- `/vault/readiness` — Scored (0–100) listing-readiness checklist across all for-sale items, sorted with filter tabs.
- `/vault/sold` — Sales history/analytics page showing sold items, realized revenue, cost, and profit.
- `/vault/sync` — Cloud sync status page showing pending sync queue items and manual sync controls.

### Account & Auth
- `/account` — Main account settings page: profile info, avatar, contact info, universe focus, and vault sync/migration tools.
- `/account/backup` — Owner-only tool to compare local vs. cloud item counts and force a full backup sync to Supabase.
- `/account/billing` — Subscription/billing page showing plan tiers (Free/Pro/Business), current plan, and Stripe customer/portal info.
- `/account/invite` — Referral program page: generate/share a referral code and track bonus galleries earned from invites.
- `/account/roles` — Business-only page describing role-based permission defaults (Owner/Admin/Inventory Manager/Viewer).
- `/account/security` — Account security settings: session info, email change, and password/2FA management.
- `/account/team` — Business-only team management page: invite/remove members, change roles, transfer ownership.
- `/account/workspace` — Workspace settings covering active profile switching and Google Sheets integration/export.
- `/login` — Email/password and Google sign-in page for existing users.
- `/signup` — Invite-only private-beta notice directing users to request early access instead of self-registering.
- `/forgot-password` — Password reset request page that emails a reset link.
- `/reset-password` — Page for setting a new password after following a Supabase recovery link.

### Dashboard & Activity
- `/dashboard` — Protected home dashboard, rendering the main `HomeClient` app view.
- `/activity` — Unified activity feed of vault events (added, sold, valued, comments, exhibitions, shares) with filters.
- `/notifications` — "Alerts" feed of follows, exhibition comments/messages, and bug reports.
- `/messages` — Direct messaging inbox/thread UI between collectors, with push-notification opt-in.
- `/more` — Feature showcase/index page listing app capabilities (Registry Rank, Market Pulse, Listing Readiness, Goals, etc.) with links.
- `/guide` — Command-center style hub of settings/help shortcuts (account, security, billing, backup, public profile, activity, notifications).
- `/onboarding` — New-user onboarding wizard: create profile, pick account type/avatar, and set up initial preferences.

### User / Public Profiles
- `/user` — Personalization/settings page for theme, palette, museum background, rank mode, and data export.
- `/user/profile` — Deprecated redirect to `/account` (fields were merged into the real account settings page).
- `/user/style` — "Style Gallery" page for trying out visual style/theme combinations quickly.
- `/u/[username]` — Public-facing vault profile page resolved by username (SEO metadata + delegates to the `/v/[profileId]` view).
- `/v/[profileId]` — Public collector profile page showing their vault items, galleries, follower count, and message/follow actions.

### Museum / Exhibitions
- `/museum` — Dashboard listing the user's museum exhibitions/galleries with visibility, state, and curation-score badges, plus create/delete/manage actions.
- `/museum/new` — Form to create a new museum gallery/exhibition (title, visibility, theme pack, display mode, tier-based limits).
- `/museum/[galleryId]` — Gallery editor/owner view for building an exhibition (item picker, sharing, invite tokens, publishing).
- `/museum/[galleryId]/guest` — Guest-facing rendering of a specific gallery for visitors (non-owner viewing experience with comments support).
- `/museum/share/[token]` — Public share-link landing page that resolves a gallery by its public token and renders it for anonymous guests (with adult-content gating).
- `/museum/invite/[token]` — Invite-only gallery access page that resolves and marks an invite token used, then shows the gated exhibition.
- `/museum/virtual-room` — Builder for an interactive 3D/virtual VLTD gallery room assembled from vault items and exhibitions. Existing White style has the September 5 plaster/stone/brass material pass (`galleryRoomFinishes.ts`); room dimensions and navigation are shared with the other styles.
- `/museum/virtual-room/guest` — Read-only guest walkthrough of a published virtual gallery room.
- `/gallery/[galleryId]` — Public gallery viewer page showing a single exhibit's items (grid/swipe modes) with owner-only delete controls.

### Portfolio & Insurance
- `/portfolio` — Portfolio overview page showing an insights dashboard built from the user's vault items.
- `/portfolio/insurance` — Print-ready insurance report page summarizing collection cost/value/gain totals for documentation.
- `/portfolio/universe/[key]` — Portfolio drill-down for a specific collecting universe, showing item intelligence, gain/value rankings over time.
- `/portfolio/universe/[key]/category/[category]` — Analytics dashboard scoped to one category within a universe.
- `/portfolio/universe/[key]/category/[category]/subcategory/[sub]` — Analytics dashboard scoped further to a subcategory within a category/universe.
- `/insurance` — Insurance overview listing vault items with value/details for coverage purposes.
- `/insurance/item` — Detail view of a single item's insurance-relevant data (value, cert/serial numbers, storage location).
- `/insurance/packet` — Builder for a paginated insurance documentation packet (with/without images) from vault items.
- `/insurance/packet/print` — Print-optimized, paginated rendering of the insurance packet driven by query params (page, images).
- `/reports/weekly` — Weekly "gaps" report highlighting items missing photos, cost, value, condition, or insurance documentation.
- `/reports/insurance` — Insurance report listing items with value/gain, sortable and print-friendly, seeded from demo data if empty.
- `/share/[itemId]` — Server-rendered public share page for a single vault item (fetches from Supabase, builds OG image metadata, hides price/value).

### Commerce (Market / Auction / Shop)
- `/market` — Browse-and-buy marketplace grid of collector-listed items with universe filters, sort options, and grading-service badges.
- `/sales` — Personal sales history dashboard showing profit/margin per sale, revenue sparkline, and summary stat pills.
- `/auction` — Live auctions listing with countdown timers, universe filters, and bid-based sorting.
- `/auction/[id]` — Single auction detail page with real-time bidding, live bid feed, and countdown to close.
- `/shop` — "Collector's Shop" curated catalog of grading/storage/display supplies (sleeves, slabs, binders, tools) linking out to retailers.

### Comics Discovery (Kickstarter / Patreon / Upcoming)
- `/kickstarter` — "Kickstarter Comics" — searchable feed of active/funded Kickstarter comic campaigns as cards.
- `/patreon` — "Patreon Comics" — directory of comic creators on Patreon with search and profile lookup.
- `/upcoming` — "Upcoming Comics" — upcoming comic issue release calendar grouped by year/publisher with wishlist toggling.

### Social & Clubs
- `/clubs` — List of collector clubs with the ability to create a new club.
- `/clubs/[clubId]` — Single club page with discussion feed, membership, moderation tools, and integration settings (Discord/Reddit/Telegram/Slack).
- `/community-board` — "VLT Lounge" collector clubhouse feed: activity posts, MVPs, new members, and club highlights (Supabase-backed). Split ownership with a parallel tool (Codex) — see `HANDOFF.md` §0.
- `/community-board/[subject]` — Subject-specific collector leaderboard ranking top collectors by item count and estimated value.
- `/events` — Collector events hub (conventions, card shows, drops) with search, filters, saved events, and featured-event hero. Backed by the `collector_events` table, self-populated by the two cron jobs (see §5).

### Discover & Learn
- `/discover` — "Discover" swipe-style feed of public collector galleries, personalized and filterable by universe.
- `/learn` — "Learn" hub of collector education content (insurance, pricing, documentation guides).
- `/learn/[slug]` — Individual internal Learn guide article renderer (headings/lists/steps/callouts) with a save button.
- `/learn/articles` — Marketing-facing "Collecting Articles & Guides" listing pulled from Sanity CMS.
- `/learn/articles/[slug]` — Single Sanity-backed article page rendered via PortableText.

### AI Tools
- `/ai/drafts` — List of AI-generated catalog drafts pending review, with status/confidence badges and delete action.
- `/ai/review` — "Review Draft" page for editing/approving a single AI-extracted catalog draft before saving it to the vault.
- `/ingest` — "Ingest" hub linking to Quick Add, Spreadsheet Import, and Capture flows for adding inventory.
- `/capture` — Standalone rapid item-capture flow (camera, barcode, comic/TCG scanning) for quickly adding items to the vault. This route is explicitly "this chat's" per `HANDOFF.md` §0 — re-read before editing.

### Other collection tools
- `/goals` — Collection goals tracker: progress rings, value/insurance/sale/gallery goal types, and wishlist integration.
- `/watchlist` — Combined watch/wishlist view merging wishlist, watchlist, and comic-wishlist entries with alerts and priorities.
- `/favorites` — List of the viewer's favorited items and galleries.
- `/saved` — Saved/watchlist items page with remove and clear-all actions.

### Legacy redirects
- `/registry` — Redirects to `/community-board`.
- `/registry/[subject]` — Redirects to `/community-board/[subject]`.
- `/collector` — Redirects to `/dashboard` (former "Collection Identity" page folded into Curator Home).
- `/redeem` — Redirects to `/account/billing` (redemption codes handled there).

### Landing / Internal tools
- `/` — VLTD marketing homepage (`PublicHomeClient`) with SEO metadata and JSON-LD describing the app as a private collector vault/insurance/sales-prep platform.
- `/lounge-preview` — Standalone gold-themed collector spotlight/activity feed page, distinct from the live `/community-board` lounge (appears to be an earlier/preview version — verify with EK whether it's still needed).
- `/studio/[[...tool]]` — Embeds the Sanity Studio CMS client (catch-all route) for content management.
- `/owner-lab/forge` — Owner-only experimental "Relief Forge" workspace gated by an owner-email access check.
- `/styles` — Client page for applying/previewing style/theme galleries via `ApplyStyleGalleryClient`.

---

## 2. Admin tools — READ THIS BEFORE BUILDING ANYTHING NEW HERE

**Before building any new admin tool, read this section AND `src/app/admin/characters/page.tsx`
directly — do not assume a standalone `/admin/*` page alone is discoverable; it must
also be wired into this shell's sidebar via the iframe pattern to actually be reachable
from where the real admin console lives.**

### 2.1 The real admin console is at `/admin/characters`, not `/admin`

Despite its route name (a holdover from when it only managed seed characters),
**`src/app/admin/characters/page.tsx` is the actual admin console shell** — a single
~2250-line page with a persistent left sidebar of collapsible sections and a main
workspace panel on the right that renders whichever section is active. It is NOT a
router-based multi-page admin area; navigating between "pages" in it never changes
the URL, it just swaps `activeSection` state and re-renders the right-hand panel
(or loads a standalone `/admin/X` page inside an `<iframe>`).

Auth gate: on load it calls `getMyAdminRole()` (from `@/lib/adminAuth`); if the
signed-in user has no admin role it shows `NotAuthorized`; if signed out it shows
`AdminLoginGate`. Role is `"owner"` (hardcoded/env owner email) or `"admin"`
(present in `user_roles`) or `null`.

### 2.2 Sidebar sections and what each does

In sidebar order:

| Section | Icon | Implementation | What it does |
|---|---|---|---|
| **Characters** | person | Inline (`CharacterDetail`, `CharacterCard`, `ItemEditModal`, `BioEditModal`, `ExhibitEditModal`, `ExhibitGrid`) | Manage the 22 fictional seed-collector personas (`SEED_CHARACTERS` + `_part2/3/4` from `@/lib/seedCharacters*`) that seed the app's demo content: edit each character's bio, edit/disable individual items (writes to `vault_items` keyed by matching title → live Supabase UUID), and manage each character's exhibition galleries via an 18-slot (3×6) picker (writes to `galleries.layout.itemIds`). |
| **Account Rights** | key | Inline (`AccountRightsPanel`, `ProfileRow`) | Grant/revoke `FREE`/`MID`/`FULL` tier per account (queries/updates `profiles.tier`, `tier_expires_at`, `tier_source`). Shows presence info (online dot, session length, last active, avg session, total clocked time) per profile. Seed/test accounts are collapsed into a separate "Seed / test accounts" sub-list, hidden by default. **2026-08-24: this same tier-grant + activity-stat functionality was also added to the "Users" section below** (EK's call, comparing the two side by side) — both stay live in parallel deliberately, EK wants to test the Users version a few times before deciding whether to trim or retire this panel. See `CHECKLIST.md`'s "Future cleanup" section. |
| **Coupons** | ticket | Inline (`CouponsPanel`, using `@/lib/accessCoupons`) | Generate/manage redeemable tier-grant codes (`access_coupons` table) — tier, duration (1mo–2yr or lifetime), max redemptions, note. Users redeem at `/redeem`. |
| **Manage Admins** | shield | Inline (`ManageAdminsPanel`) — **owner role only**, hidden entirely for plain `admin` role | Grant/revoke admin access (`user_roles` table) via `@/lib/adminAuth`'s `listAdmins`/`grantAdmin`/`revokeAdmin`. |
| **Themes** | palette | `<iframe src="/admin/themes">` — this is also the `else` fallback branch if `activeSection` doesn't match any other case | Seasonal theme configuration (backs the `seasonal_themes` table). |
| **Beta Waitlist** | inbox | `<iframe src="/admin/waitlist">` | Approve requests and send invites for the beta waitlist (`beta_waitlist` table). |
| **Bug Reports** | bug | `<iframe src="/admin/bugs">` | Review and reply to bug reports (`bug_reports` table, including the reporter-notification `admin_reply` feature). |
| **Scan Limits** | ticket | `<iframe src="/admin/scan-limits">` | Per-tier and custom per-account AI-scan monthly quota configuration (`bulk_scan_quotas` table + `profiles.bulk_scan_limit_override`). |
| **Users** | users | `<iframe src="/admin/users">` | Per-account activity/AI-usage analytics (joins `profiles` presence columns with `ai_usage_log`), the 3D Museum beta-access toggle (`profiles.museum_beta_enabled`), and — as of 2026-08-24 — the same `FREE`/`MID`/`FULL` tier grant + personal/business badge + search that Account Rights has (moved over at EK's request; see that row above). This is now the more complete of the two panels. |
| **Events** | calendar | `<iframe src="/admin/events">` | Enable/disable, feature, or delete any row in `collector_events`. Added the night of the incident this document exists to prevent — EK: "I do not see any new Event tab," because it only existed at the standalone `/admin/events` URL with no link into this shell. |

### 2.3 Standalone `/admin/*` pages — which are wired in vs. orphaned

Every file matching `src/app/admin/**/page.tsx` (confirmed via glob):

| Standalone page | Wired into the `/admin/characters` shell? |
|---|---|
| `src/app/admin/characters/page.tsx` | **This IS the shell itself**, not a section iframed into it. |
| `src/app/admin/waitlist/page.tsx` | ✅ Iframed as "Beta Waitlist" |
| `src/app/admin/bugs/page.tsx` | ✅ Iframed as "Bug Reports" |
| `src/app/admin/scan-limits/page.tsx` | ✅ Iframed as "Scan Limits" |
| `src/app/admin/users/page.tsx` | ✅ Iframed as "Users" |
| `src/app/admin/events/page.tsx` | ✅ Iframed as "Events" |
| `src/app/admin/themes/page.tsx` | ✅ Iframed as "Themes" (also the default fallback case) |
| `src/app/admin/events/quick-add/page.tsx` | ⚠️ Not iframed in — reachable only by direct URL. Manual fallback to add one `collector_events` row by hand. |
| `src/app/admin/referrals/page.tsx` | ✅ Iframed as "Referrals" (fixed 2026-08-24) |
| `src/app/admin/spotlights/page.tsx` | ✅ Iframed as "Spotlights" (fixed 2026-08-24) |
| `src/app/admin/tiers/page.tsx` | ❓ **Still not wired in — needs EK's call, not a code decision.** `AdminTiersPage` grants FREE/MID/FULL tiers against `profiles.tier`, which looks like the same job the inline "Account Rights" section already does. Ask EK whether this file is dead before touching it either way. |

**Net takeaway:** Referrals and Spotlights are fixed. `/admin/tiers` is the one open
question — don't add it to the sidebar and don't delete it; confirm with EK first
whether it's dead code or does something Account Rights doesn't.

(The duplicate `/admin` hub page mentioned in earlier drafts of this doc has been
deleted at EK's direction, 2026-08-24 — it no longer exists.)

---

## 3. API routes

Grouped by area. `src/app/api/**/route.ts`.

### AI (`/api/ai`)
- `POST /api/ai/analyze-item` — Sends a captured item photo to Claude (Anthropic API, `claude-haiku-4-5`) to classify it against the Universe/Category/Subcategory taxonomy and extract title, value estimate, grade, condition, etc.; logs usage to `ai_usage_log`.
- `POST /api/ai/analyze-coa` — Sends a Certificate-of-Authenticity/grading-label photo to Claude to extract cert number, grade, authenticator, signer, etc. as JSON; also logs to `ai_usage_log`.

### Billing (Stripe)
- `POST /api/billing/checkout` — Creates a Stripe Checkout subscription session for the pro/business plan, stamping `profile_id`/tier into metadata for the webhook.
- `GET /api/billing/session` — Retrieves a completed Checkout session by `session_id` to hand the client the resulting Stripe customer id.
- `POST /api/billing/portal` — Creates a Stripe Billing Portal session for an existing Stripe customer id.
- `POST /api/billing/webhook` — Stripe webhook handler; verifies signature and syncs `profiles.tier` (service role) on `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted`.

### Google OAuth
- `GET /api/google/oauth-config` — Returns the public Google OAuth client id/redirect URI and whether it's configured.
- `GET /api/google/oauth-callback` — Exchanges the OAuth `code` server-side (keeps `GOOGLE_CLIENT_SECRET` server-only), redirects back with the token in a URL fragment.

### Admin (all gated via `getAdminEmail` + `getServiceClient` from `@/lib/serverAdmin` — see §6)
- `GET/PATCH /api/admin/waitlist` — List beta waitlist; approve + invite via Supabase Auth admin API.
- `GET/PATCH /api/admin/bugs` — List bug reports; update status/admin reply.
- `POST /api/admin/events/quick-add` — Manual fallback: directly upserts one `collector_events` row (no external API) when the automated feeds miss something.
- `GET/PATCH/DELETE /api/admin/events` — List all `collector_events` rows (bypassing RLS), toggle enabled/featured, delete.
- `GET/PATCH /api/admin/users` — Per-account analytics joining `profiles` presence/session data with `ai_usage_log` and Auth-admin emails; toggles the 3D Museum beta flag.

### Cron (see §5 for full detail)
- `GET /api/cron/refresh-events` — Daily; SerpApi + Ticketmaster → AI relevance filter (Anthropic) → upsert `collector_events`.
- `GET /api/cron/refresh-major-events` — Weekly; refreshes dates/locations for a fixed curated show list via SerpApi + Claude extraction.

### Lookup APIs (card/comic/vinyl/upc/psa)
- `GET /api/card-lookup` — Scryfall (Magic) or Pokemon TCG API lookup for scanned TCG cards.
- `GET /api/psa-lookup` — PSA cert lookup via PSA's public API; permanently caches in `psa_cert_cache`, enforces a safe daily cap (90, below PSA's 100/day) via `psa_api_usage`.
- `GET /api/comic-lookup` — Metron Cloud API (Basic auth) comic-issue lookup, cache-guarded.
- `GET /api/vinyl-lookup` — Discogs API (token auth) release lookup, cache-guarded.
- `GET /api/upc-lookup` — Generic barcode/UPC proxy: upcitemdb (daily-capped) → ScanDex (video games) → OpenLibrary/Google Books (ISBNs), via the shared `@/lib/server/lookupApiGuard` cache+budget guard.

### Comics/Kickstarter/Patreon feeds
- `GET /api/comic-upcoming` — Upcoming comic solicitations/issues + creator info from Metron Cloud API.
- `GET /api/comic-releases` — Scrapes ComicList.com's weekly checklist, 6-hour in-memory cache.
- `GET /api/kickstarter-comics` — Queries Kickstarter's internal (keyless) search JSON for active comic campaigns.
- `GET /api/patreon-comics` — Scrapes Patreon's public search/creator pages (parses embedded `__NEXT_DATA__`) since Patreon has no public search API.
- `GET /api/gcd-search` — Queries the Grand Comics Database mirror in Supabase (`gcd_comic_search` view) via anon client.

### Misc
- `POST /api/remove-bg` — Proxies to remove.bg to strip an image background, returns a base64 data URL.
- `POST/DELETE /api/vault/[id]` — In-memory (`globalThis`) vault item store; non-persistent, dev/demo-style, not the real Supabase-backed vault path.
- `GET /api/image-proxy` — Proxies/caches images from allow-listed Supabase storage hosts with CORS + long cache headers.
- `POST /api/waitlist` — Public beta-waitlist signup into `beta_waitlist` (schema-compat fallback for missing `consented_at`).
- `GET /api/events/search` — Searches collector events near a location via SerpApi's Google Events engine (query fallback tiers).
- `POST /api/newsletter` — Public newsletter capture into `newsletter_signups` (no actual email sending).
- `POST /api/push/send-internal` — Internal shared-secret (`PUSH_INTERNAL_SECRET`, now Vault-stored) endpoint called by a Postgres trigger to send Web Push (VAPID) to a profile's devices, pruning dead subscriptions.
- `POST /api/clubs/notify-reddit` — Internal shared-secret (`CLUBS_INTERNAL_SECRET`) endpoint called by a Postgres trigger to cross-post a club post to Reddit via OAuth password-grant.

---

## 4. Database tables (current state, deduped from `supabase/migrations/*.sql`)

> **Honesty caveat, repo-wide:** this reflects what the migration *files* define.
> Nobody can confirm from the repo alone which migrations actually **ran** against
> the live database — that's tracked only in `HANDOFF.md` / EK's manual runs (see
> §6, "migrations are run manually"). Treat anything not explicitly marked
> "confirmed run" in `HANDOFF.md` as unverified. A few base tables (`profiles`,
> `vault_items`, `galleries`, `gallery_items`, `gallery_invites`) were never
> `CREATE TABLE`'d in any tracked migration — they predate this migration history
> (likely created via Supabase Studio), so only their additive/RLS-fix history is
> visible here, not their original full schema.

### Profiles & Identity

**`profiles`** — the core account/collection record.
- Key columns added over time: business signup fields (`business_type`, `website`, `tax_id`); contact/shipping (`full_name`, `phone`, `address_line1/2`, `city`, `state`, `zip`, `country`, `date_of_birth`, `age_verified`, `marketing_opt_in`); avatar (`avatar_emoji`, `avatar_url`); **presence** — `last_seen_at`, `session_started_at` (`20260711_presence.sql`), `total_seconds_online`, `session_count` (`20260818_presence_totals.sql`, heartbeat delta capped at 180s); **tier/billing** — `tier` (FREE/MID/FULL), `tier_expires_at`, `tier_source`, `stripe_customer_id`, `account_code` (permanent internal ID), `next_item_seq`, `bulk_scans_used`, `bulk_scans_cycle_start`, `bulk_scan_limit_override`; feature flags `focused_universes`, `museum_beta_requested_at`, `museum_beta_enabled`.
- RLS: self-update (`auth.uid() = user_id`); admins (owner email or `user_roles` row) can read/update all. **Column-level protection**: a `BEFORE INSERT OR UPDATE` trigger (`protect_profile_billing_columns`) forces `tier`/`tier_expires_at`/`tier_source`/`stripe_customer_id`/`account_code`/`bulk_scans_used`/`bulk_scan_limit_override`/`museum_beta_enabled` back to their real values for non-privileged callers — this closed a real self-escalation hole (`20260823_protect_profile_billing_columns.sql`).
- Migrations (partial, columns only): `20260612_profiles_avatar_emoji.sql`, `20260613_profiles_avatar_url_backfill.sql`, `20260705_profiles_tier.sql`, `20260626_focused_universes.sql`, `20260707_business_fields.sql`, `20260711_presence.sql`, `20260718_internal_ids*.sql`, `20260723_bulk_scan_quota.sql`, `20260623_profile_contact_info.sql`, `20260803_profile_identity_fields.sql`, `20260812_profiles_stripe_customer_id.sql`, `20260818_presence_totals.sql`, `20260823_museum_beta_flag.sql`, `20260823_protect_profile_billing_columns.sql` (security fix).

**`public_profiles`** — world-readable identity cache (display name, avatar) for search/leaderboards, decoupled from private `profiles`.
- RLS: read `using (true)` (intentionally public). Write was originally wide-open (`for all using (true) with check (true)`) — a confirmed hole, fixed to owner-or-admin-only in `20260823_fix_public_profiles_write_policy.sql`.
- Migrations: `20260516_public_profiles.sql`, `20260612_public_profile_avatar_url.sql`, `20260820_backfill_public_profiles.sql`, `20260820_refresh_stale_public_profile_names.sql`+`_v2.sql`, `20260823_fix_public_profiles_write_policy.sql`.

**`profile_members`** — many-to-many roster (owner/admin/member) for multi-user profiles (mainly business accounts).
- RLS: members read their own roster via `is_profile_member()`; all writes go through owner/admin-only RPCs (`add_profile_member`, `remove_profile_member`, `update_member_role`, `transfer_profile_ownership`).
- Migrations: `20260707_profile_members.sql` (also retrofit `vault_items`/`galleries`/`gallery_items` RLS off world-readable/writable), `20260707_team_management.sql`, `20260707_ownership_transfer.sql`.

**`account_code_counters`** — internal daily sequence backing `profiles.account_code`/`vault_items.item_code`. No client-facing policy at all.
- Migrations: `20260718_internal_ids.sql`, `20260718_internal_ids_triggers.sql`.

### Vault & Items

**`vault_items`** — the core collection-item record.
- Key columns added: `is_public`, `asking_price`, `status`, `sold_price`, `sold_at`, auction fields (`auction_status`, `auction_ends_at`, `auction_starting_bid`, `reserve_price`, `buy_it_now_price`, `auction_current_bid`, `auction_bid_count`, `auction_winner_id`), `tags` (GIN indexed), `brand`, `item_type`, `item_attributes`, `item_code`, `video_clip_url`/`video_clip_duration`, `added_via`.
- RLS: evolved from world-readable/hardcoded-owner to membership-scoped (`is_profile_member_text()`) for private read/write plus a separate public-read policy (`is_public = true`); delete restricted to owner/admin ("manager") only.
- Later fix: `20260819_server_side_tier_limits.sql` closed a client-side-only (localStorage-spoofable) FREE-tier 50-item cap by enforcing it server-side via trigger.
- Migrations: `20260516_vault_item_visibility.sql`, `20260516_public_vault_items_read.sql`, `20260607_market_asking_price.sql`, `20260610_vault_items_market_columns.sql`, `20260610_auction_bids.sql`, `20260707_profile_members.sql`, `20260707_team_management.sql`, `20260718_internal_ids.sql`, `20260806_vault_item_tags.sql`, `20260811_vault_item_brand.sql`, `20260819_vault_item_added_via.sql`, `20260819_server_side_tier_limits.sql`, `20260822_vault_item_type_attributes.sql`, `add_video_clip.sql`.

**`galleries`** — exhibitions/collections display pages.
- Key columns added: `alias_enabled`, `alias_name`, `alias_avatar` (per-exhibition curator alias, `20260818_gallery_alias.sql`).
- RLS: public read gated by `visibility = 'PUBLIC' and state = 'ACTIVE'`; membership-scoped writes. A `public_token is not null` read policy was a confirmed hole (exposed full row content, including Locked galleries, to anyone with the id) — fixed in `20260823_fix_gallery_share_and_invite_tokens.sql` by routing token reads through `get_gallery_by_share_token()`/`get_gallery_by_invite_token()` SECURITY DEFINER functions.
- Migrations: `20260601_public_galleries_read.sql`, `20260622_exhibition_events.sql`, `20260707_profile_members.sql`, `20260707_team_management.sql`, `20260707_ownership_transfer.sql`, `20260818_gallery_alias.sql`, `20260819_server_side_tier_limits.sql` (server-side 4-exhibition free-tier cap), `20260823_fix_exhibition_events_team_check.sql`, `20260823_fix_gallery_share_and_invite_tokens.sql`.

**`gallery_items`** — items placed within a gallery.
- RLS: originally `USING true` for read AND write (anyone could edit/delete anyone's exhibits) — fixed to member-scoped writes + public-read-if-parent-public in `20260707_profile_members.sql`; the same token-based public-read hole as `galleries` was fixed alongside it in `20260823_fix_gallery_share_and_invite_tokens.sql`.

**`gallery_invites`** — invite-link records for private galleries.
- RLS: **the worst confirmed hole in the audit** — write policy was `for all using(true) with check(true)` (anyone could forge/disable/delete any invite), and a read policy exposed every non-disabled invite's token without the caller supplying it. Fixed in `20260823_fix_gallery_share_and_invite_tokens.sql`: raw policies replaced with member-only management + token-taking SECURITY DEFINER functions.

**`vault_documents`** — metadata for cloud-synced private documents (certs, receipts, IDs); files live in a **private** `vault-documents` storage bucket (unlike every other bucket in the app).
- RLS: owner-only (profile-scoped) select/insert/delete.
- Migrations: `20260822_vault_documents.sql`. **Confirmed run by EK 2026-08-22** per `HANDOFF.md`.

**`bids`** — auction bid ledger for `vault_items` auctions.
- RLS: public select; insert requires `auth.uid() = bidder_id`; update/delete hard-blocked (immutable). Realtime enabled.
- Security fix: `place_bid()` RPC is `SECURITY DEFINER` and never verified `p_bidder` matched `auth.uid()` — a direct RPC call could place a bid as someone else. Fixed in `20260823_fix_place_bid_impersonation.sql`.
- Migrations: `20260610_auction_bids.sql`, `20260823_fix_place_bid_impersonation.sql`.

### Social (clubs / DMs / comments / follows / lounge)

**`clubs`** — collector clubs with discussion boards. Public read; owner-only update/delete. `20260822_clubs.sql`.

**`club_members`** — roster (owner/moderator/member). Public read; no direct write policy — all changes via SECURITY DEFINER RPCs (`join_club`, `leave_club`, `remove_club_member`, `set_club_moderator`).

**`club_bans`** — ban list per club. RLS enabled with **zero policies** — accessible only via SECURITY DEFINER functions.

**`club_posts`** — discussion posts. Visible-only public read (`hidden_at is null`); insert requires membership; moderation only via `hide_club_post()`.

**`club_post_reports`** — moderation reports; select restricted to that club's staff only.

**`club_integrations`** — per-club Discord webhook / Reddit subreddit / Telegram bot / Slack webhook config. Owner-only read+write (kept off the public-readable `clubs` table since these are bearer secrets). `20260822_clubs.sql`, `20260822_clubs_telegram_slack_notify.sql`; notify logic in `20260822_clubs_discord_notify.sql` (direct pg_net call) and `20260822_clubs_reddit_notify.sql` (round-trips through the Next.js route above since Reddit needs real OAuth).

**`conversations`** — 1:1 DM thread pairing (`profile_a_id < profile_b_id` canonical order). Select restricted to participants.
- Fix: `20260820_fix_dm_active_profile_scope.sql` — `get_or_create_conversation`/`mark_conversation_read` used to resolve "the caller's profile" ambiguously for multi-profile accounts, causing conversations to be created under the wrong profile and vanish from the inbox; fixed by requiring an explicit, verified profile id parameter. **Confirmed run + re-verified live by EK 2026-08-20** per `HANDOFF.md`.
- Migrations: `20260819_direct_messages.sql`, `20260820_fix_dm_active_profile_scope.sql`, `20260821_dm_realtime.sql`.

**`direct_messages`** — individual DM records.
- RLS: select restricted to conversation participants; insert requires sender owns the profile and is a participant; marking read only via SECURITY DEFINER `mark_conversation_read` (recipient only).
- **Security incident:** `20260821_push_notifications.sql` originally hardcoded `PUSH_INTERNAL_SECRET` in the trigger body, committed to the public repo; an external researcher found and disclosed it; confirmed still valid against production (tested harmlessly). Remediated same-day in `20260821_push_secret_to_vault.sql` — moved to Supabase Vault, rotated.

**`conversation_prefs`** — per-participant star/hide state. Owner-only. **Confirmed run by EK 2026-08-20.**

**`push_subscriptions`** — Web Push registrations per device/profile. Owner-only.

**`comments`** — comments on public exhibitions. Visible-only public read; insert as own profile; moderation only via `hide_comment()`.

**`lounge_posts`** — VLT Lounge questions/updates. Same pattern as comments. **Confirmed run by EK 2026-08-18.**

**`follows`** — collector follow graph. Public read; insert/delete require caller owns `follower_id`.

**`appreciations`** — "Vibe" reactions on vault_items. Public read; insert/delete require caller owns the profile_id.

**`exhibition_events`** — publish/announce log for exhibitions.
- Fix: insert check originally compared `auth.uid()` directly to `profile_id` (which is `profiles.id`, not the auth user id) — blocked every real business/team profile from publishing (fail-closed bug, not a leak). Fixed in `20260823_fix_exhibition_events_team_check.sql` to use `is_profile_member()`.

**`public_content_reports`** — anonymous abuse reports. Anyone can insert; no client read (admin/service-role only).

**`public_favorites`** — guest + authenticated like/favorite counter, supports anonymous device-id favoriting.
- Fix: guest delete policy checked only the row's own shape, not anything caller-supplied — could mass-delete every guest favorite on a piece of content. Fixed in `20260823_fix_guest_favorite_delete.sql` via `unfavorite_as_guest()` taking an explicit anonymous_id parameter.

### Events & Registry

**`collector_events`** (high priority) — curated collector convention/show calendar.
- Key columns: `slug`, `name`, descriptions, `event_type`, `starts_at`/`ends_at`, venue/location, `relevant_universes`, `enabled`, `is_featured`, `image_url`.
- RLS: public read now gated by `enabled = true and ends_at >= now()` — folded expiry directly into the policy so ended events self-hide with no manual step or cron dependency (`20260823_collector_events_auto_expire.sql`, fixing an earlier staleness bug).
- Migrations: `20260624_collector_events.sql` (create + seed 4 events), `20260823_collector_events_auto_expire.sql`, `20260823_collector_events_image_url.sql`.

**`saved_events`** — per-profile bookmarks of `collector_events`. Owner-only.

**Registry leaderboard RPCs** — `get_registry_subjects()`/`get_subject_leaderboard()`, computed live over `vault_items`/`public_profiles`, SECURITY DEFINER but return only aggregates.
- ⚠️ **Flagged for manual verification:** `20260606_registry_rpcs.sql` and `20260624_vault_registry.sql` both define a function named `get_subject_leaderboard` with different signatures (one joins `public_profiles`, the other joins `profiles` directly) — worth confirming which is actually live.

**`gcd_publisher`/`gcd_series`/`gcd_issue`** — Grand Comics Database reference data (public read-only), loaded via `scripts/gcd-load-supabase.js`. Includes a `gcd_comic_search` view. `20260706_gcd_comics.sql`.

**`portfolio_value_history`** — daily per-profile value snapshots (replaces localStorage-only chart data). Owner-only.

**`activity_events`** — durable per-vault activity log. Owner-only full CRUD.

**`collection_goals` / `wishlist` / `watchlist`** — durable per-profile lists (previously localStorage-only). Owner-only.

**`saved_articles` / `newsletter_signups`** — Learn bookmarks (owner-only) + public newsletter capture (anyone can insert, no client read).

**`sales`** — unified sales ledger (replaces 3 fragmented localStorage stores). Owner-only. Feeds `get_collector_signals()` (`20260728_collector_signals.sql`).

### AI usage & quotas

**`ai_usage_log`** (high priority) — per-call AI token/feature usage log. Columns: `profile_id` (FK, `on delete set null`), `feature`, `input_tokens`, `output_tokens`, `created_at`.
- RLS: **enabled with zero policies** — not even a read policy. Purely admin-only observability, accessed exclusively via a service-role client from `/api/admin/users`. Never queried by ordinary app code.

**`bulk_scan_quotas`** — per-tier monthly AI-scan allowance, admin-editable. Any authenticated user can read (for their own usage ticker); write is owner/admin only. Also adds `profiles.bulk_scans_used`/`bulk_scans_cycle_start`/`bulk_scan_limit_override` and `bulk_scan_status()`/`consume_bulk_scan()` RPCs (anniversary-day cycle).

**`psa_cert_cache`** / **`psa_api_usage`** — permanent PSA lookup cache + singleton daily-budget tracker (safe cap 90, below PSA's real 100/day). Service-role only.

**`lookup_api_cache`** / **`lookup_api_usage`** — generalized version of the PSA guard, keyed by `provider` (upcitemdb, Discogs, Metron, etc). Service-role only.

### Admin / Access control

**`user_roles`** — admin role assignments (owner is a hardcoded/env email). Owner full CRUD; any authenticated user can read only their own row.

**`access_coupons`** — redeemable tier-grant codes. Admin-only management via `is_vltd_admin()`.

**`coupon_redemptions`** — redemption audit log. Admin read-all + self-read.

**`tier_changes`** — tier-change audit trail (admin/coupon/stripe/comp/transfer sources). Admin-only read.

**`beta_waitlist`** — pre-signup email capture. Columns include `email`, `note`, `source`, `invited_at`, `consented_at`. Anyone can insert; **no public read at all** (admin only via service role).

**`bug_reports`** — in-app bug/feedback submissions. Columns added later: `admin_reply`, `admin_replied_at`, `updated_at`. Authenticated insert; self-read only; admin read/update via service role. Also creates a public `bug-screenshots` storage bucket.

### Misc

**`seasonal_themes`** — home-page seasonal banner calendar. Public read when `enabled` and in date window; admin full access.

**`spotlights`** — featured collector/artist/brand cards. Public read when `enabled`; admin full access.

### Notable cross-cutting fact: 2026-08-23 security-review day

A concentrated batch of security-fix migrations all dated 2026-08-23 suggests a
dedicated review pass happened that day: `20260823_fix_place_bid_impersonation.sql`,
`20260823_fix_guest_favorite_delete.sql`, `20260823_fix_public_profiles_write_policy.sql`,
`20260823_fix_gallery_share_and_invite_tokens.sql` (the largest set of holes found),
`20260823_protect_profile_billing_columns.sql`, `20260823_fix_exhibition_events_team_check.sql`
(this last one a fail-closed bug fix, not a leak). Separately, `20260821_push_secret_to_vault.sql`
documents a real, externally-disclosed secret leak, remediated same day. See
`HANDOFF.md` for narrative detail on both.

---

## 5. Background jobs (Vercel Cron)

Defined in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/refresh-events", "schedule": "0 13 * * *" },
    { "path": "/api/cron/refresh-major-events", "schedule": "0 14 * * 1" }
  ]
}
```

Both routes require `Authorization: Bearer <CRON_SECRET>` (env var `CRON_SECRET`) and
return `503 not_configured` if their required env vars are missing.

### `refresh-events` — daily at 13:00 UTC
`src/app/api/cron/refresh-events/route.ts`. Keyword-searches for new events so nobody
has to manually type rows into `collector_events`:
- **Source 1:** SerpApi's `google_events` engine (`SERPAPI_KEY`) — as of 2026-08 this
  source has an open SerpApi incident and is returning `[]` for everything; the job
  degrades gracefully to Ticketmaster-only until that clears.
- **Source 2:** Ticketmaster Discovery API (`TICKETMASTER_API_KEY`) — structured
  dates, no free-text parsing needed, but coverage skews to bigger ticketed shows.
- Both sources are found by keyword search, which can surface irrelevant matches
  (e.g. a plumbing convention matching "convention") — so every candidate passes
  through **one batched AI relevance check** (`ANTHROPIC_API_KEY`, `claude-haiku-4-5`)
  before being upserted. If the AI check can't run for any reason, the whole run's
  candidates are dropped rather than published unchecked (fail closed).
- Upserts into `collector_events` on `slug` conflict; deliberately omits
  `enabled`/`is_featured` on the update path so a manual disable/feature-flip by EK
  is never undone by the next day's run.

### `refresh-major-events` — weekly, Monday 14:00 UTC
`src/app/api/cron/refresh-major-events/route.ts`. Keeps a **fixed, EK-curated list**
of ~19 major recurring shows (SDCC, NYCC, WonderCon, National Sports Collectors
Convention, Gen Con, SEMA, etc. — see `MAJOR_SHOWS` in the file) current. This is a
name lookup, not a keyword search, so there's no "wrong event matched" risk:
- Pulls a handful of real search snippets per show via SerpApi's plain `google`
  engine (`SERPAPI_KEY`) — not the currently-broken `google_events` engine.
- Has Claude (`ANTHROPIC_API_KEY`) extract the next occurrence's date/location
  **only if the snippets clearly support it** — explicitly instructed not to guess
  or extrapolate from a past year's pattern; anything not confidently determined is
  dropped rather than published with a made-up date.
- Upserts into `collector_events` on `slug` conflict, same `enabled`/`is_featured`
  omission rule as above.

Both jobs depend on `getServiceClient()` from `@/lib/serverAdmin` (service-role
Supabase client) to write past RLS.

---

## 6. Key cross-cutting patterns

- **Admin gating, server-side:** `getAdminEmail(req, svc)` + `getServiceClient()`
  from `@/lib/serverAdmin.ts`. `getServiceClient()` builds a service-role Supabase
  client (bypasses RLS — server-only, never import into client code).
  `getAdminEmail` validates the caller's bearer token, then checks it against
  `NEXT_PUBLIC_OWNER_EMAIL` or a `user_roles` row. Every `/api/admin/*` route uses
  this pair.
- **Admin gating, client-side:** `getMyAdminRole()` from `@/lib/adminAuth.ts` —
  returns `"owner" | "admin" | null`, checked the same way (owner email or
  `user_roles`). This is what gates the `/admin/characters` shell itself and every
  standalone `/admin/*` page. Also exports `listAdmins`/`grantAdmin`/`revokeAdmin`/
  `signInWithEmail`/`signOut`/`getCurrentUserEmail`.
- **Presence/session tracking:** `profiles.last_seen_at`, `session_started_at`
  (per-session), plus cumulative `total_seconds_online`/`session_count` (added
  later, heartbeat-capped at 180s/tick to prevent inflation). Helpers in
  `@/lib/presence` (`isOnline`, `sessionLength`, `exactDateTime`,
  `averageSessionLength`, `formatDuration`) are used throughout admin panels and
  public profile pages.
- **Migrations are run manually by EK — no CI.** Never assume a migration in
  `supabase/migrations/` has actually been applied to the live database just
  because the file exists in the repo; check `HANDOFF.md` for an explicit
  "confirmed run by EK" note, and when unsure, ask. Always paste full migration
  SQL inline in chat when asking EK to run one — never just a file path.
- **Two agent sessions can share this working directory.** A parallel tool
  (referred to as Codex in `HANDOFF.md`) edits some files outside this chat
  (confirmed: `src/app/community-board/page.tsx` visual/design ownership) — always
  re-read a file immediately before editing it, and see `HANDOFF.md` §0 for the
  full list of file-ownership splits and the branch-switching incident it
  documents.
- **All other standing rules** (no fake data, no emoji/generic icons, background
  locked to site standard, ask before removing a feature, no full-width pills,
  Curator vs. collectors language, internal ID format, verification-via-deploy
  workflow, etc.) live in **`HANDOFF.md` §0 — read it, it is the rules source of
  truth** and is intentionally not duplicated here.
