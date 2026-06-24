create or replace function public.get_subject_leaderboard(p_subject text, p_limit int default 25)
returns table(rank bigint, profile_id text, username text, display_name text, item_count bigint, avatar_emoji text)
language sql security definer stable as $$
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
    and p.is_public = true
  group by p.id, p.username, p.display_name, p.avatar_emoji
  order by count(*) desc
  limit p_limit;
$$;
grant execute on function public.get_subject_leaderboard to anon, authenticated;

create or replace function public.get_top_subjects(p_limit int default 50)
returns table(subject text, collector_count bigint, total_items bigint)
language sql security definer stable as $$
  select lower(vi.subject) as subject,
    count(distinct vi.profile_id) as collector_count,
    count(*) as total_items
  from public.vault_items vi
  where vi.subject is not null and vi.subject != ''
    and (vi.is_deleted is null or vi.is_deleted = false)
  group by lower(vi.subject)
  order by count(distinct vi.profile_id) desc
  limit p_limit;
$$;
grant execute on function public.get_top_subjects to anon, authenticated;
