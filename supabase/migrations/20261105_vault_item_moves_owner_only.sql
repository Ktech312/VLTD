-- Moving an item to another profile is the OWNER's decision, on BOTH sides.
--
-- Found on 2026-11-05 by testing with each account's own login: a team member (role "member") could call the database directly and
--   (a) move a BUSINESS item into their own personal profile, which takes it out of the business exactly like a delete would, and
--   (b) move their own personal item into the business.
-- The app never offers either to a team member (the move buttons are hidden for them) and the Team page says members cannot delete items, but the
-- update rule on vault_items only asks "is the person a member of the old profile and of the new one", so the database allowed both.
--
-- This adds one trigger. Nothing else changes:
--   - editing an item (title, price, photos...) is unaffected: the trigger only fires when profile_id changes;
--   - an owner moving an item between their OWN personal and business profiles still works (the app's "Move selected items" buttons);
--   - the existing rules still refuse moving an item into someone else's profile or out of one you are not a member of;
--   - maintenance calls made with the service role (no signed-in person) are not affected.
--
-- Safe to run more than once. Read-only checks to run afterwards: supabase/verification/20261105_vault_item_moves_owner_only_checks.sql

create or replace function public.is_profile_owner_text(p_profile text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile ~ '^[0-9a-fA-F-]{36}$'
     and exists (
       select 1 from public.profile_members m
       where m.profile_id = p_profile::uuid and m.user_id = auth.uid() and m.role = 'owner'
     );
$$;
revoke execute on function public.is_profile_owner_text(text) from public, anon;
grant execute on function public.is_profile_owner_text(text) to authenticated;

create or replace function public.guard_vault_item_profile_change()
returns trigger language plpgsql set search_path = public as $$
begin
  -- No signed-in person (service role / maintenance): not this rule's business.
  if auth.uid() is null then
    return new;
  end if;
  -- Only the owner of the profile the item is leaving AND the owner of the profile it is going to may move it.
  if public.is_profile_owner_text(old.profile_id) and public.is_profile_owner_text(new.profile_id) then
    return new;
  end if;
  raise exception 'Only the owner of both profiles can move an item between them.' using errcode = '42501';
end;
$$;

drop trigger if exists trg_guard_vault_item_profile_change on public.vault_items;
create trigger trg_guard_vault_item_profile_change
  before update of profile_id on public.vault_items
  for each row
  when (old.profile_id is distinct from new.profile_id)
  execute function public.guard_vault_item_profile_change();
