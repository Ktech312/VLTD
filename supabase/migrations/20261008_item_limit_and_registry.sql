-- Two fixes. Safe to run more than once. Deletes and changes no item data.
--
-- 1) Free plan: editing an item you already have is never blocked by the 50-item limit
--    (the limit now only applies when a NEW item is added), and an expired paid plan counts as Free.
-- 2) Registry rankings: the two ranking functions pointed at a column that does not exist
--    (is_deleted). They now count only public items, so private collections never show up as counts.

create or replace function public.enforce_vault_item_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_expires timestamptz;
  v_count integer;
  v_limit constant integer := 50;
begin
  if new.profile_id is null
     or new.profile_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return new;
  end if;

  -- Editing an item that already exists is not adding one.
  if exists (select 1 from public.vault_items where id = new.id) then
    return new;
  end if;

  select tier, tier_expires_at into v_tier, v_expires from public.profiles where id = new.profile_id::uuid;

  -- A paid plan that has expired counts as Free.
  if v_tier is not null and v_tier <> 'FREE' and (v_expires is null or v_expires > now()) then
    return new;
  end if;

  select count(*) into v_count from public.vault_items where profile_id = new.profile_id;

  if v_count >= v_limit then
    raise exception 'FREE_TIER_LIMIT: % item limit reached on the free plan', v_limit;
  end if;

  return new;
end;
$$;

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
    and vi.is_public = true
    and p.is_public = true
  group by p.id, p.username, p.display_name, p.avatar_emoji
  order by count(*) desc
  limit p_limit;
$$;
grant execute on function public.get_subject_leaderboard to anon, authenticated;

create or replace function public.get_top_subjects(p_limit int default 50)
returns table(subject text, collector_count bigint, total_items bigint)
language sql security definer stable
set search_path = public
as $$
  select lower(vi.subject) as subject,
    count(distinct vi.profile_id) as collector_count,
    count(*) as total_items
  from public.vault_items vi
  where vi.subject is not null and vi.subject != ''
    and vi.is_public = true
  group by lower(vi.subject)
  order by count(distinct vi.profile_id) desc
  limit p_limit;
$$;
grant execute on function public.get_top_subjects to anon, authenticated;
