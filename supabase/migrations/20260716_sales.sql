-- Unified sales ledger. Replaces three fragmented localStorage stores
-- (vltd_sales_ledger_v1 / vltd_sales_history / vltd_sale_history_v1) with one
-- durable, per-profile table. Owner-only RLS. profiles.id is uuid.

create table if not exists public.sales (
  id             text primary key,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  item_id        text,
  title          text,
  universe       text,
  category       text,
  grade          text,
  cert_number    text,
  purchase_price numeric,
  sale_price     numeric,
  profit         numeric,
  sold_at        timestamptz not null default now(),
  platform       text,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists sales_profile_soldat_idx
  on public.sales(profile_id, sold_at desc);

alter table public.sales enable row level security;

create policy "Owners manage their sales - select"
  on public.sales for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage their sales - insert"
  on public.sales for insert
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage their sales - update"
  on public.sales for update
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage their sales - delete"
  on public.sales for delete
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));
