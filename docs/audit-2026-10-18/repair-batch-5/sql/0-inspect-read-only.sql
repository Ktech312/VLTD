-- RC-05, step 0 (READ ONLY): shows the policies and grants this package depends on. Changes nothing.
-- Run it first and keep the output: the other files assume the policy names listed in the proposal.

-- policies on the tables involved
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('galleries', 'exhibition_events')
order by tablename, policyname;

-- who may read which columns of galleries (column-level grants)
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'galleries' and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
order by grantee, column_name;

-- the helpers the policies will use must exist
select proname, prosecdef from pg_proc where pronamespace = 'public'::regnamespace and proname in ('is_profile_member', 'profile_is_hidden');

-- is the public view already there?
select table_name from information_schema.views where table_schema = 'public' and table_name = 'public_galleries';
