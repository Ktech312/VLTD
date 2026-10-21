-- PROPOSED (not yet wired into the site): insurance exclusions that follow the account (audit GIN-095).
-- Today "not part of the insurance documents" is kept in the browser only, so a second device prints a packet that still includes the item.
-- This adds one small table: one row = "this item is left out of this profile's insurance documents". Only members of the profile can read or
-- change its rows (the same membership rule that protects the profile's items); nobody else, and no signed-out visitor, sees anything.
-- Nothing existing is changed. Safe to run again. After it runs, the site is switched over in a separate, reviewed code change (it will copy a
-- person's existing on-device exclusions into the account the first time, never removing anything).
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
