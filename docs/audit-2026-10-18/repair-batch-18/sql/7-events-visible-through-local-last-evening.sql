-- File 7: an event stays readable until it is over in EVERY time zone events are held in.
--
-- Events are stored as calendar days (starts_at = <date> 00:00:00 UTC, ends_at = <date> 23:59:59 UTC). The read rule hid an event the moment ends_at passed, which
-- is about 5 pm Pacific on its last day, so an LA event vanished during its final local evening. The site now decides, event by event in the event's own time
-- zone, when it is over (src/lib/eventDates.ts); the database only needs to stop hiding it too early. 12 hours is the widest gap between UTC and a zone events are
-- held in (Hawaii is 10), so nothing is shown more than a few hours late, and the pages drop it at its own local midnight.
--
-- Changes the read rule only. No event row is touched. Safe to run again. Undo with rollback-7.sql.
begin;

drop policy if exists "Anyone can read enabled upcoming events" on public.collector_events;

create policy "Anyone can read enabled upcoming events"
  on public.collector_events for select
  using (enabled = true and ends_at >= now() - interval '12 hours');

commit;
notify pgrst, 'reload schema';
