-- Undo file 5: removes the two columns and the check. Goals keep their names and targets; only the saved type is lost (they show "needs setup" again).
begin;
alter table public.collection_goals drop constraint if exists collection_goals_type_unit_ok;
alter table public.collection_goals drop column if exists goal_type;
alter table public.collection_goals drop column if exists unit;
commit;
notify pgrst, 'reload schema';
