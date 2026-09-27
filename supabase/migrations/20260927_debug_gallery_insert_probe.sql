-- Deepest diagnostic in this chain. Direct RPC calls to is_profile_member()
-- and is_profile_manager() both return TRUE for the affected account, yet a
-- real INSERT/DELETE on galleries under the identical session still gets
-- rejected by RLS. That's only explainable by something about the exact
-- moment the policy is evaluated inside a real DML statement, which a
-- separate RPC call to the same function can't reproduce. This function
-- attempts a REAL insert on galleries as the calling user (security
-- invoker, not definer, so RLS applies exactly as it would for the app),
-- and if that succeeds, immediately deletes the very row it just inserted
-- (a real, self-contained test of the delete policy too, with nothing left
-- behind either way — insert+delete cancel out). If insert fails there is
-- nothing to clean up. If insert somehow succeeds but the delete fails, a
-- disposable row titled 'RLS PROBE — DELETE ME IF FOUND' would be left
-- behind, so sweep for that title after running this.
--
-- Granted to `authenticated` (not just service_role) because it must run
-- AS the real signed-in user to reproduce the bug — auth.uid() is null
-- under service_role. It leaks nothing beyond booleans/uuids/error text for
-- the calling user's own session.
--
-- Safe to drop afterward with:
--   drop function if exists public.debug_gallery_insert_probe();

create or replace function public.debug_gallery_insert_probe()
returns table(
  current_auth_uid uuid,
  member_check boolean,
  manager_check boolean,
  insert_ok boolean,
  insert_error text,
  delete_ok boolean,
  delete_error text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile uuid := '3cbff34b-7029-4b66-b330-a229dd8c2bed';
  v_test_id uuid := gen_random_uuid();
  v_insert_ok boolean := false;
  v_insert_error text := null;
  v_delete_ok boolean := false;
  v_delete_error text := null;
  v_rows integer;
begin
  begin
    insert into public.galleries (id, profile_id, title, visibility, state)
    values (v_test_id, v_profile, 'RLS PROBE — DELETE ME IF FOUND', 'LOCKED', 'ACTIVE');
    v_insert_ok := true;
  exception when others then
    v_insert_error := sqlstate || ': ' || sqlerrm;
  end;

  if v_insert_ok then
    begin
      delete from public.galleries where id = v_test_id;
      get diagnostics v_rows = row_count;
      v_delete_ok := (v_rows > 0);
    exception when others then
      v_delete_error := sqlstate || ': ' || sqlerrm;
    end;
  end if;

  return query select
    auth.uid(),
    public.is_profile_member(v_profile),
    public.is_profile_manager(v_profile),
    v_insert_ok,
    v_insert_error,
    v_delete_ok,
    v_delete_error;
end;
$$;

revoke execute on function public.debug_gallery_insert_probe() from public;
revoke execute on function public.debug_gallery_insert_probe() from anon;
grant execute on function public.debug_gallery_insert_probe() to authenticated;
