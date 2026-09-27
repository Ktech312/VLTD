-- Read-only diagnostic, same pattern as 20260926_debug_gallery_fk_definitions.sql
-- (created, used once, then dropped in a follow-up migration). Needed because
-- a live test showed a brand-new INSERT into galleries being rejected by RLS
-- even though the current session passes every check the migration files
-- imply should apply (auth.uid() matches the profile's user_id, the same
-- session can read its own profile row and UPDATE its own existing
-- galleries fine) — suggesting the live policy set doesn't match what the
-- migration files in this repo say should be active. This lists the actual
-- policies Postgres is enforcing on public.galleries right now, read from
-- pg_policies. No table, row, or policy is touched or altered.
--
-- Safe to drop afterward with: drop function if exists public.debug_galleries_policies();

create or replace function public.debug_galleries_policies()
returns table(
  policy_name text,
  command text,
  roles text,
  permissive text,
  using_expr text,
  check_expr text
)
language sql
security definer
set search_path = public
as $$
  select
    polname::text,
    case polcmd
      when 'r' then 'SELECT'
      when 'a' then 'INSERT'
      when 'w' then 'UPDATE'
      when 'd' then 'DELETE'
      when '*' then 'ALL'
      else polcmd::text
    end,
    (select string_agg(rolname, ',') from pg_roles where oid = any(polroles)),
    case when polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end,
    pg_get_expr(polqual, polrelid),
    pg_get_expr(polwithcheck, polrelid)
  from pg_policy
  where polrelid = 'public.galleries'::regclass;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on function creation, which
-- anon/authenticated inherit from — without this, the function would be
-- callable (and its policy internals readable) by any signed-in user via
-- PostgREST, not just service_role.
revoke execute on function public.debug_galleries_policies() from public;
revoke execute on function public.debug_galleries_policies() from anon;
revoke execute on function public.debug_galleries_policies() from authenticated;
grant execute on function public.debug_galleries_policies() to service_role;
