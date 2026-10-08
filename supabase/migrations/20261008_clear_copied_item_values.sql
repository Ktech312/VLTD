-- Clears item values that were never real.
-- For EK's two profiles only: any item whose "current value" is exactly what was paid, and that has
-- no market data of any kind (no median, estimate, last sale, comparable sales, price sources or
-- value source), got that value copied from the purchase price. Those become blank ("Not valued").
--
-- SAFE: every changed row is first saved in public.vault_value_backup_20261008 (id, old value).
-- Run the whole file once. Running it again changes nothing more.
-- To undo: see the RESTORE note at the bottom.

create table if not exists public.vault_value_backup_20261008 (
  id text primary key,
  profile_id text,
  purchase_price numeric,
  old_current_value numeric,
  saved_at timestamptz not null default now()
);
alter table public.vault_value_backup_20261008 enable row level security;

insert into public.vault_value_backup_20261008 (id, profile_id, purchase_price, old_current_value)
select vi.id::text, vi.profile_id::text, vi.purchase_price, vi.current_value
from public.vault_items vi
where vi.profile_id::text in ('877924bf-6156-4d2a-86e6-c91e086eba81', '3cbff34b-7029-4b66-b330-a229dd8c2bed')
  and vi.current_value is not null
  and vi.current_value = vi.purchase_price
  and vi.value_median is null
  and vi.estimated_value is null
  and vi.last_comp_value is null
  and vi.value_source is null
  and (vi.comparables is null or vi.comparables::text in ('[]', 'null'))
  and (vi.price_sources is null or vi.price_sources::text in ('[]', 'null'))
on conflict (id) do nothing;

update public.vault_items vi
set current_value = null
from public.vault_value_backup_20261008 b
where vi.id::text = b.id
  and vi.current_value is not null
  and vi.current_value = vi.purchase_price;

-- Check (this is what shows in the results panel):
select
  (select count(*) from public.vault_value_backup_20261008) as saved_in_backup,
  (select count(*) from public.vault_items
     where profile_id::text in ('877924bf-6156-4d2a-86e6-c91e086eba81', '3cbff34b-7029-4b66-b330-a229dd8c2bed')
       and current_value is null) as now_blank,
  (select count(*) from public.vault_items
     where profile_id::text in ('877924bf-6156-4d2a-86e6-c91e086eba81', '3cbff34b-7029-4b66-b330-a229dd8c2bed')
       and current_value is not null) as still_have_a_value;

-- RESTORE (only if ever needed):
--   update public.vault_items vi set current_value = b.old_current_value
--   from public.vault_value_backup_20261008 b where vi.id::text = b.id and vi.current_value is null;
