alter table public_profiles
  add column if not exists avatar_url text default '';