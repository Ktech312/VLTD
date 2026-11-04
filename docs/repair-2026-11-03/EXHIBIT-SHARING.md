# Exhibition sharing (blocker 1) - cause, fix, verification

Date: 2026-11-03. Recorded defect: video-library-2 DEFECTS.md U-1 / D-1 / FINDINGS F-020.

## Short answer

A normal collector **can** share an exhibition link that other people open. It already worked on the live site before this change, on free and paid accounts, with the profile private. Nothing in the database or the public page needs the profile to be public.

What was wrong: the Share panel told every exhibition owner with a private profile "Your profile is private, so nobody else can open this link." That sentence is false for exhibitions (it is true for single-item links). It made the link look unusable, and the earlier video pass then made the profile public by a database edit to film the guest view.

The one code change removes that false sentence from exhibition links and keeps it on item links. No SQL, no database change.

## How the exhibition link works (traced)

1. Owner: Exhibitions > open exhibition > Share (`ContentActionBar` > `ShareDialog`). The link is `/museum/share/<token>` (`getGalleryShareUrl`, `src/lib/galleryModel.ts`). Every exhibition gets a random token when it is created.
2. Free accounts can only have Public exhibitions (`mustBePublicGallery`, `src/lib/galleryTier.ts`). Paid accounts choose Private / Public Exhibit / Guest View / Registered Users (`src/lib/galleryAccess.ts`): Private = `LOCKED`, Guest View and Registered Users = `INVITE`, Public Exhibit = `PUBLIC`.
3. Visitor: the page `src/app/museum/share/[token]/page.tsx` calls the database function `get_gallery_by_share_token(token)` and `get_gallery_items_by_share_token(token)` (`supabase/migrations/20261018_gallery_links_respect_private.sql`). These are SECURITY DEFINER functions: they return the exhibition only when the token matches **and** the exhibition is `PUBLIC` or `INVITE` and `ACTIVE` (the owner's own team always gets it). The row is trimmed (no visitor keys; when an alias is used, `profile_id` is blanked).
4. Items on the page come from the exhibition's own **public snapshots** (title, picture, category, year...) saved when the owner adds items. The snapshot builder leaves out notes, prices, storage location, serial numbers and so on. Hidden items are stored as "Hidden Item" with no title or picture. So the page does not need the items, or the profile, to be public.
5. Nothing in this chain reads the profile's `is_public`. That flag only controls the profile page (`/u/<name>`), the profile name and Follow button on the exhibition page (the visitor sees "Collector" instead), and **item** links (`/share/<itemId>` reads `public_vault_items`, which hides items of private profiles, so an item link on a private profile does return 404).

Intended rule (from the code, the UI copy "Anyone with the link can view this exhibition. It is not added to public discovery." and the migration comments): the link is the permission, for exhibitions the owner has explicitly set to a shared mode and that are active. The profile-level public switch stays a separate (paid, "coming soon") feature. No product decision is needed.

## Change

`src/components/share/ShareDialog.tsx` only: the "Your profile is private..." note (and the profile lookup behind it) now applies only when `kind === "item"`. No database change, no new migration, no SQL for EK to run.

## What I did to reproduce (before changing anything)

Test accounts were made with the QA harness (`docs/audit-2026-10-18/scripts/audit-new-fixture.cjs shr1`, production Supabase, own tagged fixture). The owner account was run both as **free** and as **paid** tier, with its profile **private** (`is_public = false`). Every exhibition below was created and set up with the app's own controls (Exhibitions > New, access-mode pills, Edit/Add picker, cover and background upload, the item eye, Share > Yes, Change > State). Three isolated headless Chrome profiles were used per check (owner, signed-out visitor, a second unrelated signed-in collector); EK's browser was not used. A database read was used only to confirm what the app saved, and to read the token of a refused (Private/draft) exhibition. The only direct edits were test seeding of private marker text on two QA items (to look for leaks) and the owner's tier.

Result: the claimed failure did **not** reproduce. Before the change, a signed-out visitor opened the link of a free-plan Public exhibition (local dev server, production database) and of a paid-plan Guest View exhibition (also on the live site https://vltd.app), both with a private profile (empty exhibition: title and "0 items"; with items: all items and their details; live site: Public, Guest View and alias exhibitions with items). `evidence/r1-owner-share-before.png` shows the false warning next to a link that worked; `evidence/r1-visitor-link.png` shows the visitor opening it.

Most likely the earlier pass saw "Link not available" only for an exhibition that was Private (that message is correct for Private and for draft/Storage exhibitions) and trusted the warning.

## Verification (after the change)

Run on the live site https://vltd.app after the deploy of commit 62654c9 (the same cases were also run on a local dev server first, same results). "Visitor" = signed out; "Other collector" = second QA account, unrelated to the owner. Evidence files are in `evidence/`.

| # | Case (made with the app's controls) | Visitor | Other collector |
|---|---|---|---|
| 1 | Free plan, Public exhibition, profile private (`free-plan-live-*.png`, `make-SHR-Free-Plan.json`) | Opens (cover, title, "0 items") | Opens |
| 2 | Public Exhibit, 3 items, link regenerated once | New link opens; **old link: "Link not available"** | Opens |
| 3 | Guest View, 4 items, cover and background uploaded, 1 item hidden with the eye | Opens; 3 items with details; hidden one shows "Hidden Item", grey box; clicking an item shows title and category | Opens |
| 4 | Registered Users | Gate: "Owner only allows registered users...", Create Free Account | Opens the exhibition |
| 5 | Private (never shared) | "Link not available" | "Link not available" |
| 6 | Private, then Share > "Turn on public sharing?" > Yes (link appears in the panel), then Private pill again | Opens after Yes; **refused after turning it off** | Same |
| 7 | Draft: Guest View exhibition moved to Storage with Exhibitions > Change > State | "Link not available" | "Link not available" |
| 8 | Guest View with an alias ("The Night Curator") | Opens, shows only the alias | Same |
| 9 | Guest View with 18+ on | Opens to the 18+ confirmation gate | Same |
| 10 | Guest View, items carrying private notes, purchase source/location, order number, storage location, serial number, purchase price and value | Opens; none of those texts appear in the page or in any response | Same |
| 11 | Owner's profile pages while the profile is private | `/u/<name>` 404; `/v/<id>` shows "Collector's Vault, Nothing public yet" without the real name | Same |
| 12 | Share panel on the exhibition (live, after deploy) | n/a | Owner sees the link **without** the false warning (`live-after-fix-exhibition-share.png`) |
| 13 | Share panel on an **item** of the private profile (local; unchanged behaviour) | Item link `/share/<id>` is 404 | Warning "Your profile is private..." still shown, which is true (`after-fix-item-share.png`) |

Leak checks (cases 3 to 10, every network response and the page text searched for the owner's real display name, username, email, user id and the private marker strings): none found. The exhibition response does carry the owner's profile id (an opaque UUID) for non-alias exhibitions, as before; for an alias exhibition it is blank (case 8: nothing found). The hidden item's real title was absent from the page and from all responses (case 3).

## Quality gates

`npx tsc --noEmit` clean, `npx eslint src/components/share/ShareDialog.tsx` 0 errors (1 old warning about an existing suppression), `npx next build --webpack` clean. Pushed to main as 62654c9 (no SQL, safe on its own).

## Clean-up (my own fixtures only)

Fixture `shr1` (3 auth users, 4 profiles, 26 QA items, 12 "SHR..." exhibitions, 2 storage pictures in `gallery-backgrounds`) removed by exact manifest ids; storage objects removed first. Afterwards: 0 SHR exhibitions, 0 of my profiles/users left, 0 storage pictures left, **46 public exhibitions** (baseline). The overall counts read 19 auth users and 3,485 vault items instead of the baseline 16 and 3,477 because the parallel business-membership session had its own fixture (`qa-biz1-*`: 3 users, 8 QA items) in place at that moment; they are not mine.

## Things noticed, not changed

- The Exhibitions list's details panel (`src/app/museum/page.tsx`) shows a copyable share link for every exhibition, including Private ones (the link then says "Link not available"). Harmless; could say "Private" instead.
- With a private profile, visitors see the curator as "Collector" and no Follow button. By design (the profile is private); an owner who wants their name shown has to make the profile public, which stays the separate paid feature.
- In the dev build only: the guest page logs a React "button inside button" hydration warning, and the 18+ gate can briefly show "This page did not finish loading". Not seen on the live site.
- Not tested: the `/museum/share/<token>` page for very old exhibitions that have no saved item snapshots owned by a private profile (items would then be empty); no such exhibition exists on a private profile in production today.

## Product decision for EK

None needed: the existing rule (the link is the permission; private, draft and alias protections unchanged) is what the code and UI copy already said. If EK wants private-profile collectors to show their name on shared exhibitions, that is the profile-level switch and is a separate decision.
