-- Editing an existing exhibition must not be treated as creating a new one.
--
-- The app saves an exhibition with INSERT ... ON CONFLICT (id) DO UPDATE. Postgres fires a table's BEFORE INSERT triggers for every
-- row of such a statement, even when the row then resolves to an UPDATE (see 20260925_fix_missing_bonus_galleries_column.sql). So
-- enforce_gallery_limit() (20260819) has been running on every save of an existing exhibition, with two effects on free-tier profiles:
--   1. a profile that already has the 4 free exhibitions gets "FREE_TIER_LIMIT" when it saves ANY change to ANY of them;
--   2. the "free exhibitions are PUBLIC" coercion rewrites the visibility the person just chose (Private, Guest View, Registered
--      Users) back to PUBLIC while the page shows Private and "Saved".
-- Reproduced on a synthetic free-tier account (2026-11-08): at 4 exhibitions an upsert of an existing one fails with FREE_TIER_LIMIT;
-- below the limit a LOCKED upsert is stored as PUBLIC. All 43 exhibitions owned by free-tier profiles are PUBLIC today.
--
-- This changes ONLY the existing-row case: a genuinely new exhibition is limited and coerced exactly as before. It does not decide the
-- product question of whether free-plan exhibitions may be private (see DECISION in docs/verification-2026-11-04/FREE-TIER-GALLERY-UPSERT.md).
-- Safe to run more than once. Changes no data.
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
  -- An upsert of an exhibition that already exists is an edit, not a new exhibition.
  if exists (select 1 from public.galleries g where g.id = new.id) then
    return new;
  end if;

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
