-- Personal and Business stay separate.
-- 1) An exhibit (gallery) can only hold items that belong to its own profile.
-- 2) The registry rankings only count items that are public.
-- Safe to run more than once. Does not delete or change any existing rows.

create or replace function public.enforce_gallery_item_same_profile()
returns trigger
language plpgsql
as $$
declare
  gallery_profile text;
  item_profile text;
begin
  select g.profile_id::text into gallery_profile from public.galleries g where g.id::text = new.gallery_id::text;
  select vi.profile_id::text into item_profile from public.vault_items vi where vi.id::text = new.artifact_id::text;

  if gallery_profile is not null and item_profile is not null and gallery_profile <> item_profile then
    raise exception 'An exhibit can only hold items from its own profile.';
  end if;
  return new;
end;
$$;

drop trigger if exists gallery_items_same_profile on public.gallery_items;
create trigger gallery_items_same_profile
  before insert or update on public.gallery_items
  for each row execute function public.enforce_gallery_item_same_profile();

-- Registry rankings: count only public items (private holdings must not leak as counts).
create or replace function public.get_subject_leaderboard(p_subject text, p_limit int default 25)
returns table(rank bigint, profile_id text, username text, display_name text, item_count bigint, avatar_emoji text)
language sql security definer stable
set search_path = public
as $$
  select
    row_number() over (order by count(*) desc) as rank,
    p.id::text as profile_id,
    p.username, p.display_name,
    count(*) as item_count,
    p.avatar_emoji
  from public.vault_items vi
  join public.profiles p on p.id::text = vi.profile_id
  where lower(vi.subject) = lower(p_subject)
    and (vi.is_deleted is null or vi.is_deleted = false)
    and vi.is_public = true
    and p.is_public = true
  group by p.id, p.username, p.display_name, p.avatar_emoji
  order by count(*) desc
  limit p_limit;
$$;
grant execute on function public.get_subject_leaderboard to anon, authenticated;
