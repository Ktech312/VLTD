# Stage 3 (public-view consumers): DEPLOYED and VERIFIED on production (2026-10-21), stage 4 still blocked

Commits `29fc935` (consumers) and `d7b51a8` (cache ownership). Verified with isolated QA exhibitions (ordinary, alias, private, guest-only, draft), QA account B following QA profile A (a QA follower only), as a signed-out visitor, an unrelated signed-in account (B) and the owner (A). Baseline before the deploy: `evidence/rb20-second-before.*` (35 of 39 as expected: the four metrics below failed). After: **41 of 41** (`evidence/rb20-second-after.*`, rows RB20-xxx; an intermediate run, `rb20-first-after`, passed 39 of 39 before the extra cache checks were added).

## What changed
Public pages read exhibitions through `public_galleries` (falling back to the table only if the view is missing): Discover, lounge preview, guest page, follower feed, public home featured exhibition (kept in page memory only), page titles and preview images (Discover, share, guest, profile). The local exhibition cache now keeps only the signed-in person's own exhibitions; signed-out browsers no longer copy public exhibitions into storage; stale foreign copies are removed on the next load.

## Checklist (nine required consumers)
| # | Consumer | Result on production |
|---|---|---|
| 1 | Discover (visitor and unrelated account) | alias exhibition under the alias, ordinary under the real name; private / guest-only / draft not listed; the list comes from the view; **no table response names the alias exhibition's real profile (before: 2 responses did)** |
| 2 | Guest page: public, alias, private, guest-only, draft; owner's own private | visitor: public and alias render (alias under the alias, real name nowhere, cards render); private, draft, guest-only not shown; owner sees their private one |
| 3 | Share-link page (visitor and account B), invite page (account B) | ordinary and alias render (alias under the alias); private not shown; invite page renders for the signed-in account |
| 4 | Public home featured exhibition | still shown (the real featured exhibition's title is on the page) |
| 5 | Preview images and page titles | guest and share titles / descriptions name the alias, real name absent from the page source; guest, share, Discover and collector-profile preview images return 200 image/png |
| 6 | Follower feed (QA B follows QA A) | the ordinary exhibition's event is listed, the alias exhibition's is not |
| 7 | Owner: Exhibitions list, builder, own guest preview, Halls | all load; list shows public, alias, private and guest-only (a draft is archived and not listed, as designed); builder opens with the alias control |
| 8 | Public items | cards of a public exhibition render for a visitor (from the sanitised snapshots); none for private / draft / guest-only |
| 9 | Admin characters page | **NOT VERIFIED ON PRODUCTION**: needs an admin account and QA accounts must not be given admin rights. Code: its read of an exhibition's layout now falls back to the view if the table returns nothing; its save path is unchanged (still member-only). Needs your check, or your decision to accept before stage 4. |

## Cache ownership and alias handling (verified)
- Visitor's browser storage after Discover, guest, share and home: **no exhibition of anyone else stored** (before: the whole public set, 49 exhibitions, including the alias exhibition together with its real profile id).
- Signed-in unrelated account B: no exhibition of A stored at all (before: 2 with A's profile id); a planted stale foreign copy was removed; none was ever stored as B's own; every QA exhibition still belongs to A in the account (nothing uploaded under B); B's own Exhibitions list shows none of A's.
- Owner A's browser holds their own exhibitions under their own profile.
- Alias exhibitions never enter any cache without an owner: the view's rows are not cached at all.

## Still open (as agreed, until stage 4)
- A signed-in browser's own-exhibitions load still asks the table for everything it may read, so before stage 4 that response still contains other people's public exhibitions (including an alias exhibition's real profile id); the page now discards them. **Closing this path is stage 4.**
- The old table read for visitors is also still open (stage 4).
- The collector profile page's exhibition listing is still broken and untouched.
- `scripts/test-account-isolation.cjs` fails to load a goals module (`@/lib/vaultCloud` is not mocked); it does not involve this change (exhibition, move-profile, listing-privacy and sync tests all pass) and was not repaired.

## Decision for you
Stage 4 is offered only when all nine consumers pass. Eight pass on production; consumer 9 (admin characters page) cannot be tested by me. Either test it yourself on production (open the page, open an exhibit, confirm items load) or tell me to proceed without it; I will not run stage 4 on my own.
