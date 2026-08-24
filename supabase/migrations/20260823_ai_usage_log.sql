-- ─────────────────────────────────────────────────────────────
-- Per-call AI usage log -- EK: "I'll need that data in the future...
-- add that to the Users log in and time spent... long term analytics."
--
-- Time-spent tracking already exists (profiles.last_seen_at /
-- session_started_at / total_seconds_online / session_count, see
-- 20260711_presence.sql + 20260818_presence_totals.sql) -- this adds the
-- missing piece: which real token/credit usage came from which user.
--
-- Admin-only observability data. No RLS policies at all (not even a
-- read policy) -- every access goes through the service-role client from
-- an admin-gated API route (getAdminEmail), same as the other admin
-- tables in this app. Nothing here is meant to be queried by app code
-- directly.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.ai_usage_log (
  id             bigint      generated always as identity primary key,
  profile_id     uuid        references public.profiles(id) on delete set null,
  feature        text        not null,
  input_tokens   integer,
  output_tokens  integer,
  created_at     timestamptz not null default now()
);

create index if not exists ai_usage_log_profile_idx  on public.ai_usage_log (profile_id);
create index if not exists ai_usage_log_created_idx  on public.ai_usage_log (created_at desc);

alter table public.ai_usage_log enable row level security;
