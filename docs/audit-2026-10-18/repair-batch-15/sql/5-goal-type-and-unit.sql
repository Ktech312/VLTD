-- Goals get an explicit type and unit (batch 15, replaces the old "work it out from the goal's name" behaviour).
--   goal_type: 'count' (the target is a number of items) or 'value' (the target is money)
--   unit:      'items' or 'usd' (always matches goal_type)
-- Existing goals are NOT changed and NOT guessed: both columns stay empty for them, and the Goals page shows those goals as "needs setup" until the
-- person chooses. Row-level security is untouched (the existing owner-only rules cover the new columns). Safe to run again.
-- The site works before and after this file: until it runs, a goal's type is kept on the device it was chosen on and the page says so.
begin;

alter table public.collection_goals add column if not exists goal_type text;
alter table public.collection_goals add column if not exists unit text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'collection_goals_type_unit_ok' and conrelid = 'public.collection_goals'::regclass) then
    alter table public.collection_goals add constraint collection_goals_type_unit_ok check (
      (goal_type is null and unit is null)
      or (goal_type is not null and unit is not null
          and ((goal_type = 'count' and unit = 'items') or (goal_type = 'value' and unit = 'usd')))
    );
  end if;
end;
$$;

commit;

-- let the API see the new columns now
notify pgrst, 'reload schema';
