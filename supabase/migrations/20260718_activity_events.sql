-- Activity events: a durable log of things that happened in a vault, so the
-- Activity page can show true before/after history (especially value changes,
-- which cannot be reconstructed from an item's current fields).
-- Columns match src/lib/activityEvents.ts exactly. profiles.id is uuid.

create table if not exists public.activity_events (
  id             text primary key,
  profile_id     uuid references public.profiles(id) on delete cascade,
  kind           text not null,
  title          text not null,
  subtitle       text,
  detail         text,
  href           text,
  action_label   text,
  item_id        text,
  gallery_id     text,
  image_url      text,
  previous_value numeric,
  new_value      numeric,
  source         text,
  confidence     text,
  comps          integer,
  meta           text,
  created_at     timestamptz not null default now()
);

create index if not exists activity_events_profile_idx
  on public.activity_events(profile_id, created_at desc);

alter table public.activity_events enable row level security;

create policy "Owners read their activity"
  on public.activity_events for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "Owners insert their activity"
  on public.activity_events for insert
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "Owners update their activity"
  on public.activity_events for update
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "Owners delete their activity"
  on public.activity_events for delete
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));
