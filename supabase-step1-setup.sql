-- Supabase step 1 setup for VLTD
-- Run this in the Supabase SQL editor.

create table if not exists public.vault_items (
  id text primary key,
  profile_id text null,
  title text not null,
  subtitle text null,
  number text null,
  grade text null,
  purchase_price numeric null,
  purchase_tax numeric null,
  purchase_shipping numeric null,
  purchase_fees numeric null,
  current_value numeric null,
  notes text null,
  image_front_url text null,
  image_front_storage_path text null,
  universe text null,
  category text null,
  custom_category_label text null,
  category_label text null,
  subcategory_label text null,
  purchase_source text null,
  purchase_location text null,
  order_number text null,
  storage_location text null,
  cert_number text null,
  serial_number text null,
  value_source text null,
  value_updated_at bigint null,
  value_confidence numeric null,
  status text null default 'COLLECTION',
  sold_price numeric null,
  sold_at bigint null,
  created_at bigint not null,
  is_new boolean not null default true
);

alter table public.vault_items
  add column if not exists status text null default 'COLLECTION';

alter table public.vault_items
  add column if not exists sold_price numeric null;

alter table public.vault_items
  add column if not exists sold_at bigint null;

alter table public.vault_items enable row level security;

drop policy if exists "anon can read vault_items" on public.vault_items;
create policy "anon can read vault_items"
on public.vault_items
for select
to anon
using (true);

drop policy if exists "anon can write vault_items" on public.vault_items;
create policy "anon can write vault_items"
on public.vault_items
for insert
to anon
with check (true);

drop policy if exists "anon can update vault_items" on public.vault_items;
create policy "anon can update vault_items"
on public.vault_items
for update
to anon
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('vault-images', 'vault-images', true)
on conflict (id) do nothing;

drop policy if exists "anon can read vault-images" on storage.objects;
create policy "anon can read vault-images"
on storage.objects
for select
to anon
using (bucket_id = 'vault-images');

drop policy if exists "anon can upload vault-images" on storage.objects;
create policy "anon can upload vault-images"
on storage.objects
for insert
to anon
with check (bucket_id = 'vault-images');

drop policy if exists "anon can update vault-images" on storage.objects;
create policy "anon can update vault-images"
on storage.objects
for update
to anon
using (bucket_id = 'vault-images')
with check (bucket_id = 'vault-images');

drop policy if exists "anon can delete vault-images" on storage.objects;
create policy "anon can delete vault-images"
on storage.objects
for delete
to anon
using (bucket_id = 'vault-images');
