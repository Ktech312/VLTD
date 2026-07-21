# VLTD Redesign — Element-by-Element Mapping & Checklist

**Purpose:** A verification checklist so the visual redesign moves existing functionality into
better layouts **without losing anything already built**. Each redesign element maps to the
existing route/component and data behind it, with a status flag.

**Guiding principle:** Keep the current backend and data model. First pass moves the *same*
functionality into cleaner layouts. Backend additions come *after* the frontend redesign, in a
deliberate build order (see bottom).

---

## Status legend

| Flag | Meaning |
|------|---------|
| ✅ **EXISTS** | Already built — restyle/move only, no new logic |
| 🔀 **MOVE** | Exists elsewhere — relocate into the new layout |
| 🎨 **NEW UI** | New layout/section, but the **data already exists** |
| 🗄️ **NEW BACKEND** | Needs new tables/RPCs (deferred to build-order phase) |
| 🧮 **FRONTEND-COMPUTED** | New number, but derivable from existing fields — no backend for v1 |

---

## Scope of first redesign pass

**Redesign now (public / product tabs):**
Home · Vault · Item record · Exhibitions · Discover · Insights/Portfolio · Watchlist · Goals · Learn · Activity · Capture

**Do NOT touch yet (settings / operational / auth):**
`account/*` (page, security, workspace, roles, team, billing, invite, backup) · auth
(`login`, `signup`, `onboarding`, `forgot-password`, `reset-password`) · `admin/*` · old utility
pages (`studio`, `styles`, `ingest`, `market`, `shop`, `auction`, `events`, `kickstarter`,
`patreon`, `community-board`, `registry`).

**Rule:** the new visual system applies to reviewed public/product tabs first. Settings and
operational pages stay as-is until separately reviewed.

---

## Global shell

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Top nav (Home, Vault, Exhibitions, Discover, Insights, Watchlist, Goals, Learn, Activity) | Desktop top nav | `src/components/TopNav.tsx` | ✅ EXISTS | Already top-nav, not sidebar. 9 items → add a **More** overflow below ~1100px. |
| Mobile bottom nav | Bottom nav | `src/components/BottomNav.tsx` | ✅ EXISTS | Keep. Same 4–5 primary tabs; rest under More. |
| Global search + ⌘K | Command palette | `src/components/CommandPalette.tsx` | ✅ EXISTS | Portal fix already landed. Wire the nav search box to open it. |
| Account dropdown / profile switch | Account menu | `src/components/TopNav.tsx` | ✅ EXISTS | Profile switcher already built. |
| Notifications bell | — | `src/app/notifications/page.tsx` | ✅ EXISTS | Route exists; badge count is 🗄️ later (alerts phase). |

---

## 1. Home (logged-out marketing)

> The mockup "Home" is the **marketing/landing** page, not the logged-in dashboard.

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Hero + value props | Landing hero | `src/app/page.tsx` → `HomeClient` | ✅ EXISTS | Restyle to new system. |
| Featured exhibitions strip | Public galleries | `src/app/HomeClient.tsx` | ✅ EXISTS | Solid-gold CTA already standardized. |
| Logged-in dashboard | Dashboard | `src/app/dashboard/page.tsx` | ✅ EXISTS | Separate from marketing Home — keep the split. |

---

## 2. Vault

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Vault landing (universe tiles / totals) | Vault index | `src/app/vault/page.tsx` | ✅ EXISTS | |
| Per-universe grid | Universe view | `src/app/vault/[universe]/page.tsx` | ✅ EXISTS | Bulk select + move-to-profile already built. |
| Masonry / density toggle | Grid vs list | same | 🎨 NEW UI | Layout toggle over existing item list. |
| Item quick-look drawer | Right rail drawer | (drawer in universe page) | 🎨 NEW UI | Uses existing item fields. |
| Storage location chip ("Box 12 · Shelf B") | — | none | 🗄️ NEW BACKEND | `storage_locations` (Search/locations phase). Hide until built. |
| Value/confidence badge on card | Value fields | item `value_confidence` | ✅ EXISTS | Median/comps stay placeholder until Pricing Engine. |

---

## 3. Item record page

> Redesign reorganizes one item into tabs: **Record · Value Evidence · Documentation · Share/Sell.**

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Item detail shell | Item page | `src/app/vault/item/[id]/page.tsx` | ✅ EXISTS | |
| **Record** tab (title, cert, condition, images) | Existing item fields | same | 🔀 MOVE | Regroup current fields under a tab. |
| **Value Evidence** tab | `value_confidence`, `current_value`, `value_source` | same | 🎨 NEW UI | Show confidence now; median/comps/sources = placeholders → 🗄️ Pricing Engine. |
| **Documentation** tab + % complete | photos/cert/notes/purchase flags | same | 🧮 FRONTEND-COMPUTED | Score = how many doc slots filled. No backend for v1. |
| **Share/Sell** tab | present / share / for-sale | `.../present/page.tsx`, `src/app/share/[itemId]/page.tsx`, `src/app/vault/for-sale/page.tsx` | 🔀 MOVE | Consolidate existing actions. |
| Insurance PDF for item | Insurance | `src/app/insurance/item/page.tsx`, `src/app/insurance/packet/*` | ✅ EXISTS | Link from Documentation tab. |
| Present / stream mode | Presentation | `src/app/vault/item/[id]/present/page.tsx` | ✅ EXISTS | |

---

## 4. Exhibitions (rename of "Museum/Galleries")

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Exhibitions index (masonry grid) | Museum index | `src/app/museum/page.tsx` | ✅ EXISTS | "Exhibits" rename already in nav. |
| Filter pills (Active/Drafts/Public/Invite/Locked) | Gallery states | same | 🎨 NEW UI | Public/private toggle exists; Draft/Invite/Locked map to existing privacy states. |
| Exhibition detail / room | Gallery view | `src/app/museum/[galleryId]/page.tsx`, `src/app/gallery/[galleryId]/page.tsx` | ✅ EXISTS | |
| Create exhibition | New museum | `src/app/museum/new/page.tsx` | ✅ EXISTS | |
| Guest / share link view | Guest + token | `src/app/museum/[galleryId]/guest/page.tsx`, `src/app/museum/share/[token]/page.tsx`, `src/app/museum/invite/[token]/page.tsx` | ✅ EXISTS | Share link + copy already there. |
| **Exhibition Grade (A+/A/B+)** | item grades + value | none | 🧮 FRONTEND-COMPUTED | Derive from item count / grade coverage / total value. No backend for v1. |
| Estimated gallery value | sum of item values | existing values | ✅ EXISTS | Aggregate existing `current_value`. |
| Exhibition checklist (cover, desc, items, categories, tags) | gallery fields | same | 🧮 FRONTEND-COMPUTED | Completeness check over existing gallery fields. |

---

## 5. Discover

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Discover feed | Discover | `src/app/discover/page.tsx` | ✅ EXISTS | |
| Public collector profiles | Collector / user | `src/app/collector/page.tsx`, `src/app/u/[username]/page.tsx`, `src/app/v/[profileId]/page.tsx` | ✅ EXISTS | |
| Follow / favorite | Favorites | `src/app/favorites/page.tsx`, `src/app/saved/page.tsx` | ✅ EXISTS | Follow = 🗄️ later if social graph is wanted. |

---

## 6. Insights / Portfolio

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Insights dashboard | Portfolio | `src/app/portfolio/page.tsx` | ✅ EXISTS | |
| Total vault value + month change | Aggregates | existing values | ✅ EXISTS | Month change trend = 🗄️ needs `portfolio_snapshots` for real history. |
| Value history chart | — | none | 🗄️ NEW BACKEND | `portfolio_snapshots` (Reports phase). Show current-only until then. |
| Value breakdown donut (by universe) | Universe totals | `src/app/portfolio/universe/[key]/page.tsx` | ✅ EXISTS | Compute from current holdings. |
| Insurance covered % | Insurance readiness | `src/app/portfolio/insurance/page.tsx`, `src/app/vault/readiness/page.tsx` | ✅ EXISTS | Reuse readiness logic. |
| Portfolio movers (gainers/decliners) | — | none | 🗄️ NEW BACKEND | Needs `price_snapshots` history (Pricing Engine). |
| Value Evidence panel (median/confidence/sources) | `value_confidence` | item fields | 🎨 NEW UI | Confidence now; median/sources = 🗄️ Pricing Engine. |
| Stale prices / items needing review | `value_updated_at` | item fields | 🧮 FRONTEND-COMPUTED | "Stale" = age of `value_updated_at`. |

---

## 7. Watchlist

> **Mostly new.** Precursors exist (`wishlist`, `saved`, `favorites`) but not price targets/alerts.

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Watchlist index | Wishlist / saved | `src/app/wishlist/page.tsx`, `src/app/saved/page.tsx` | 🔀 MOVE | Reuse as the base list. |
| Target price + alert | — | none | 🗄️ NEW BACKEND | `watchlist_items`, `alert_rules`, `notifications` (Watchlist/alerts phase). |
| Saved searches | — | none | 🗄️ NEW BACKEND | `saved_searches`. |
| Recent comparable sales table | — | none | 🗄️ NEW BACKEND | `price_comparables` (Pricing Engine). |
| Watch an exhibition | Galleries | museum routes | ✅ EXISTS | Follow existing gallery; alert = 🗄️ later. |

---

## 8. Goals

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Goals dashboard | Goals | `src/app/goals/page.tsx` | ✅ EXISTS | |
| Completion / value / sell / gallery goal types | Goals | same | ✅ EXISTS / 🎨 NEW UI | Verify all four types exist; add missing as UI over existing data. |
| Insurance Ready goal (checklist + %) | Readiness | `src/app/vault/readiness/page.tsx`, `src/app/portfolio/insurance/page.tsx` | ✅ EXISTS | Surface readiness score — don't reinvent. |
| "Missing documents" list | doc flags | item fields | 🧮 FRONTEND-COMPUTED | Same source as Documentation %. |
| Sell duplicates | For-sale / sold | `src/app/vault/for-sale/page.tsx`, `src/app/vault/sold/page.tsx`, `src/app/sales/page.tsx` | ✅ EXISTS | |
| Upcoming milestones timeline | Goal due dates | goals data | 🎨 NEW UI | Layout over existing goal dates. |

---

## 9. Learn

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Learn hub | Learn | `src/app/learn/page.tsx` | ✅ EXISTS | |
| Guides & articles | Articles | `src/app/learn/articles/page.tsx`, `src/app/learn/articles/[slug]/page.tsx` | ✅ EXISTS | |
| Collector playbooks / quick guides | Articles/guide | `src/app/guide/page.tsx` | ✅ EXISTS / 🎨 NEW UI | Curated groupings over existing content. |
| Newsletter signup | — | none | 🗄️ NEW BACKEND | Optional; low priority. |

---

## 10. Activity

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Activity feed | Activity | `src/app/activity/page.tsx` | ✅ EXISTS | Today the feed is limited — full audit needs backend. |
| Filters (Scans/Value/Exhibitions/Insurance/Sales/Shares) | — | partial | 🗄️ NEW BACKEND | `activity_events` (Activity audit phase) to record all event types. |
| Activity detail drawer | — | partial | 🎨 NEW UI | Layout over event records once logged. |
| Undo / add price target from event | — | none | 🗄️ NEW BACKEND | Depends on activity_events + pricing. |

---

## 11. Capture / New Vault Item

> The **biggest self-contained win** — accordion record-builder. Data flow already exists.

| Redesign element | Maps to | Existing file | Status | Notes |
|---|---|---|---|---|
| Guided capture (accordion sections) | Capture | `src/app/capture/page.tsx` | 🎨 NEW UI | Reorganize existing add flow into collapsible steps. |
| Full add form | Add | `src/app/vault/add/page.tsx` | ✅ EXISTS | Restored overlays intact (Camera/Barcode/DropReview). |
| Quick add | Quick | `src/app/vault/quick/QuickAddClient.tsx` | ✅ EXISTS | Object-URL bug fixed. |
| Smart Scan (AI classify → autofill dropdowns) | AI analyze | `src/app/api/ai/analyze-item/route.ts`, `src/lib/visionTaxonomy.ts` | ✅ EXISTS | Universe/category/subcategory autofill already wired. |
| Camera / barcode capture | Scanner | `src/components/ScanCapturePanel.tsx`, `src/lib/scanners/barcodeScanner.ts` | ✅ EXISTS | Full-screen fix landed. |
| Free-tier limit nudge | Upgrade nudge | `src/components/UpgradeNudge.tsx` | ✅ EXISTS | |
| Scan session history | — | none | 🗄️ NEW BACKEND | `scan_sessions`/`scan_drafts`/`scan_results` (Scan pipeline phase). |
| Bulk import | Import | `src/app/vault/import/page.tsx` | ✅ EXISTS | |

---

## New backend (deferred — build in this order)

Each phase is independent; frontend degrades gracefully (hide the section / show placeholder)
until its backend lands.

1. **Frontend redesign** — all of the above; no schema changes.
2. **Documentation scoring + Value Evidence display** — 🧮 frontend-computed doc %, exhibition
   grade, stale-price flags; surface existing `value_confidence`. *(No backend.)*
3. **Pricing Engine** — `price_snapshots`, `price_comparables`, `price_sources`, `pricing_jobs`,
   `item_identity_matches`. Powers median/comps/sources, movers, value history.
4. **Activity audit** — `activity_events`. Powers the full Activity feed + filters + undo.
5. **Scan / Search / Locations** — `scan_sessions`, `scan_drafts`, `scan_results`;
   `storage_locations`, `vault_search_index`.
6. **Watchlist / Alerts** — `watchlist_items`, `saved_searches`, `alert_rules`, `notifications`.
7. **Reports** — `report_exports`, `portfolio_snapshots`. Powers value-history chart + exports.

---

## Verification rule

Before marking any redesigned page "done," confirm every ✅/🔀 element from its table is present
and working in the new layout. Nothing on the ✅/🔀 lines should disappear — only move or restyle.
🎨/🧮 items are additive. 🗄️ items are allowed to be absent (hidden/placeholder) until their phase.
