-- ─────────────────────────────────────────────────────────────
-- collector_events currently only disappears from the site if
-- someone remembers to flip enabled=false by hand -- nobody did,
-- so all 4 seeded events (NAMM Jan, SD Card Show Jun, SDCC Jul,
-- The National Aug) kept showing as "upcoming" long after ending.
--
-- Fold the expiry into the read policy itself: an event is only
-- visible once, from now on, if it's both enabled AND not yet over.
-- No manual toggling, no cron job -- it self-cleans on every read.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

drop policy if exists "Anyone can read enabled events" on public.collector_events;

create policy "Anyone can read enabled upcoming events"
  on public.collector_events for select
  using (enabled = true and ends_at >= now());
