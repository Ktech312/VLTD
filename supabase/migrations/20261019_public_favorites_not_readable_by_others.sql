-- Saved content (public_favorites): nobody can list or read another person's saves any more.
-- Today the policy "Public favorites are countable" (SELECT, using true) lets ANY visitor read every row: the account's authentication id,
-- its profile id (metadata.profile_id), what it saved, and every guest's anonymous_id. Measured on production 2026-10-17 with synthetic accounts.
-- What this changes (and nothing else):
--   1. removes every SELECT policy on public.public_favorites and adds one: signed-in accounts can read only their OWN rows (user_id = auth.uid())
--   2. removes SELECT on the table from visitors (anon) and from PUBLIC: a visitor can read nothing from it directly
--   3. adds favorite_count(type, id): the public aggregate count, no rows, no ids
--   4. adds guest_favorite_status(type, id, anonymous_id): lets a guest ask "have I saved this?" with its own guest id, which is now a secret that is no
--      longer listable (it is a random string made in the guest's own browser)
--   5. closes the 2026-10-10 backup copy of the table (public_favorites_backup_20261010) to every role but the owner and the service key
-- What it does NOT change: who can save or unsave (insert and delete policies, unfavorite_as_guest), the app's profile tagging, anything else.
-- Safe order: the app code that calls the two functions falls back to the old query while they do not exist, so deploy the code and run this in either order.
-- Repeatable. If an unexpected ALL policy exists on the table it stops (and changes nothing) instead of leaving a hole.
begin;

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'public_favorites' and cmd = 'ALL') then
    raise exception 'public_favorites has an ALL policy: review it by hand before running this migration';
  end if;
end $$;

-- 1. read policies
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'public_favorites' and cmd = 'SELECT' loop
    execute format('drop policy %I on public.public_favorites', p.policyname);
  end loop;
end $$;
create policy "Own favorites are readable" on public.public_favorites
  for select to authenticated
  using (user_id = auth.uid());

-- 2. no direct reading for visitors
revoke select on public.public_favorites from anon;
revoke select on public.public_favorites from public;

-- 3 + 4. the two questions the app still needs answered without reading rows
create or replace function public.favorite_count(p_content_type text, p_content_id text)
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::integer from public.public_favorites where content_type = p_content_type and content_id = p_content_id;
$$;

create or replace function public.guest_favorite_status(p_content_type text, p_content_id text, p_anonymous_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select nullif(btrim(coalesce(p_anonymous_id, '')), '') is not null
     and exists (
       select 1 from public.public_favorites
       where content_type = p_content_type and content_id = p_content_id
         and anonymous_id = p_anonymous_id and user_id is null
     );
$$;

revoke all on function public.favorite_count(text, text) from public;
revoke all on function public.guest_favorite_status(text, text, text) from public;
grant execute on function public.favorite_count(text, text) to anon, authenticated;
grant execute on function public.guest_favorite_status(text, text, text) to anon, authenticated;

-- 5. the backup copy made when favorites were cleared (it holds account ids)
do $$
begin
  if to_regclass('public.public_favorites_backup_20261010') is not null then
    revoke all on public.public_favorites_backup_20261010 from anon;
    revoke all on public.public_favorites_backup_20261010 from authenticated;
    revoke all on public.public_favorites_backup_20261010 from public;
  end if;
end $$;

commit;
