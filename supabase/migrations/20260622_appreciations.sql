-- Appreciations ("Vibe" reactions) on vault_items.
-- One row per (item, profile) pair - toggling appreciation just inserts or
-- deletes that row, so the count is always count(*) where item_id = X.
--
-- BEFORE RUNNING: check the actual column types of vault_items.id and
-- profiles.id in Supabase Studio's Table Editor. This assumes vault_items.id
-- is text (matches the custom string IDs generated client-side, e.g.
-- "vault_172..._ab12cd") and profiles.id is uuid (Supabase's default).
-- If either differs, adjust the two `references` lines below to match
-- before running.

create table if not exists public.appreciations (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references public.vault_items(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_id, profile_id)
);

create index if not exists appreciations_item_id_idx on public.appreciations(item_id);
create index if not exists appreciations_profile_id_idx on public.appreciations(profile_id);

alter table public.appreciations enable row level security;

-- Anyone can see appreciation counts (public social signal).
create policy "Appreciations are publicly readable"
  on public.appreciations for select
  using (true);

-- A user can only appreciate as one of their own profiles.
create policy "Users can appreciate as their own profile"
  on public.appreciations for insert
  with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

-- A user can only remove their own appreciation.
create policy "Users can remove their own appreciation"
  on public.appreciations for delete
  using (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );
