# VLTD — Session Handoff (2026-07-23)

Written for a fresh chat to pick up without re-learning. Read this top to
bottom, then `REWORK_PUNCHLIST.md` for status, then start on **"Current task"**.

> (An earlier beta-signup handoff lived here; that work shipped long ago. It's
> in git history if ever needed.)

---

## 0. How to work here (rules — follow exactly)

**Who you're working with:** EK, the founder. **Non-programmer** — explain in
plain language, never jargon ("open state", "props", etc.). Ask questions like
you're the programmer and they're a normal person. Give recommendations, not
option dumps.

**Hard rules (also in the auto-memory `MEMORY.md`):**
- **No fake data.** Numbers, descriptions, counts, images must come from real
  sources. No invented formulas presented as data, no keyword-guessed stock art
  standing in for real items. (A whole session was spent ripping this out.)
- **No emoji / generic icons.** Use the themed line-art `Glyph` component
  (`src/components/ui/Glyph.tsx`). For photoless items use the Universe
  placeholder (`src/lib/itemPlaceholder.ts`), not stock art.
- **Background is locked to the site standard.** Never add a per-page
  background/overlay. If a page shows a stray tint, it's a custom bg someone
  added — remove it.
- **"Curator" = the individual user; "collectors" = the community/market.**
- **Internal ID system is permanent** — format `260312-0001-000142`
  (`YYMMDD-account-item`); don't change the format. See `internal-id-system`
  memory + `supabase/migrations/20260718_internal_ids*.sql`.

**Deploy / infra:**
- **Vercel auto-deploys on push to `main`.** Never tell EK to redeploy. Deploys
  take ~1–3 min and can queue behind each other.
- **Supabase migrations are applied MANUALLY by EK** (no CI). Write the `.sql`
  file, then ask EK to run it and report the result. Make migrations
  idempotent + safe to re-run. Supabase may warn about RLS on a new table —
  enabling RLS with no policies is correct for internal-only tables (functions
  use SECURITY DEFINER).
- **Live site is `https://vltd.vercel.app`** (EK's test site, and it's what
  works). `vltd.app` is intentionally NOT set up yet — don't treat it as broken.
- Windows + Git Bash. Node scripts with regex often break via `-e`; write them
  to the scratchpad and run the file.

**Verifying (do before claiming something works):**
- EK does NOT run localhost. Verify against the LIVE site using **Claude in
  Chrome** (`mcp__claude-in-chrome__*`, load via ToolSearch) — EK's real Chrome
  is logged in on `vltd.vercel.app`. `browser_batch` for speed; screenshots
  work there. That browser force-renders at 1920px (can't test true mobile —
  EK checks mobile on their phone). The in-app `mcp__Claude_Browser__*` preview
  screenshots TIME OUT — avoid.
- For data checks, query Supabase with the service-role key from `.env.local`
  (pattern: scratchpad `numbers.js` / `verifyids.js`).
- Always `npx tsc --noEmit` + targeted `npx eslint <files>` before pushing;
  `npm run build` for a full check. Push only verified work.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## 1. CURRENT TASK — Bulk photo upload + AI scan quota

**Status:** design LOCKED with EK (below). Build underway.
- [x] **Quota migration** (`20260723_bulk_scan_quota.sql`) — EK ran it clean.
      Per-tier config table + per-user override + atomic status/consume fns,
      resets on the signup anniversary day.
- [x] **Admin page + client lib** — `/admin/scan-limits` (embedded in the admin
      hub as "Scan Limits"): set the monthly limit per plan, plus custom
      per-account overrides. `src/lib/bulkScanQuota.ts` wraps the DB fns.
      Verified live (read, save, persist, admin RLS all work).
- [ ] **Bulk upload UI — Path B** (upload a bundle) ← NEXT
- [ ] **Camera bulk — Path A** (rapid capture)
- [ ] **Review grid + "Add all to Vault"** (shared finish line + scan ticker)

EK's OPEN QUESTION is resolved: **per-tier defaults AND per-user overrides**
(both built into the admin page).

### Two flows (both end in a review grid; both = ONE Universe per batch)

**Path A — Bulk by camera (rapid capture):**
Snap, snap, snap — photos are INSTANT, no AI during capture. Hit **Save** →
AI runs the whole batch at once (identify + sort) → **review grid** →
"Add all to Vault."

**Path B — Bulk upload from saved images:**
Pick a bundle from phone/PC → **pick the ONE Universe first** (deliberate: less
user effort + more accurate AI; surface as a tip in a How-To) → then ask if
they want to AI-scan to fill gaps (opt-in) → **review grid** → "Add all to
Vault."

### Locked decisions
- **One Universe per batch. No mixed piles.** Re-upload for the next universe.
- **Review grid before anything enters the vault** — thumbnails + the AI's
  guesses; user fixes the wrong ones, then commits. (AI errs — it mislabeled a
  Magic card as "Force of Will".)
- **AI never blocks the fast part** (capturing/uploading). Photos/drafts =
  unlimited + free. Only AI identify is metered.
- Items created on commit auto-get their internal ID (DB trigger already does
  this — `supabase/migrations/20260718_internal_ids_triggers.sql`).

### AI scan quota — EK's FINAL decisions
- **Adding photos/drafts = unlimited, free.** Only **AI identify = counted**
  (1 scan per item the AI names).
- **A ticker** shows remaining in the bulk screen, e.g. "37 of 50 bulk scans
  left," ticking down as it runs.
- **Hitting the limit never blocks the user** — they can still add photos and
  fill details BY HAND. Only AI auto-fill pauses.
- **Monthly quota per tier, resets on the user's MONTHLY ANNIVERSARY** — their
  signup day-of-month (use profile `created_at` day-of-month), NOT the calendar
  1st.
- **Numbers are a config knob EK sets later.** Build a **NEW Admin tools page**
  where EK sets a **different amount per subscription tier** (Free / Mid / Full).
  → OPEN QUESTION to confirm with EK: per-tier only, or also per-individual-user
  overrides? ("each user subscription" most likely = per-tier.)

### Build ON these (don't reinvent)
- `src/components/CameraCapturePanel.tsx` — live camera; already has a "Bulk
  Add" toggle + `onBulkCapture(file, category, subcategory)`.
- `src/lib/bulkAddState.ts` — "locked fields" so consecutive adds share
  Universe/Category. Reuse for the batch's shared universe.
- `src/app/capture/page.tsx` — the Add screen (now camera-live inline).
  `handleBulkCapture` ~L377. AI identify = `analyzeImageWithVision`
  (`src/lib/ai/openaiVision.ts`), currently per-item in `handleCapture`.
- `src/app/vault/import/` — existing spreadsheet/text import (NOT images).
- Tiers: `src/lib/subscription.ts` (`getTierSafe`/`setTierSafe`,
  `FREE|MID|FULL`); profiles carry `tier` + `tier_expires_at`.
- Admin pages under `src/app/admin/*` — add the quota-config page alongside.

### Suggested data model (confirm before building)
- Per-tier config (admin-editable): table `bulk_scan_quotas`
  (`tier text primary key`, `monthly_limit int`). RLS: admins write; a user can
  read their own tier's number.
- Per-user usage on `profiles`: `bulk_scans_used int default 0`,
  `bulk_scans_cycle_start date`. A SECURITY DEFINER function
  `consume_bulk_scan(profile)` that atomically: rolls the cycle if
  `now >= cycle_start + 1 month` (anchored to `created_at` day-of-month) then
  checks `used < limit` and increments — returns remaining. (Mirror the
  internal-ID functions' style.)
- EK runs migrations manually — write the SQL, don't run it.

---

## 2. OTHER OPEN TASKS (see REWORK_PUNCHLIST.md)

Needs EK / a device:
- **Watchlist vs Wishlist naming** — mockups/nav say "Watchlist"; route is
  `/wishlist`; a `watchlistModel` exists. EK to pick the name before renaming
  (touches route, model, links).
- **Item photos** — 98/141 items have none; bulk upload is the real fix.
- **Capture on a real phone** — EK confirms: crop drag doesn't refresh, photo
  isn't dark, crop auto-fits after background removal.
- **Background-removal performance** — in-browser ML froze the desktop ~40s;
  worse on phone. Needs on-device profiling.

Smaller / later:
- Crop/filter step after snapping is one extra tap — could be skippable for the
  casual path.
- `vltd.app`: at launch point it at Vercel AND set `NEXT_PUBLIC_SITE_URL` so
  share links/OG use it (falls back to `https://vltd.app` now). Not a bug yet.
- Value-history chart: DATA is clean; the odd $150K axis was stale browser
  cache — self-heals, no fix needed.

---

## 3. Already DONE (don't redo — full list in REWORK_PUNCHLIST.md)

All 21 dead controls wired; garbled text removed; Activity/Insights/Discover
fake data removed; vault totals unified (sold excluded); gallery values fixed;
permanent **internal ID system** (backfilled 1,021 items, auto-assigns on
create); **Universe placeholders** wherever a photo is missing
(Activity/Vault/Goals/Watchlist); **Add-flow rebuild** (one camera-live screen,
"Add Item" = that screen, Quick Add kept, review = "Confirm details");
expired-session → login fix; repo hygiene (`/tmp/` ignored).

Memory files (indexed by `MEMORY.md`): vercel-auto-deploys-on-push,
vltd-curator-vs-collector-language, backend-wiring-standard,
supabase-migrations-applied-manually, no-emoji-icons,
background-locked-to-site-standard, internal-id-system.

---

## 4. First move for the new chat
1. Read this + `REWORK_PUNCHLIST.md`.
2. Confirm with EK: per-tier quota only, or also per-user overrides in Admin?
3. Write a short build plan, then build in small committable increments:
   **migration first** (EK runs it) → quota lib + admin page → bulk upload UI
   (Path B) → camera bulk (Path A) → review grid → commit-to-vault. Verify each
   on `vltd.vercel.app` via Claude-in-Chrome; `tsc`/`eslint`/`build` before push.
