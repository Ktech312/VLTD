-- Undo file 7: back to the read rule from supabase/migrations/20260823_collector_events_auto_expire.sql (hidden as soon as ends_at has passed).
begin;
drop policy if exists "Anyone can read enabled upcoming events" on public.collector_events;
create policy "Anyone can read enabled upcoming events"
  on public.collector_events for select
  using (enabled = true and ends_at >= now());
commit;
notify pgrst, 'reload schema';
