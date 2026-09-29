-- Disposable read-only diagnostic, service_role only, dropped again once
-- it's served its purpose (same pattern as 20260926_debug_gallery_fk_
-- definitions.sql / 20260927_debug_galleries_policies.sql). PostgREST only
-- exposes the public schema, so this is the only way to read pg_extension/
-- pg_proc directly and find out which schema pgcrypto's functions
-- (gen_random_bytes, digest) actually landed in -- trust_this_device()
-- calling gen_random_bytes() failed live with "function ... does not
-- exist" despite 20260927c's own `create extension if not exists
-- pgcrypto;`, which only makes sense if it installed somewhere other than
-- the `public` schema that function's `set search_path = public` covers.
create or replace function public.debug_pgcrypto_location()
returns table(extname text, schema_name text, gen_random_bytes_visible_in_public boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select e.extname::text, n.nspname::text,
      (to_regprocedure('public.gen_random_bytes(integer)') is not null) as gen_random_bytes_visible_in_public
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto';
end;
$$;

revoke execute on function public.debug_pgcrypto_location() from public;
revoke execute on function public.debug_pgcrypto_location() from anon;
revoke execute on function public.debug_pgcrypto_location() from authenticated;
grant execute on function public.debug_pgcrypto_location() to service_role;
