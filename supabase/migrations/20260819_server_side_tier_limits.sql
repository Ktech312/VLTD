-- Closes a real bypass: vault_items' 50-item cap and galleries' 4-exhibition
-- cap (and the free-tier "must be PUBLIC" rule) were only ever enforced
-- client-side, reading tier from localStorage (getTierSafe()). Anyone could
-- set localStorage["vltd_tier"] to "FULL" in devtools, add unlimited items,
-- create unlimited/private galleries, then let it revert — the extra rows
-- would already exist. This enforces the same limits server-side, reading
-- the profile's REAL tier from the database, which the client can't touch.
--
-- Only gates INSERT (not UPDATE/DELETE) — existing rows a profile already
-- has are never blocked from being edited just because they're now over a
-- limit (e.g. after a downgrade). This closes the exploit for new rows
-- going forward; it does not retroactively clean up anything created before
-- this migration runs.

create or replace function public.enforce_vault_item_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_count integer;
  v_limit constant integer := 50;
begin
  select tier into v_tier from public.profiles where id = new.profile_id;

  -- MID/FULL (or a tier value we don't recognize) = unlimited. Only FREE
  -- (including NULL, the default for a profile that's never been granted
  -- anything) is capped.
  if v_tier is not null and v_tier <> 'FREE' then
    return new;
  end if;

  select count(*) into v_count from public.vault_items where profile_id = new.profile_id;

  if v_count >= v_limit then
    raise exception 'FREE_TIER_LIMIT: % item limit reached on the free plan', v_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_vault_item_limit on public.vault_items;
create trigger trg_enforce_vault_item_limit
  before insert on public.vault_items
  for each row execute function public.enforce_vault_item_limit();

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

drop trigger if exists trg_enforce_gallery_limit on public.galleries;
create trigger trg_enforce_gallery_limit
  before insert on public.galleries
  for each row execute function public.enforce_gallery_limit();
