-- Read-only diagnostic. Adds one function that returns the actual foreign-key
-- definitions on gallery_items and gallery_invites (table names, columns, and
-- their ON DELETE behavior), read directly from Postgres's own catalog
-- (pg_constraint). No table, row, policy, or trigger is touched or altered.
--
-- Needed because neither PostgREST nor the pg_graphql endpoint expose
-- information_schema/pg_catalog directly (confirmed by querying both and
-- getting "Only the following schemas are exposed: public, graphql_public" /
-- "pg_graphql extension is not enabled") — this is the only way to read the
-- literal catalog definition without a database password or a Supabase
-- management API token, neither of which this app has on file.
--
-- Safe to drop afterward with: drop function if exists public.debug_gallery_fk_definitions();

create or replace function public.debug_gallery_fk_definitions()
returns table(table_name text, constraint_name text, definition text)
language sql
security definer
set search_path = public
as $$
  select
    conrelid::regclass::text as table_name,
    conname::text as constraint_name,
    pg_get_constraintdef(oid) as definition
  from pg_constraint
  where conrelid in ('public.gallery_items'::regclass, 'public.gallery_invites'::regclass)
    and contype = 'f';
$$;

grant execute on function public.debug_gallery_fk_definitions() to service_role;
