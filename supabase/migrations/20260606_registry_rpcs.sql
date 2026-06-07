-- ─────────────────────────────────────────────────────────────
-- Registry RPCs: global subject leaderboards
-- ─────────────────────────────────────────────────────────────

-- Index: all subjects with collector/item counts and top collector
create or replace function get_registry_subjects()
returns table (
  subject         text,
  collector_count bigint,
  item_count      bigint,
  top_profile_id  uuid,
  top_display_name text,
  top_avatar_emoji text,
  top_item_count  bigint
)
language sql security definer stable as $$
  with per_collector as (
    select
      lower(trim(v.subject))              as subject_key,
      max(v.subject)                      as subject,
      v.profile_id,
      count(*)                            as item_count,
      sum(coalesce(v.current_value, 0))   as total_value,
      max(p.display_name)                 as display_name,
      max(p.avatar_emoji)                 as avatar_emoji,
      row_number() over (
        partition by lower(trim(v.subject))
        order by count(*) desc, sum(coalesce(v.current_value,0)) desc
      ) as rn
    from vault_items v
    left join public_profiles p on p.profile_id = v.profile_id
    where v.is_public = true
      and v.subject is not null
      and trim(v.subject) <> ''
    group by lower(trim(v.subject)), v.profile_id
  )
  select
    max(subject)                                              as subject,
    count(distinct profile_id)                               as collector_count,
    sum(item_count)                                          as item_count,
    max(profile_id)    filter (where rn = 1)                 as top_profile_id,
    max(display_name)  filter (where rn = 1)                 as top_display_name,
    max(avatar_emoji)  filter (where rn = 1)                 as top_avatar_emoji,
    max(item_count)    filter (where rn = 1)                 as top_item_count
  from per_collector
  group by subject_key
  order by sum(item_count) desc, max(subject);
$$;

-- Leaderboard: ranked collectors for a given subject
create or replace function get_subject_leaderboard(subject_name text)
returns table (
  profile_id   uuid,
  display_name text,
  avatar_emoji text,
  bio          text,
  item_count   bigint,
  total_value  numeric,
  sample_items jsonb
)
language sql security definer stable as $$
  select
    v.profile_id,
    coalesce(p.display_name, 'Collector')  as display_name,
    coalesce(p.avatar_emoji, '🗝️')         as avatar_emoji,
    p.bio,
    count(*)                               as item_count,
    sum(coalesce(v.current_value, 0))      as total_value,
    jsonb_agg(
      jsonb_build_object(
        'id',                    v.id,
        'title',                 v.title,
        'image_front_url',       v.image_front_url,
        'image_front_storage_path', v.image_front_storage_path,
        'current_value',         v.current_value,
        'grade',                 v.grade
      )
      order by coalesce(v.current_value, 0) desc
    ) filter (where v.id is not null) as sample_items
  from vault_items v
  left join public_profiles p on p.profile_id = v.profile_id
  where v.is_public = true
    and lower(trim(v.subject)) = lower(trim(subject_name))
  group by v.profile_id, p.display_name, p.avatar_emoji, p.bio
  order by count(*) desc, sum(coalesce(v.current_value, 0)) desc;
$$;

grant execute on function get_registry_subjects()           to anon, authenticated;
grant execute on function get_subject_leaderboard(text)     to anon, authenticated;
