-- Followers - a collector following another collector's public profile.
--
-- BEFORE RUNNING: same caveat as the appreciations migration - this assumes
-- profiles.id is uuid (confirmed already via your earlier query). No other
-- column type assumptions needed here since both sides reference profiles.

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index if not exists follows_follower_id_idx on public.follows(follower_id);
create index if not exists follows_followed_id_idx on public.follows(followed_id);

alter table public.follows enable row level security;

-- Follower/following relationships are public social info (same as appreciations).
create policy "Follows are publicly readable"
  on public.follows for select
  using (true);

-- A user can only follow as one of their own profiles.
create policy "Users can follow as their own profile"
  on public.follows for insert
  with check (
    follower_id in (select id from public.profiles where user_id = auth.uid())
  );

-- A user can only unfollow as one of their own profiles.
create policy "Users can unfollow as their own profile"
  on public.follows for delete
  using (
    follower_id in (select id from public.profiles where user_id = auth.uid())
  );
