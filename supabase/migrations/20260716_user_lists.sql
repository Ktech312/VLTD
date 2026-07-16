-- User lists that were previously localStorage-only (per-device): collection
-- goals, wishlist, and watchlist. Now durable + per-profile, so they survive
-- device changes. Owner-only RLS, mirroring the follows/value-history convention.
-- profiles.id is uuid.

-- ── Collection goals ────────────────────────────────────────────────
create table if not exists public.collection_goals (
  id           text primary key,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  target_count integer not null default 1,
  universe     text,
  subject      text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists collection_goals_profile_idx
  on public.collection_goals(profile_id);
alter table public.collection_goals enable row level security;
create policy "Owners manage their goals - select"
  on public.collection_goals for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage their goals - insert"
  on public.collection_goals for insert
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage their goals - update"
  on public.collection_goals for update
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage their goals - delete"
  on public.collection_goals for delete
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

-- ── Wishlist ────────────────────────────────────────────────────────
create table if not exists public.wishlist (
  id           text primary key,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  target_price numeric,
  notes        text,
  universe     text,
  category     text,
  subject      text,
  condition    text,
  priority     text,
  created_at   timestamptz not null default now()
);
create index if not exists wishlist_profile_idx on public.wishlist(profile_id);
alter table public.wishlist enable row level security;
create policy "Owners manage their wishlist - select"
  on public.wishlist for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage their wishlist - insert"
  on public.wishlist for insert
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage their wishlist - update"
  on public.wishlist for update
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage their wishlist - delete"
  on public.wishlist for delete
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

-- ── Watchlist (items saved from other collectors) ───────────────────
create table if not exists public.watchlist (
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id          text not null,
  title            text not null,
  subtitle         text,
  grade            text,
  current_value    numeric,
  image_front_url  text,
  item_profile_id  text,
  collector_name   text,
  saved_at         timestamptz not null default now(),
  primary key (owner_profile_id, item_id)
);
create index if not exists watchlist_owner_idx on public.watchlist(owner_profile_id);
alter table public.watchlist enable row level security;
create policy "Owners manage their watchlist - select"
  on public.watchlist for select
  using (owner_profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage their watchlist - insert"
  on public.watchlist for insert
  with check (owner_profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage their watchlist - delete"
  on public.watchlist for delete
  using (owner_profile_id in (select id from public.profiles where user_id = auth.uid()));
