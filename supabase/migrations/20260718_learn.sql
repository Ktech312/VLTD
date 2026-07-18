-- Learn hub durability: saved guides (per-profile bookmarks) and newsletter
-- signups (public capture). profiles.id is uuid.

-- ── Saved articles ──────────────────────────────────────────────────
create table if not exists public.saved_articles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  slug       text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, slug)
);
create index if not exists saved_articles_profile_idx on public.saved_articles(profile_id);
alter table public.saved_articles enable row level security;
create policy "Owners manage saved articles - select"
  on public.saved_articles for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage saved articles - insert"
  on public.saved_articles for insert
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Owners manage saved articles - delete"
  on public.saved_articles for delete
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

-- ── Newsletter signups ──────────────────────────────────────────────
-- Public capture (anyone can subscribe); no one can read the list via the
-- anon key. Reads are done server-side with the service role.
create table if not exists public.newsletter_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  source     text,
  created_at timestamptz not null default now()
);
alter table public.newsletter_signups enable row level security;
create policy "Anyone can subscribe"
  on public.newsletter_signups for insert
  with check (true);
