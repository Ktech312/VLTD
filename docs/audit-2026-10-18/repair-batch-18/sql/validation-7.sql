-- One result row. Both values must read true.
select jsonb_build_object(
  'read_rule_has_12_hour_margin', exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'collector_events' and policyname = 'Anyone can read enabled upcoming events'
      and cmd = 'SELECT' and qual like '%enabled = true%' and qual like '%12:00:00%'
  ),
  'only_one_read_rule', (select count(*) from pg_policies where schemaname = 'public' and tablename = 'collector_events' and cmd = 'SELECT') = 1
) as result;
