-- Lets the app download only the items that changed, instead of the whole vault every time.
-- (The whole-vault download is what used up Supabase's free data allowance.)
-- Safe to run more than once. Until this is run, the app keeps working exactly as it does today.

alter table public.vault_items
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_vault_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vault_items_touch_updated_at on public.vault_items;
create trigger vault_items_touch_updated_at
  before update on public.vault_items
  for each row execute function public.touch_vault_items_updated_at();

create index if not exists vault_items_profile_updated_idx
  on public.vault_items (profile_id, updated_at);
