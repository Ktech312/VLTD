-- Undo file 8: removes the two tables and the memory in them. The events already saved are not affected, and the refresh jobs carry on without the memory.
begin;
drop table if exists public.event_refresh_steps;
drop table if exists public.event_refresh_candidates;
commit;
notify pgrst, 'reload schema';
