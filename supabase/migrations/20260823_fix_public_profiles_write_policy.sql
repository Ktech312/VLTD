-- Fixes a real, confirmed hole: "Public profiles can be synced by anon
-- clients" (20260516_public_profiles.sql) was `for all using (true) with
-- check (true)` — anyone, logged in or not, could INSERT/UPDATE/DELETE
-- ANY row in public_profiles (display_name, avatar, bio for ANY user).
-- Confirmed exploitable through the app's own real code path
-- (src/lib/publicProfile.ts's upsert/delete, src/app/admin/characters
-- page's update) — not theoretical.
--
-- Real usage check before writing this: syncPublicProfile() (called from
-- account/page.tsx and HomeClient.tsx) always writes the CALLER's own
-- profile_id — never someone else's. The one other real writer,
-- admin/characters/page.tsx, manages synthetic "character" public
-- profiles that have no real auth.uid() owner at all, so an owner-only
-- check would break that admin tool — the fix below allows both: the
-- real owner of a real profile, OR a recognized admin (same pattern
-- already used for user_roles in 20260606_user_roles.sql).

drop policy if exists "Public profiles can be synced by anon clients" on public_profiles;
drop policy if exists "Owners and admins can manage public profiles" on public_profiles;

create policy "Owners and admins can manage public profiles"
  on public_profiles for all
  using (
    profile_id in (select id from profiles where user_id = auth.uid())
    or (auth.jwt() ->> 'email') = 'eck1679@gmail.com'
    or exists (select 1 from user_roles where email = (auth.jwt() ->> 'email'))
  )
  with check (
    profile_id in (select id from profiles where user_id = auth.uid())
    or (auth.jwt() ->> 'email') = 'eck1679@gmail.com'
    or exists (select 1 from user_roles where email = (auth.jwt() ->> 'email'))
  );

-- "Public profiles are readable" (select, using (true)) is untouched —
-- that one's intentional and correct: public profiles are meant to be
-- world-readable, only the wide-open WRITE policy was the bug.
