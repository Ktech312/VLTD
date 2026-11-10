-- Free plan: an existing exhibition can be edited at the exhibition limit. Nothing else about the plan changes.
--
-- WHY: the app saves an exhibition with INSERT ... ON CONFLICT (id) DO UPDATE and Postgres fires a table's BEFORE INSERT triggers for every row of such a
-- statement, even when the row then resolves to an UPDATE. So enforce_gallery_limit() has been running on every save of an existing exhibition, and a free profile
-- that already has its 4 free exhibitions gets "FREE_TIER_LIMIT" when it saves ANY change to ANY of them (reproduced on a synthetic free account, 2026-11-08).
--
-- WHAT THIS CHANGES: when the row being saved is an exhibition that already exists, the COUNT / limit check is skipped. That is the only change.
--   * The current privacy rule is kept exactly as it is: a free profile's exhibition is stored PUBLIC (the same coercion that runs today, on edits too).
--   * A genuinely new exhibition is limited (4 + bonus) and coerced PUBLIC exactly as before.
--   * Paid profiles are untouched.
--   * No table, policy, grant or data changes. Safe to run more than once.
--   * Who may write an exhibition is decided by the table's row-level rules, which this file does not touch: an edit of someone else's exhibition is refused exactly as before.
--
-- THIS FILE DOES NOT DECIDE whether free exhibitions may be private. If you decide they may, run 20261109_gallery_upsert_not_a_new_exhibition.sql INSTEAD (it also keeps a
-- chosen Private/Guest View/Registered Users setting on edit). Do not run both: the one with the later file name wins, and this one is later.
--
-- AFTER RUNNING: run supabase/validation/20261110_free_plan_edit_at_limit_checks.sql (read-only) and send the one-row result.
-- UNDO: run supabase/rollback/20261110_free_plan_edit_at_limit_rollback.sql (restores the function exactly as 20260819_server_side_tier_limits.sql defined it).
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
  v_is_edit boolean;
begin
  select tier, coalesce(bonus_galleries, 0) into v_tier, v_bonus
  from public.profiles where id = new.profile_id;

  if v_tier is not null and v_tier <> 'FREE' then
    return new;
  end if;

  -- Free tier can only have PUBLIC exhibitions: coerce rather than reject (unchanged; applies to new and existing rows alike).
  if new.visibility is distinct from 'PUBLIC' then
    new.visibility := 'PUBLIC';
  end if;

  -- An upsert of an exhibition that already exists IN THIS SAME PROFILE is an edit, not a new exhibition: it is never counted against the limit.
  -- (An id that exists under another profile is not an edit of this profile's exhibition: it is limit-checked like any other new row, and the table's row-level rules still refuse to let anyone write to someone else's exhibition.)
  v_is_edit := exists (select 1 from public.galleries g where g.id = new.id and g.profile_id = new.profile_id);
  if v_is_edit then
    return new;
  end if;

  select count(*) into v_count from public.galleries where profile_id = new.profile_id;

  if v_count >= (v_base_limit + v_bonus) then
    raise exception 'FREE_TIER_LIMIT: % exhibition limit reached on the free plan', v_base_limit + v_bonus;
  end if;

  return new;
end;
$$;

commit;
