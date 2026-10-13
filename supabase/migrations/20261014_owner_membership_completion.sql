-- Completes 20261013_profile_owner_membership_for_new_profiles.sql.
--
-- That migration handled profiles with NO membership rows. This one also handles the other broken state:
-- a profile that HAS membership rows but no valid OWNER row (for example only a member/admin row), which
-- the database treats as "nobody owns this" for owner-only actions.
--
-- Ownership rules this follows (see 20260707_ownership_transfer.sql: a transfer moves profiles.user_id AND the
-- 'owner' membership together, so profiles.user_id is the account of record):
--   * A profile that already has an owner row is NEVER changed here, even if profiles.user_id names someone else.
--     Those are only listed by the verification queries, so a legitimate transfer is never undone.
--   * A profile with no owner row gets one only when profiles.user_id is a real account. If that account is
--     already on the team (member/admin) it is promoted to owner; otherwise it is added as owner. Other team
--     members are left exactly as they are.
--   * A profile whose profiles.user_id is not a real account is not touched (the verification queries list it).
--
-- Nothing is deleted. Safe to run more than once. Run supabase/verification/20261014_owner_membership_checks.sql
-- before and after.

-- 1) The trigger from the previous migration stays; re-stated so this file is complete on its own.
create or replace function public.add_profile_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    insert into public.profile_members (profile_id, user_id, role)
    values (new.id, new.user_id, 'owner')
    on conflict (profile_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_add_owner_member on public.profiles;
create trigger profiles_add_owner_member
  after insert on public.profiles
  for each row execute function public.add_profile_owner_member();

-- 2) Profiles with no membership at all (same rule as before).
insert into public.profile_members (profile_id, user_id, role)
  select p.id, p.user_id, 'owner'
  from public.profiles p
  where p.user_id is not null
    and exists (select 1 from auth.users u where u.id = p.user_id)
    and not exists (select 1 from public.profile_members m where m.profile_id = p.id)
on conflict (profile_id, user_id) do nothing;

-- 3) Profiles that have members but no owner: the account of record becomes owner (promoted if already on the team).
insert into public.profile_members (profile_id, user_id, role)
  select p.id, p.user_id, 'owner'
  from public.profiles p
  where p.user_id is not null
    and exists (select 1 from auth.users u where u.id = p.user_id)
    and exists (select 1 from public.profile_members m where m.profile_id = p.id)
    and not exists (select 1 from public.profile_members m where m.profile_id = p.id and m.role = 'owner')
on conflict (profile_id, user_id) do update set role = 'owner';
