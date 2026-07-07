-- ─────────────────────────────────────────────────────────────
-- Phase 4: Ownership transfer (sell the business)
-- =============================================================
-- Owner-only RPC that hands a whole profile — its items, exhibits,
-- team, and subscription tier — to another account. The seller keeps
-- their other profiles untouched. Safe to re-run.
--
-- Depends on: 20260707_team_management.sql
-- ─────────────────────────────────────────────────────────────

create or replace function public.transfer_profile_ownership(p_profile uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me     uuid := auth.uid();
  v_target uuid;
begin
  if not exists (
    select 1 from public.profile_members
    where profile_id = p_profile and user_id = v_me and role = 'owner'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Only the owner can transfer this profile.');
  end if;

  select id into v_target from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_target is null then
    return jsonb_build_object('ok', false, 'error', 'No VLTD account found for that email — they must sign up first.');
  end if;
  if v_target = v_me then
    return jsonb_build_object('ok', false, 'error', 'That is already your account.');
  end if;

  -- New owner (promote existing member or add fresh)
  insert into public.profile_members (profile_id, user_id, role)
    values (p_profile, v_target, 'owner')
    on conflict (profile_id, user_id) do update set role = 'owner';

  -- Remove the previous owner from the team entirely (they've sold it)
  delete from public.profile_members where profile_id = p_profile and user_id = v_me;

  -- Reassign the profile record itself so it shows up under the buyer's account.
  -- Items (vault_items.profile_id) and galleries (galleries.profile_id) reference
  -- the profile, so they travel with it automatically.
  update public.profiles set user_id = v_target where id = p_profile;

  insert into public.tier_changes (profile_id, source, reason, changed_by)
    values (p_profile, 'transfer', 'ownership transferred', (auth.jwt() ->> 'email'));

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.transfer_profile_ownership(uuid, text) to authenticated;
