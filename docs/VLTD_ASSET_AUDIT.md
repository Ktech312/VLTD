# VLTD Asset Audit and Preservation Rules

Date: 2026-07-07

Purpose: protect the real VLTD feel before redesign work begins. This audit is the source of truth for assets that must not be lost, replaced with generic icons, or silently bypassed during the page redesign project.

## Current status

- Audit only. No UI redesign implementation has been approved from this file.
- Existing worktree already contains unrelated changes. Do not revert or overwrite them during this project.
- Design target from user direction: premium VLTD vault/museum feel, top desktop navigation, mobile bottom navigation, no generic SaaS sidebar direction, desktop and mobile views for every page, real app imagery where possible.

## Asset groups to preserve

### Brand assets

These are core identity assets and must remain available for page work:

- `public/brand/vltd.png`
- `public/brand/vltd-logo.png`
- `public/brand/vltd-logo-primary.png`
- `public/brand/vltd-logo-header.png`
- `public/brand/vltd-icon.png`
- `public/brand/vltd-vault-key.png`
- `public/brand/vltd-business-card-black.png`
- `public/brand/vltd-collector-vault-hero-app-screen.png`
- `public/brand/vltd-collector-vault-hero-app-screen-bright.png`
- `public/brand/vltd-app-home-screenshot.png`

Rule: do not replace these with generic wordmarks, Lucide icons, plain initials, or generated approximations unless the user explicitly approves a new brand asset.

### Avatar preset assets

Folder: `public/avatars/presets`

Manifest: `public/avatars/presets/manifest.json`

Audit result: 16 image files, 16 manifest entries. No missing preset manifest entries found.

Current preset files:

- `cards.png`
- `crown.png`
- `dragon.png`
- `eagle.png`
- `fire.png`
- `fox.png`
- `gem.png`
- `guitar.png`
- `harp.png`
- `key.png`
- `keysmith.png`
- `lion.png`
- `orb.png`
- `sword.png`
- `vault.png`
- `vinyl.png`

Rule: user-facing avatar pickers should use these real images as primary choices, not emoji circles.

### Realistic avatar assets

Folder: `public/avatars/realistic`

Manifest: `public/avatars/realistic/manifest.json`

Initial audit result: 23 image files, 22 manifest entries.

Found missing from manifest:

- `public/avatars/realistic/funko-collector.png`

Also found missing from `src/lib/seedAvatar.ts`:

- `funko-collector`

Resolution started:

- `funko-collector` is now registered in `public/avatars/realistic/manifest.json`.
- `funko-collector` is now registered in `src/lib/seedAvatar.ts`.

Rule: realistic avatars should be source-controlled through a manifest or shared registry. No realistic avatar file should exist in the folder while being unreachable from UI or seed helpers.

### Collectible/product imagery

Folder: `public/collectibles`

Assets found:

- `comic-slab.png`
- `guitar.png`
- `movie-poster.png`
- `sports-slab.png`
- `vault-intake-source.png`
- `vault-intake-sprites.png`
- `vinyl-figure.png`
- `vinyl-record.png`

Rule: visual mockups and redesigned pages should prefer these assets or real portal/item images over generic placeholder cards.

### Universe thumbnail assets

Folder: `public/universe-thumbnails`

Assets found:

- `art.png`
- `automotive.png`
- `built-botany.png`
- `games.png`
- `jewelry-apparel.png`
- `misc.png`
- `music.png`
- `pop-culture.png`
- `sports.png`
- `tcg.png`

Current usage exists in:

- `src/app/discover/page.tsx`
- `src/app/vault/page.tsx`
- `src/app/vault/[universe]/page.tsx`

Rule: universe landing, vault, discover, and exhibition surfaces should use these real thumbnails when a visual category signal is needed. Emoji universe icons may remain as small secondary labels, not the main visual system.

### Theme and museum wall assets

Folder: `public/themes`

Important current assets include:

- `classic-bg.png`
- `classic-bg.webp`
- `classic-shelf-wall.webp`
- `cold-blue-bg.png`
- `marble-bg.png`
- `marble-bg.webp`
- `marble-shelf-wall.webp`
- `midnight-bg.png`
- `midnight-bg.webp`
- `midnight-bg-v2.webp`
- `midnight-shelf-wall.webp`
- `walnut-bg.png`
- `walnut-bg.webp`
- `walnut-shelf-wall.webp`

Rule: public gallery, exhibition, and museum-facing pages should preserve this themed environment direction. Do not flatten them into generic SaaS panels.

## Code paths that currently protect the real feel

- `src/components/TopNav.tsx` has custom SVG navigation icons and avatar preset mapping for `__preset:*` URLs.
- `src/components/BottomNav.tsx` contains the existing mobile bottom navigation icon language.
- `src/app/HomeClient.tsx` contains a fuller avatar picker pattern using `AVATAR_PRESETS` and supports custom uploaded avatar images.
- `src/lib/publicProfile.ts` resolves `__preset:*` avatar URLs for public profile payloads.
- `src/lib/seedAvatar.ts` maps realistic seed profiles to `public/avatars/realistic`.
- `src/lib/avatarRegistry.ts` now centralizes preset and realistic avatar asset references for new work.

Rule: consolidate these patterns instead of duplicating divergent hardcoded avatar maps.

## Code paths at risk of generic drift

### P0 risks

- `src/app/onboarding/page.tsx`
  - Initial risk: used `AVATAR_EMOJIS` as the primary avatar picker.
  - Initial risk: saved only `avatar_emoji` during profile creation.
  - Initial risk: did not set `avatar_url` to `__preset:*`.
  - Status: updated to use real VLTD avatar preset images from `src/lib/avatarRegistry.ts`.
  - Status: selected avatar now persists as `avatar_url`.

- `src/lib/auth.ts`
  - Initial risk: `createProfile` accepted `avatar_emoji` but not `avatar_url`.
  - Status: `createProfile` now accepts and inserts `avatar_url`.

- `src/lib/onboardingDraft.ts`
  - Initial risk: draft stored `avatar_emoji` but not `avatar_url`.
  - Status: draft now stores `avatar_url`.

### P1 risks

- `src/components/TopNav.tsx`
  - Has local duplicated preset mapping. It should use a shared avatar registry so a missing avatar cannot happen in one file but not another.
  - Profile switcher still displays `avatar_emoji` in some rows.

- `src/app/account/workspace/page.tsx`
  - Workspace profile editing still uses "Avatar emoji" language and state.

- `src/app/user/profile/page.tsx`
  - Local profile editor still presents emoji/image mode. It may be separate from Supabase profile identity, but it should be checked before redesign.

- `src/lib/publicProfile.ts`
  - Has another duplicated avatar preset map.

- `src/app/community-board/page.tsx`, `src/lib/registryModel.ts`, registry RPCs
  - Still depend on `avatar_emoji` for compact identity. These can stay as fallback, but not as the primary visual identity where avatar image data is available.

## Immediate project order

1. Fix the asset registry. Status: started.
   - Done: added `funko-collector.png` to `public/avatars/realistic/manifest.json`.
   - Done: added `funko-collector` to `src/lib/seedAvatar.ts`.

2. Create a shared avatar registry. Status: started.
   - Done: added `src/lib/avatarRegistry.ts` with preset avatar IDs, labels, and `src` paths.
   - Done: added realistic avatar handles, labels, and `src` paths.
   - Done: `src/lib/seedAvatar.ts` now reads handles from the shared registry.
   - Remaining: replace duplicate maps in `TopNav`, `HomeClient`, and `publicProfile` over time.

3. Upgrade onboarding identity. Status: started.
   - Done: replaced emoji grid with real VLTD preset avatar image choices.
   - Done: default selection is `__preset:key`.
   - Done: selected image is saved as `avatar_url`.
   - Done: `avatar_emoji` remains as fallback.
   - Remaining: preserve custom uploaded avatar path when profile editing supports it.

4. Upgrade workspace/profile identity editing.
   - Replace "Avatar emoji" with real avatar image selection or upload.
   - Keep compact fallback only where required by old database fields.

5. Start page redesign implementation only after the identity system is protected.
   - For each tab/page, produce desktop and mobile screenshot verification.
   - Before/after screenshots are required before considering a page done.
   - Any replaced image, icon, avatar, or navigation element must be listed.

## Non-negotiable preservation rules

- No generic avatar grids.
- No replacing real VLTD avatars with emoji unless it is a fallback state.
- No replacing existing custom nav icon language with unrelated generic icon packs.
- No sidebar-style redesign unless the user explicitly asks for it.
- No fake placeholder item imagery when a real app asset or portal image can be used.
- No silent asset substitutions.
- No page is complete until desktop and mobile screenshots are shown.
