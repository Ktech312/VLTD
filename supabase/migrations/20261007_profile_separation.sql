-- Personal and Business stay separate.
-- An exhibit (gallery) can only hold items that belong to its own profile.
-- Safe to run more than once. Does not delete or change any existing rows.

create or replace function public.enforce_gallery_item_same_profile()
returns trigger
language plpgsql
as $$
declare
  gallery_profile text;
  item_profile text;
begin
  select g.profile_id::text into gallery_profile from public.galleries g where g.id::text = new.gallery_id::text;
  select vi.profile_id::text into item_profile from public.vault_items vi where vi.id::text = new.artifact_id::text;

  if gallery_profile is not null and item_profile is not null and gallery_profile <> item_profile then
    raise exception 'An exhibit can only hold items from its own profile.';
  end if;
  return new;
end;
$$;

drop trigger if exists gallery_items_same_profile on public.gallery_items;
create trigger gallery_items_same_profile
  before insert or update on public.gallery_items
  for each row execute function public.enforce_gallery_item_same_profile();
