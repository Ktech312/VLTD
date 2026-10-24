-- Rollback for 9-wishlist-pull-list.sql. Emergency use only.
-- It puts the previous shared-wishlist read and the two-value status rule back. It does NOT drop the new wishlist columns (that would lose what people entered),
-- and it moves any Acquired or Skipped want back to Wanted so the old status rule can hold: those two states are lost by this rollback (the Vault records
-- already created stay). It does remove the Following rules table.
update public.wishlist set status = 'want' where status in ('acquired', 'skipped');
alter table public.wishlist drop constraint if exists wishlist_status_check;
alter table public.wishlist add constraint wishlist_status_check check (status in ('want', 'preordered'));

drop function if exists public.get_shared_wishlist(text);
create function public.get_shared_wishlist(p_token text)
returns table (
  owner_name   text,
  title        text,
  image_url    text,
  universe     text,
  category     text,
  subject      text,
  release_date date,
  status       text,
  source       text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select pr.display_name, w.title, w.image_url, w.universe, w.category, w.subject,
         w.release_date, w.status, w.source, w.created_at
  from public.wishlist_shares s
  join public.profiles pr on pr.id = s.profile_id
  join public.wishlist w on w.profile_id = s.profile_id
  where s.token = p_token
  order by w.release_date nulls last, w.created_at desc;
$$;
grant execute on function public.get_shared_wishlist(text) to anon, authenticated;

drop policy if exists "Owners manage their wishlist share - update" on public.wishlist_shares;
alter table public.wishlist_shares drop column if exists fields;
drop index if exists public.wishlist_profile_identity_uidx;
drop table if exists public.pull_rules;
