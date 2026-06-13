create table if not exists public_profiles (
  profile_id uuid primary key,
  display_name text not null default 'Collector',
  avatar_emoji text not null default '🗝️',
  avatar_url text not null default '',
  updated_at timestamptz not null default now()
);

alter table public_profiles enable row level security;

drop policy if exists "Public profiles are readable" on public_profiles;
create policy "Public profiles are readable"
  on public_profiles for select
  using (true);

drop policy if exists "Public profiles can be synced by anon clients" on public_profiles;
create policy "Public profiles can be synced by anon clients"
  on public_profiles for all
  using (true)
  with check (true);
