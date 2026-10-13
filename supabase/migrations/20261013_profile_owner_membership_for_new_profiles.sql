-- New profiles never became "members" of themselves, so their owners could not save to the cloud.
--
-- Found by testing with two QA accounts (2026-10-13): items, exhibitions and everything else that is gated by
-- is_profile_member() (20260707_profile_members.sql) are refused for a profile that has no profile_members row.
-- That migration added one owner row for every profile that existed on 2026-07-07, but nothing adds one for profiles
-- created afterwards. Profiles created since then (6 real ones at the time of testing, 2026-07-16 .. 2026-10-10) have no
-- membership: their owner's inserts into vault_items / galleries fail with "new row violates row-level security policy",
-- and their own cloud copy cannot be read back.
--
-- This does two things, both additive (nothing is deleted or changed, no policy is loosened):
--   1) every new profile gets its owner row automatically;
--   2) profiles that already lack one get it now (owner = the profile's own user_id).
-- Safe to run more than once.

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

insert into public.profile_members (profile_id, user_id, role)
  select p.id, p.user_id, 'owner'
  from public.profiles p
  where p.user_id is not null
    and not exists (select 1 from public.profile_members m where m.profile_id = p.id)
on conflict (profile_id, user_id) do nothing;
