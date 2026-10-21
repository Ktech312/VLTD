-- Insurance exclusions that follow the account (audit GIN-095). Run the whole file once in the Supabase SQL editor. Safe to run again.
-- Until now "leave this item out of the insurance documents" was kept in the browser only, so a second device printed a packet that still included the item.
-- This adds one small table: one row = "this item is left out of this profile's insurance documents". Only members of the profile can read, add or remove its
-- rows (the same membership rule that protects the profile's items); nobody else, and no signed-out visitor, sees anything. Rows cannot be edited.
-- Nothing existing is changed. The site is already switched over and works before and after this file: until it runs, exclusions stay on the device and every
-- Insurance page says so; after it runs, the first visit to Insurance copies each profile's on-device exclusions up (never removing anything) and the pages
-- stop saying "this device only".
begin;

create table if not exists public.insurance_exclusions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id    text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, item_id)
);

alter table public.insurance_exclusions enable row level security;

drop policy if exists "insurance_exclusions_select_member" on public.insurance_exclusions;
create policy "insurance_exclusions_select_member" on public.insurance_exclusions
  for select to authenticated using (public.is_profile_member(profile_id));

drop policy if exists "insurance_exclusions_insert_member" on public.insurance_exclusions;
create policy "insurance_exclusions_insert_member" on public.insurance_exclusions
  for insert to authenticated with check (public.is_profile_member(profile_id));

drop policy if exists "insurance_exclusions_delete_member" on public.insurance_exclusions;
create policy "insurance_exclusions_delete_member" on public.insurance_exclusions
  for delete to authenticated using (public.is_profile_member(profile_id));

-- Supabase grants new tables to anon/authenticated by default: take everything away first, then give back only what is needed.
revoke all on public.insurance_exclusions from public, anon, authenticated;
grant select, insert, delete on public.insurance_exclusions to authenticated;

commit;

notify pgrst, 'reload schema';
