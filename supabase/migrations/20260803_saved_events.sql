-- Saved events (curated collector_events a user bookmarked) were localStorage-only
-- (per-device, key vltd_saved_event_ids_v1). Now durable + per-profile, so saves
-- survive a device switch. Owner-only RLS, mirroring the wishlist/watchlist
-- convention in 20260716_user_lists.sql.

create table if not exists public.saved_events (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_id   uuid not null references public.collector_events(id) on delete cascade,
  saved_at   timestamptz not null default now(),
  primary key (profile_id, event_id)
);
create index if not exists saved_events_profile_idx on public.saved_events(profile_id);
alter table public.saved_events enable row level security;

drop policy if exists "Owners manage their saved events - select" on public.saved_events;
create policy "Owners manage their saved events - select"
  on public.saved_events for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

drop policy if exists "Owners manage their saved events - insert" on public.saved_events;
create policy "Owners manage their saved events - insert"
  on public.saved_events for insert
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

drop policy if exists "Owners manage their saved events - delete" on public.saved_events;
create policy "Owners manage their saved events - delete"
  on public.saved_events for delete
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));
