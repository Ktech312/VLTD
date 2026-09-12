-- VLTD Museum public campus — admin-curated real items for a category room,
-- starting with SPORTS (the first "proof room" for the new placement
-- standard, 2026-09-11). Generic `room_id` column so the same table covers
-- every other room later without another migration — only SPORTS is wired
-- up in the app for now. Same shape/RLS pattern as
-- 20260902_museum_campus_config.sql's museum_spotlight_programs/
-- museum_store_items tables.

create table if not exists public.museum_room_items (
  id           uuid        primary key default gen_random_uuid(),
  room_id      text        not null,
  title        text        not null,
  image_url    text        not null,
  enabled      boolean     not null default true,
  sort_order   int         not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists museum_room_items_room_id_idx on public.museum_room_items (room_id);

alter table public.museum_room_items enable row level security;

create policy "Public can read enabled museum room items"
  on public.museum_room_items for select using (true);
create policy "Admin full access museum room items"
  on public.museum_room_items for all
  using (exists (select 1 from public.user_roles where email = auth.email()))
  with check (exists (select 1 from public.user_roles where email = auth.email()));

grant select on public.museum_room_items to anon, authenticated;
grant all on public.museum_room_items to authenticated;
