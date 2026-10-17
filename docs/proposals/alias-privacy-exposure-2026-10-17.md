# Alias privacy: what a visitor can and cannot connect (measured 2026-10-17, production, site commit 121060d, migration 20261018 applied)

**Short answer: an aliased exhibition is NOT anonymous.** The alias hides the collector's name on the exhibition's page, and (since the 20261018 migration) the link response no longer carries the real profile id. A visitor can still connect the exhibition to the collector through the exhibition's ITEMS.

## How it was tested
`docs/ui-verification-2026-10-17/scripts/alias-exposure.cjs`, synthetic data only. One collector with a PUBLIC profile (name visible in `public_profiles`), one LISTED exhibition (Public), and one ALIASED Guest View exhibition. Four kinds of item in the aliased exhibition: public in the vault / private in the vault, each either only in the aliased exhibition or also in the listed one (photos unique per item). The visitor is a plain anonymous client (what anyone with the site's public key can do) who starts with the aliased link token only.

## What the visitor learns, exactly
| Item in the aliased exhibition | Linkable to the collector? | How |
|---|---|---|
| Public in the vault, only in the aliased exhibition | **YES** | The link lists the item id; the public item view returns that item with its `profile_id`; the public profile table then returns the collector's name. |
| Public in the vault, also in the listed exhibition | **YES** | Same as above, and the same id is in the listed exhibition's item list. |
| Private in the vault, also in the listed exhibition | **YES** | The listed exhibition's item list (readable by anyone) contains the same item id, and that exhibition names the collector. |
| Private in the vault, only in the aliased exhibition | **No (found no way)** | Its id is not in the public item view, not in any listed exhibition, and its photo address is not on any public item. |

Checked and NOT a route (all returned nothing for the visitor): the link's own row (no profile id, name, user id or e-mail; visitor identifiers empty); the aliased exhibition read straight from the exhibitions table (blocked); activity events, exhibition events, views, invite tokens, virtual rooms for that exhibition (0 rows); item notes and artifact events (denied). The page a visitor's browser loads shows the alias and no real name; the only request carrying the real profile id is the generic public-exhibitions list, which does not mention the aliased exhibition.

Not tested (so not claimed either way): matching by the collector's own wording, cover or photo content shared with public items, creation / update times, someone who already knows the collector. Anything public in the vault is, by the owner's own choice, searchable by anyone, so an aliased exhibition containing public items can always be matched by content.

## Unrelated observations (NOT changed, for EK to decide)
- `referral_codes` is readable by any visitor and shows each code with its owner's account id.
- `appreciations` is readable by any visitor (item id + the profile that appreciated it).

## Proposal (smallest that removes the connection and keeps discovery, public links and owner access)
1. **Wording (done, tiny).** The exhibition Share prompt no longer says "a hidden collector name stays hidden". The alias help already says only "Hides your real name on THIS exhibition's public page"; keep it that way. Nobody should write "anonymous" for aliases.
2. **App only, no migration: an "Alias check" on the exhibition page.** When Use an alias is on, compute and show in plain words which items connect the exhibition to the collector: items that are public in the vault, and items that are also in any of the collector's Public exhibitions, each with a one-tap "Take these out of this exhibition" the owner chooses (never automatic) and a "Keep anyway" that leaves everything as is. When nothing connects: "Nothing visitors can see connects this exhibition to you. Words and photos you add can still give you away." Same check, as a warning only, when an item is made public or added to a listed exhibition while it sits in an aliased one. Nothing about listed exhibitions, link functions, ownership or the owner's access changes.
3. **Rule that makes the claim true (what the check enforces):** an aliased exhibition is unlinkable only if every item in it is private in the vault AND is not in any Public exhibition, and the photos / text do not themselves identify the collector.
4. **Not recommended now (bigger, still not anonymity):** give aliased exhibitions their own pseudonymous item ids and render them from stored copies only (new column + changes to the link functions + page). That removes the id route but not the content route for public items, so step 2 is still needed; do it only if EK wants aliases to protect items that are public elsewhere.

Status: proposal only (except the wording in 1). Nothing in step 2 or 4 has been built.
