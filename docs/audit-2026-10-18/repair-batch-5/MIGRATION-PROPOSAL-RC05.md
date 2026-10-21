# RC-05 migration package, revision 2 (HELD: nothing has been run, no announcement was sent)

Revision 2 replaces revision 1. Differences you asked for, and what I found while doing them:

| You asked | Now |
|---|---|
| Allowlist view, no visitor identifiers, inspect `item_notes` / snapshots / nested data | The view lists 15 columns by name and **rebuilds** `layout` and `exhibition_layout` from allowed keys only. `item_notes`, `analytics_unique_view_keys`, `analytics_last_viewed_at`, `updated_at` are excluded. Hidden items keep only id / hidden / blur thumbnail / created time. See sections 3 and 4. |
| Alias protection for events is required | Not optional any more: part of step 1. A visitor or unrelated account sees an event only while its exhibition is public, active and has no alias; the check happens when the event is read, so making an exhibition Private hides its older events too. |
| Insert must check membership AND that the exhibition belongs to the profile | Done (`can_record_exhibition_event`); an event that pairs your profile with another account's exhibition, or with a missing one, is refused. |
| Safe rollout | Five numbered stages, each with its own check and rollback (section 6). The old table read path is closed last (step 4). |
| (found) | The share/invite link functions return the whole exhibition row; 20261018 already removes visitor keys and the profile id of an alias, but they still returned curator notes and the unfiltered layout. Step 2 sanitises them too. |
| (found) | `gallery_items`' public rule depends on the galleries table being publicly readable. Closing the table without rewriting it would make public exhibitions show no items. Step 4 rewrites it first. |
| (found) | The site's hydrate step and the public home read the galleries table directly; they are consumers of the view change (section 7). |

## 1. Assumptions to confirm (step 0 prints them)
1. `exhibition_events` has exactly the rules of 20260622 (read-all, "Owner insert"); step 1 stops if it sees any other policy.
2. `galleries` has the public read rule of 20260601 plus the member rules (`galleries_select_member`, insert/update/delete); steps 2 and 4 stop if not.
3. `20261018_gallery_links_respect_private.sql` is applied (function `gallery_public_row` exists); step 2 stops if not.
4. `gallery_items` has the 20260823 public read rule (sub-query on galleries).
5. No trigger or other policy reads `galleries` under the caller's rights (listed by 0.6 / 0.7).

## 2. Findings that justify the package (production, QA data; details in `evidence/`)
| # | Finding | Evidence |
|---|---|---|
| F-1 | A profile's member is refused when recording an event (42501); an insert using the auth id as profile id fails on the foreign key (23503), so the old rule `auth.uid() = profile_id` is the live rule (`20260823_fix_exhibition_events_team_check.sql` never applied). The table holds 0 rows. | RB12-015 (blocked) |
| F-2 | A visitor reading a public exhibition that uses an alias receives the real `profile_id` and every other column. | RB12-016 (blocked) |
| F-3 | `exhibition_events` is readable by everyone and each row carries `profile_id` and the exhibition id. | policy text of 20260622 |
| F-4 | Share/invite functions return the full row: after 20261018 without visitor keys and (alias) profile id, but still with `item_notes` and the unfiltered layout JSON. | 20261018 source |
| F-5 | `gallery_items_read_public` uses a sub-query on `galleries` under the caller's rights. | 20260823 source |
| F-6 | Structure scan of all 47 production exhibitions (46 public, 1 guest-only; 3 use an alias), key names and counts only: no profile / account id or email appears in any public column or nested value; no snapshot holds a per-item value; 0 hidden items today; `item_notes` empty everywhere; 7 visitor keys exist in total; 7 exhibitions carry stray numeric keys `"0".."3"` in `exhibition_layout` (single characters, an object spread of a string; not read by any screen). | `evidence/gallery-json-structure-scan.json` |
| F-7 | A hidden item is redacted when written (`hiddenSnapshot`), but public rendering also hides it at display time, so an older row could still hold its real title and image in the stored JSON. The view redacts it regardless. | `src/lib/hiddenItems.ts`, Discover |

## 3. The files (run in this order; every file is one transaction except the read-only ones)
| Stage | File | Does | Rollback |
|---|---|---|---|
| 0 | [0-inspect-read-only.sql](sql/0-inspect-read-only.sql) | read only: policies, grants, helpers, link functions, triggers, other dependents, data counts | none needed |
| 1 | [1-events-authorization-and-privacy.sql](sql/1-events-authorization-and-privacy.sql) | event insert needs profile membership **and** exhibition-belongs-to-profile; event read limited to public no-alias exhibitions (members read their own); update/delete privileges removed | [rollback-1.sql](sql/rollback-1.sql) |
| 2 | [2-public-galleries-view-and-link-sanitising.sql](sql/2-public-galleries-view-and-link-sanitising.sql) | allowlist view `public_galleries`; share/invite functions return sanitised rows to non-members | [rollback-2.sql](sql/rollback-2.sql) |
| 3 | (site change, no SQL: I deploy it) | public pages read the view; verified before step 4 | revert the deploy |
| 4 | [4-restrict-galleries-table-read.sql](sql/4-restrict-galleries-table-read.sql) | `gallery_items` public rule rewritten with a definer helper, then the public read rule on `galleries` removed | [rollback-4.sql](sql/rollback-4.sql) |
| any | [validation-queries.sql](sql/validation-queries.sql) | read-only checks per stage, each states the expected result | none |

## 4. The view's allowlist, field by field
| Field | Why a public screen needs it |
|---|---|
| id, title, description, cover_image, created_at | cards, listings, page header, Discover ordering |
| visibility, state | the pages test them (always PUBLIC / ACTIVE in the view) |
| profile_id (NULL for an alias exhibition) | Discover's collector name and item-ownership check, the profile-page query, the guest page's owner test: all only for exhibitions shown under the real name |
| alias_enabled, alias_name, alias_avatar (name/avatar NULL unless the alias is on) | alias display |
| public_token | the public share link of an exhibition that is listed publicly anyway; the home page and the feed build links from it |
| analytics_views | the view counter shown on cards |
| layout, exhibition_layout | rebuilt from: themePack, displayMode, guestViewMode, shelfBackground, glassShelfOverlay, shelfOverlayStyle, templateId, adultOnly, type, itemIds (text only), sections[id, title, description, featuredItemId, itemIds, slotLayout], publicItemSnapshots[id, title, subtitle, number, grade, year, description, categoryLabel, subcategoryLabel, imageFrontUrl, imageBackUrl, imageFrontStoragePath, primaryImageKey, createdAt, hidden, blurThumb]. Only plain text / number / true-false values are kept. |

Excluded on purpose: `analytics_unique_view_keys` (visitor identifiers), `analytics_last_viewed_at`, `item_notes` (curator notes: displayed only in the owner's builder and owner metrics), `updated_at`, per-item value (no screen reads it; the current builder does not write it), the stray numeric keys, every unknown or future key and column. Being readable today was not a reason to include anything.

## 5. Event rules
| Who | Insert | Read |
|---|---|---|
| Visitor | no | only events of an exhibition that is PUBLIC + ACTIVE with no alias, judged at read time |
| Unrelated signed-in account | no | same as a visitor |
| Member of the event's profile | only for an exhibition of that profile | all of that profile's events, whatever the exhibition's state |
| Member of another profile | their own profile + their own exhibitions only | public no-alias events only |
Switching an exhibition to Private, Guest View, Registered, draft, or turning an alias on hides its earlier events immediately; switching back restores them.

## 6. Exact staged order
Stop at any failed check and tell me; each stage has a rollback.
1. **Stage 0 (you).** Run [0-inspect-read-only-single.sql](sql/0-inspect-read-only-single.sql): it is one query with one result cell (the Supabase editor shows only the last result of a script), copy that whole cell and send it to me. (The ten-block version, [0-inspect-read-only.sql](sql/0-inspect-read-only.sql), prints the same material if you run its blocks one at a time.) I cannot read production's policies myself, so **no modifying file is authorised until I have reviewed this output** against the checklist in section 6a and told you it matches. The 76 local checks show the SQL behaves as designed on the schema I assumed; they do not show that production has that schema.
2. **Stage 1 (you).** Run `1-events-authorization-and-privacy.sql`. Then run the stage-1 block of `validation-queries.sql` and send the output. **(me, on your word)** I create isolated QA content with two QA accounts and check on production: the owner records an event for their own exhibition; the same user's profile with the other account's exhibition is refused; an unrelated account is refused; a visitor and an unrelated account read none of the alias / private / guest-only / draft events; setting the exhibition to Private hides its event, setting it back shows it; Announce on a QA exhibition (QA profile has 0 followers, so nothing reaches a real person) shows "✓ Announced" with exactly one row; the follower notice on Make public is recorded. Rollback: `rollback-1.sql`.
3. **Stage 2 (you).** Run `2-public-galleries-view-and-link-sanitising.sql`; run the stage-2 validation block; send the output. **(me)** I create a QA exhibition with deliberately hostile data and read the view and the share link as a visitor and as an unrelated account. Rollback: `rollback-2.sql`.
4. **Stage 3 (me, no SQL).** I deploy the site change (section 7) and verify every consumer on production before you do anything else: visitor, unrelated account, member, with alias, public, private and draft QA exhibitions; Discover, the guest page, share and invite pages, the public home, the preview images, the follower feed, the owner's builder and list, and the local-cache step. I report a table; you decide whether to continue. The old table read path is still open here, so this stage can be reverted by reverting the deploy.
5. **Stage 4 (you).** Run `4-restrict-galleries-table-read.sql` only after the stage-3 table is clean. Run the stage-4 validation block. **(me)** I repeat the full matrix, including a visitor, an unrelated account and a member, and confirm nothing public broke. Rollback: `rollback-4.sql`.

### 6a. What I check in the stage-0 output (any mismatch stops the package and I revise it)
| Item in the output | Must show | If it differs |
|---|---|---|
| `rls` | row security on for galleries, gallery_items, exhibition_events | stop: different protection model |
| `policies` for exhibition_events | exactly "Public read exhibition_events" (select, true) and "Owner insert exhibition_events" (insert, auth.uid() = profile_id); no others | an extra rule could re-open event reads or inserts; step 1 would refuse to run, I revise it |
| `policies` for galleries | one public SELECT rule (public + active), `galleries_select_member`, member insert / update / delete rules; nothing permissive for anon beyond the public read | an extra anon rule would keep exposing alias rows after step 4 |
| `policies` for gallery_items | the 20260823 public read rule (sub-query on galleries) | step 4's rewrite must match what is there |
| `table_grants` | anon: select (no insert/update/delete) on galleries and gallery_items; whatever is on exhibition_events (step 1 normalises it) | a write grant for anon on galleries would be a separate, more serious finding |
| `column_grants_of_note` | none (table-level select only) | column-level rules change what a "view" can hide |
| `functions` and the two link-function definitions | `gallery_public_row` present, security definer, not executable by anon/authenticated; share/invite functions as in 20261018 | if absent, 20261018 was never applied: that is its own stage before this package |
| `triggers` and `other_policies_mentioning_galleries` / `views_mentioning_galleries` | nothing beyond the known per-profile item trigger | any other reader of galleries under the caller's rights would break at step 4 |
| `public_galleries_view_exists` | false (or, if true, I read its definition before replacing it) | |
| `exhibition_events_rows` | 0 (or I review each row's exhibition before step 1 changes who can read them) | |
| `exhibitions_with_account_ids_in_public_columns` | 0 | any hit is fixed in the data or the sanitising before stage 2 |

### 6b. The gate for step 4 (no step 4 until every required consumer is verified on production)
Required, each verified with QA data as a visitor, an unrelated signed-in account, a member (owner), and with public / alias / private / guest-only / draft exhibitions, after the stage-3 deploy and **before** you are asked to run step 4:
1. Discover list and detail panel (alias shown under the alias, real name otherwise)
2. Guest page of a public exhibition, a public alias exhibition, and the owner's own (including a private one)
3. Share-link page and invite-link page (visitor and owner)
4. Public home featured exhibitions
5. Preview images / page titles: Discover, share link, guest page, profile
6. Follower feed (events and links)
7. Owner: builder, Exhibitions list, Save, the local-cache step (no alias row adopted, no other person's exhibition cached)
8. Public items of a public exhibition (visitor) and none of a private or draft one
9. Admin characters page still reads and updates
Step 4 is offered only when all nine pass; otherwise it stays unrun.

## 7. Site change for stage 3 (prepared in design, not written or deployed)
Consumers of the galleries table, and what each must do (list only; code follows after stage 2):
| Consumer | Needs | Hazard noted |
|---|---|---|
| Discover page, lounge preview, public-profile query | list public exhibitions: read `public_galleries` (fall back to the table if the view is missing) | none new; alias rows have no profile id and are shown under the alias (shipped in `d1b6293`) |
| Guest page (`/museum/[id]/guest`) and `fetchGalleryFromSupabaseById` | one exhibition by id: table first (members get the full row), then the view | owner test uses `profile_id`; alias rows from the view have none, so the owner must come through the table |
| `hydrateLocalGalleriesFromSupabase` and the public home (`refreshGalleriesFromSupabase`) | today `select *` on the whole table pulls every public exhibition into the local cache; after stage 4 it returns only the member's own | must merge view rows for visitors **without** adopting alias rows (rows with no profile id are given the active profile id by an existing migrate helper) and keep working for the featured exhibitions on the home page |
| Server-side preview images and page titles (`discover/opengraph-image`, `museum/share/[token]/layout` and `opengraph-image`, `museum/[galleryId]/guest/layout` and `opengraph-image`, `u/[username]/opengraph-image`) | public exhibition by id / token / profile through REST | switch to the view; alias rows then have no profile id (the profile-image counter excludes them) |
| Follower feed (`notificationFeed`) | public link token per exhibition | use the view; events of alias exhibitions are already unreadable after stage 1 |
| Share and invite pages | the link functions | no change (stage 2 sanitises them) |
| Admin characters page | updates exhibitions of seeded profiles | not public; verify the admin still reads and updates after stage 4 |

## 8. Limitations that remain (not addressed by any file here)
1. An alias hides the curator's name and avatar on that exhibition. It gives **no anonymity** against matching shared items, photos or descriptions across exhibitions or with the real vault.
2. The public profile page and the curator pop-up list no exhibitions at all (their query names columns that do not exist). Not touched. If it is ever repaired it must hide alias exhibitions; with the view that is automatic (alias rows have no profile id).
3. Visitor view counting writes `analytics_unique_view_keys` through the table; I have not investigated whether non-members' writes are accepted today. Excluding the keys from the view does not change who may write. A proper fix (a function that records a view) is a separate piece of work.
4. Other lenient money parsers are recorded as findings, not repaired (see `CLOSEOUT.md`).

## 9. Local validation (real in-process Postgres, synthetic data)
`scripts/test-rc05-sql-in-postgres.cjs`, output `evidence/rc05-sql-local-postgres.log`: **76 passed, 0 failed.** It reproduces production's behaviour first, then checks after each file as a visitor, an unrelated signed-in account, a member and a second profile's member: public / alias / private / guest-only / draft / deleted exhibitions; the cross-account event; event visibility flipping with the exhibition's state; the allowlist and a deliberately hostile row (owner id, email, private note, per-item value, hidden title and images, stray keys, nested objects, non-text item ids); the share link for visitor, unrelated account and owner; items of public and non-public exhibitions after step 4; guards (unknown policy, missing prerequisite, two public rules, wrong order); each file twice; the three rollbacks. `validation-queries.sql` and `0-inspect-read-only.sql` were also executed against that database (no syntax errors).
