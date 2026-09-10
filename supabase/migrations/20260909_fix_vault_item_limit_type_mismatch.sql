-- Fixes a real, severe bug: enforce_vault_item_limit() (added
-- 2026-08-19 to close the client-side tier-limit bypass) compares
-- vault_items.profile_id (TEXT) directly against profiles.id (UUID)
-- with no cast:
--
--     select tier into v_tier from public.profiles where id = new.profile_id;
--
-- Postgres has no "uuid = text" operator, so this throws
-- "operator does not exist: uuid = text" on EVERY row this trigger
-- fires for. Because it's a BEFORE INSERT trigger, and Postgres fires
-- BEFORE INSERT triggers for the ON CONFLICT DO UPDATE path too (before
-- the conflict is even detected), this has been failing on:
--   - every brand-new item saved to Supabase (a real INSERT), AND
--   - every edit to an EXISTING item that goes through
--     upsertVaultItemToSupabase's .upsert() (which is nearly all of
--     them: title/price edits, photo replace/crop, etc.)
-- since the moment that migration was applied. The local (device-only)
-- copy still saves fine, which is why edits *look* successful in the
-- moment — but the cloud row is never actually written, so the change
-- is lost the next time the item is reloaded from Supabase (e.g. after
-- navigating away and back, or on another device). Two other functions
-- in this codebase already knew about and guarded against exactly this
-- (vault_items.profile_id being TEXT while profiles.id is UUID) — see
-- is_profile_member_text() in 20260707_profile_members.sql and
-- tg_assign_item_code() in 20260718_internal_ids_triggers.sql. This
-- migration was the one place that missed the cast.
--
-- Safe to re-run.

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
  -- vault_items.profile_id is TEXT; profiles.id is UUID. Only a
  -- well-formed uuid string can match a real profile row — anything
  -- else (null, malformed) just skips the limit check instead of
  -- erroring, same defensive pattern used elsewhere in this codebase.
  if new.profile_id is null
     or new.profile_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return new;
  end if;

  select tier into v_tier from public.profiles where id = new.profile_id::uuid;

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
