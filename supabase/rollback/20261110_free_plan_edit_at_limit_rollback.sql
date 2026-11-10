-- Rollback for 20261110_free_plan_edit_at_limit_keeps_public.sql: restores enforce_gallery_limit() exactly as supabase/migrations/20260819_server_side_tier_limits.sql defined it
-- (the limit check runs again on every save of an existing exhibition). Safe to run more than once. Changes no data.
begin;

create or replace function public.enforce_gallery_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_bonus integer;
  v_count integer;
  v_base_limit constant integer := 4;
begin
  select tier, coalesce(bonus_galleries, 0) into v_tier, v_bonus
  from public.profiles where id = new.profile_id;

  if v_tier is not null and v_tier <> 'FREE' then
    return new;
  end if;

  -- Free tier can only have PUBLIC exhibitions — coerce rather than reject,
  -- same spirit as the count check below being the only hard stop.
  if new.visibility is distinct from 'PUBLIC' then
    new.visibility := 'PUBLIC';
  end if;

  select count(*) into v_count from public.galleries where profile_id = new.profile_id;

  if v_count >= (v_base_limit + v_bonus) then
    raise exception 'FREE_TIER_LIMIT: % exhibition limit reached on the free plan', v_base_limit + v_bonus;
  end if;

  return new;
end;
$$;

commit;
