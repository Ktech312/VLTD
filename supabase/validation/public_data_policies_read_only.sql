-- READ-ONLY. Changes nothing. Lists who can read referral_codes and appreciations today (grants, then row-level policies).
-- Run in the Supabase SQL editor and send the two result tables back.

-- 1. table and column privileges given to visitors (anon) and signed-in users (authenticated)
select table_name, grantee, privilege_type, 'table' as level
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('referral_codes', 'appreciations') and grantee in ('anon', 'authenticated')
union all
select table_name, grantee, privilege_type || ' (' || column_name || ')', 'column'
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('referral_codes', 'appreciations') and grantee in ('anon', 'authenticated')
  and not exists (
    select 1 from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = column_privileges.table_name
      and g.grantee = column_privileges.grantee and g.privilege_type = column_privileges.privilege_type)
order by 1, 2, 3;

-- 2. row-level security policies on the two tables
select tablename, policyname, cmd, roles, qual as using_expression, with_check
from pg_policies
where schemaname = 'public' and tablename in ('referral_codes', 'appreciations')
order by tablename, cmd, policyname;
