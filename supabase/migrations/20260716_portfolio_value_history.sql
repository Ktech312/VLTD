-- Portfolio value history — durable, per-profile daily snapshots of collection
-- value, so the "Value Over Time" chart survives device changes and is real
-- (previously localStorage-only, per-device).
--
-- Assumes profiles.id is uuid (same as the follows / appreciations migrations).
-- Mirrors the established profile-ownership RLS convention.

create table if not exists public.portfolio_value_history (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  day         date not null,
  total_value numeric not null default 0,
  total_cost  numeric not null default 0,
  by_universe jsonb   not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (profile_id, day)
);

create index if not exists pvh_profile_day_idx
  on public.portfolio_value_history(profile_id, day);

alter table public.portfolio_value_history enable row level security;

-- A profile's value history is private financial data — owner-only.
create policy "Owners read their value history"
  on public.portfolio_value_history for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "Owners insert their value history"
  on public.portfolio_value_history for insert
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "Owners update their value history"
  on public.portfolio_value_history for update
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
