# Saved content: who saved what is readable by any visitor (2026-10-17): STATUS = SUPERSEDED by the tested migration `supabase/migrations/20261019_public_favorites_not_readable_by_others.sql` (HANDOFF row 22): written, tested 37/37 in a real Postgres, NOT yet applied

## What was measured (production, synthetic accounts)
A signed-out visitor, with only the public key, could list another account's saves:
`select user_id, content_id, metadata from public_favorites where user_id = <account>` returned the row: the account's **authentication id**, what it saved, and `metadata.profile_id` (its profile id) and title. The cause is the policy `"Public favorites are countable"` (`for select using (true)`, `supabase/migrations/20260429_public_favorites.sql`). The table also holds guests' `anonymous_id`; because it is readable, anyone can read a guest's id and call `unfavorite_as_guest(type, id, anonymous_id)` to remove that guest's save. (The earlier audit rated this "no PII, just a counter"; the rows do carry account and profile ids.)

Everything else about Saved content works and was verified live (save, reload, open, unsave, profile and account isolation in the app): see HANDOFF row 20.

## What the app needs from the table
- a public COUNT of saves per item or exhibition (shown on public pages);
- a signed-in account to read, add and remove ITS OWN saves (Favorites page, Save button);
- a guest to know whether it has saved something, and to add and remove its own.
Nothing needs a visitor, or another account, to read other people's rows.

## Draft change (to be tested in a real Postgres engine before anyone runs it)
1. `favorite_count(p_content_type text, p_content_id text) returns integer`: security definer, `stable`, returns only the count; execute for `anon` and `authenticated` only (revoke from PUBLIC).
2. `guest_favorite_status(p_content_type text, p_content_id text, p_anonymous_id text) returns boolean`: security definer, true only for that exact guest id; same grants.
3. Drop `"Public favorites are countable"`. Add `"Own favorites are readable"`: `for select to authenticated using (user_id = auth.uid())`. Leave the insert and delete policies and `unfavorite_as_guest` as they are.
4. `src/lib/favorites.ts`: `getFavoriteCount` calls `favorite_count`; the guest branch of `getFavoriteStatus` calls `guest_favorite_status`; the signed-in branches already filter on the account's own id and keep working under the new policy. Guests have no Favorites list page (it requires sign-in), so nothing else reads their rows.
5. Remaining limit, unchanged by this: a guest id is a client-made string with no secret behind it, so anyone who knows a guest's id could still remove that guest's save; closing that needs a signed guest token and is a separate decision. Hiding the ids at least stops them being listed.

## Verification plan (before calling it done)
Real-engine test of the SQL (visitor and other account see no rows; own rows and counts work; guest status works; insert and delete unchanged), read-only before/after checks file, then two synthetic accounts and a guest against production through the UI and the API (the same script that produced the finding, `fav2.cjs`, whose last check must turn green).

## Decision needed from EK
Apply this (new SQL, one function-plus-policy migration and a small code change), or accept that who-saved-what is publicly readable. Not changed in this pass.
