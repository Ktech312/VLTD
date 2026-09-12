-- VLTD Museum public campus — per-room display title/description override,
-- editable from the Gallery Builder's Map (the real room editor, launched
-- from each room's edit badge) rather than a separate Admin Tools page.
-- Optional override only: a room with no row here still shows its normal
-- static ROOM_LABELS/tierLabel on the Map. Does not touch the real 3D
-- museum's own destination signs (campusLayout.ts's static room.label is
-- untouched) -- this is Map-display metadata only.

create table if not exists public.museum_room_meta (
  room_id      text        primary key,
  title        text,
  description  text,
  updated_at   timestamptz not null default now()
);

alter table public.museum_room_meta enable row level security;

create policy "Public can read museum room meta"
  on public.museum_room_meta for select using (true);
create policy "Admin full access museum room meta"
  on public.museum_room_meta for all
  using (exists (select 1 from public.user_roles where email = auth.email()))
  with check (exists (select 1 from public.user_roles where email = auth.email()));

grant select on public.museum_room_meta to anon, authenticated;
grant all on public.museum_room_meta to authenticated;
