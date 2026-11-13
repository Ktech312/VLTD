-- Undo for 20261112_online_status_repair_if_exposed.sql: gives back the table-wide SELECT on public.profiles to the roles that can read any of its columns now (the state before the repair).
-- A role that has no access is left with none. Safe to run twice, and harmless if the repair was never run. Note: this re-opens whatever the validation found, so privacy returns to INCOMPLETE.
do $$
declare who text;
begin
  foreach who in array array['anon', 'authenticated'] loop
    if has_any_column_privilege(who, 'public.profiles', 'select') then
      execute format('grant select on public.profiles to %I', who);
    end if;
  end loop;
end $$;
