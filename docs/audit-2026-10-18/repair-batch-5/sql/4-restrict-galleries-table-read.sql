-- RC-05, STEP 4 of 4 (LAST). Close the old public read path on the galleries table. ONE TRANSACTION.
-- Run ONLY after: step 2 is applied, the site version that reads public_galleries is live, and every consumer was checked (see the staged order).
--
-- WHAT THIS DOES
--  1. gallery_items' public read rule asks "is this exhibition public?" with a sub-query on galleries, evaluated with the caller's own rights.
--     Once visitors can no longer read galleries that sub-query would return nothing and public exhibitions would show no items. So the rule
--     is rewritten first to ask a small helper that runs with the owner's rights (same meaning: PUBLIC + ACTIVE; aliases stay readable here,
--     the rows hold only exhibition and item ids).
--  2. The public SELECT rule on galleries is removed. After this a visitor or an unrelated account gets NOTHING from the table; public pages
--     read public_galleries (sanitised) and the share / invite functions. Members of a profile keep reading and writing their own exhibitions
--     (the member rules are untouched; the block stops if the member select rule is missing).
--  The public rule is found by its content and must be exactly one rule, otherwise the whole transaction is cancelled.
--  No data is changed. UNDO: rollback-4.sql.

begin;

create or replace function public.gallery_is_publicly_listed(p_gallery_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.galleries g where g.id::text = p_gallery_id and g.visibility = 'PUBLIC' and g.state = 'ACTIVE');
$$;

revoke all on function public.gallery_is_publicly_listed(text) from public;
grant execute on function public.gallery_is_publicly_listed(text) to anon, authenticated;

drop policy if exists "gallery_items_read_public" on public.gallery_items;
create policy "gallery_items_read_public" on public.gallery_items
  for select to anon, authenticated
  using (public.gallery_is_publicly_listed(gallery_id::text));

do $$
declare
  r record;
  found_count int := 0;
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'galleries' and policyname = 'galleries_select_member') then
    raise exception 'the member select rule galleries_select_member is missing: nothing was changed (run 20260927_fix_galleries_owner_select_policy.sql first).';
  end if;
  if to_regclass('public.public_galleries') is null then
    raise exception 'public_galleries does not exist: run step 2 first. Nothing was changed.';
  end if;
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'galleries' and cmd = 'SELECT'
      and qual ilike '%PUBLIC%' and qual ilike '%ACTIVE%' and qual not ilike '%is_profile_member%' and qual not ilike '%auth.uid%'
  loop
    found_count := found_count + 1;
    execute format('drop policy %I on public.galleries', r.policyname);
  end loop;
  if found_count <> 1 then
    raise exception 'expected exactly one public read rule on galleries, found %: nothing was changed.', found_count;
  end if;
end;
$$;

commit;
