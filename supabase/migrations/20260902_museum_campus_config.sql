-- VLTD Museum public campus — admin-controlled config (EK's ask, 2026-09-02):
-- Spotlight room programs, Store room items, and how many items show per
-- category room, all editable from /admin/museum-campus instead of being
-- hardcoded, since EK expects to add/change these over time.

create table if not exists public.museum_campus_config (
  id            uuid        primary key default gen_random_uuid(),
  items_per_room int       not null default 8,
  updated_at    timestamptz not null default now()
);

create table if not exists public.museum_spotlight_programs (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  description  text,
  is_active    boolean     not null default false,
  sort_order   int         not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.museum_store_items (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  description  text,
  image_url    text,
  price_label  text,
  link_url     text,
  enabled      boolean     not null default true,
  sort_order   int         not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.museum_campus_config enable row level security;
alter table public.museum_spotlight_programs enable row level security;
alter table public.museum_store_items enable row level security;

create policy "Public can read museum campus config"
  on public.museum_campus_config for select using (true);
create policy "Admin full access museum campus config"
  on public.museum_campus_config for all
  using (exists (select 1 from public.user_roles where email = auth.email()))
  with check (exists (select 1 from public.user_roles where email = auth.email()));

create policy "Public can read active spotlight programs"
  on public.museum_spotlight_programs for select using (true);
create policy "Admin full access spotlight programs"
  on public.museum_spotlight_programs for all
  using (exists (select 1 from public.user_roles where email = auth.email()))
  with check (exists (select 1 from public.user_roles where email = auth.email()));

create policy "Public can read enabled store items"
  on public.museum_store_items for select using (true);
create policy "Admin full access store items"
  on public.museum_store_items for all
  using (exists (select 1 from public.user_roles where email = auth.email()))
  with check (exists (select 1 from public.user_roles where email = auth.email()));

grant select on public.museum_campus_config to anon, authenticated;
grant all on public.museum_campus_config to authenticated;
grant select on public.museum_spotlight_programs to anon, authenticated;
grant all on public.museum_spotlight_programs to authenticated;
grant select on public.museum_store_items to anon, authenticated;
grant all on public.museum_store_items to authenticated;

-- Seed one config row so the app has something to read immediately.
insert into public.museum_campus_config (items_per_room)
select 8
where not exists (select 1 from public.museum_campus_config);
