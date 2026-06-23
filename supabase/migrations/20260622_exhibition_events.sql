-- Exhibition publish and announcement events.
-- gallery_id is text to match galleries.id (confirmed text type in codebase).
-- profile_id is uuid to match profiles.id (confirmed uuid via auth.uid()).

create table if not exists public.exhibition_events (
  id           uuid         primary key default gen_random_uuid(),
  gallery_id   text         not null,
  profile_id   uuid         not null references public.profiles(id) on delete cascade,
  type         text         not null check (type in ('published', 'announced')),
  metadata     jsonb        not null default '{}'::jsonb,
  created_at   timestamptz  not null default now()
);

create index if not exists idx_exhibition_events_gallery  on public.exhibition_events (gallery_id);
create index if not exists idx_exhibition_events_profile  on public.exhibition_events (profile_id);
create index if not exists idx_exhibition_events_created  on public.exhibition_events (created_at desc);

alter table public.exhibition_events enable row level security;

-- Anyone can read events (needed for follower feeds later).
create policy "Public read exhibition_events"
  on public.exhibition_events for select
  using (true);

-- Only the event's own profile can insert.
create policy "Owner insert exhibition_events"
  on public.exhibition_events for insert
  with check (auth.uid() = profile_id);
