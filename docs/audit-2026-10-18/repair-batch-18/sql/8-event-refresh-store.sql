-- WITHDRAWN 2026-10-24: superseded, not requested, do NOT run. Kept only as a record. The Events refresh jobs are switched off and nothing needs these tables.
-- File 8: a memory for the scheduled event refreshes, so a retry does not pay twice for work that already succeeded.
--
-- On 2026-10-23 and 24 the refresh's searches succeeded and found 42 events, but the AI check was refused (no Anthropic credit), and the 42 were lost with the run,
-- so every retry would have paid for the same searches again. With these two tables the jobs keep what they found and which paid steps already succeeded today:
--   event_refresh_candidates: each event found, with the AI's verdict (pending / approved / rejected) and when it was saved;
--   event_refresh_steps:      each paid step that already succeeded today (a search; for the weekly job, a show's search results and the AI's answer for that show).
-- A later run does not repeat a search that succeeded the same day, asks the AI only about events not yet judged, and saves events already approved but not saved.
--
-- Only the server (service role) reads or writes them: row security is on with no rules, and the public roles have no access. No existing table is touched.
-- Until this file is run the site's refresh jobs work exactly as before (they notice the tables are missing and carry on without the memory).
-- Safe to run again. Undo with rollback-8.sql (drops both tables; the events already saved are not affected).
begin;

create table if not exists public.event_refresh_candidates (
  slug            text primary key,                       -- the slug the event would be saved under
  category        text not null,
  source          text not null check (source in ('serp', 'ticketmaster')),
  row_data        jsonb not null,                         -- the event exactly as it would be saved
  description     text,
  verdict         text not null default 'pending' check (verdict in ('pending', 'approved', 'rejected')),
  first_seen_day  date not null,
  last_seen_at    timestamptz not null default now(),
  judged_at       timestamptz,
  saved_at        timestamptz
);
create index if not exists event_refresh_candidates_verdict_idx on public.event_refresh_candidates (verdict, saved_at);

create table if not exists public.event_refresh_steps (
  step_key    text primary key,                           -- e.g. search|2026-10-24|serp|convention
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.event_refresh_candidates enable row level security;
alter table public.event_refresh_steps enable row level security;
revoke all on public.event_refresh_candidates from anon, authenticated;
revoke all on public.event_refresh_steps from anon, authenticated;

commit;
notify pgrst, 'reload schema';
