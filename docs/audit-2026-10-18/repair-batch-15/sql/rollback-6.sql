-- Undo file 6: removes the table and the exclusions saved in it (the browser copies are untouched).
begin;
drop table if exists public.insurance_exclusions;
commit;
notify pgrst, 'reload schema';
