-- Follow-up to 20260927_debug_gallery_insert_probe.sql. That probe showed a
-- bare SQL INSERT succeeds (insert_ok: true) — so the app-level INSERT
-- failures are a PostgREST-layer symptom, not the RLS policy itself (very
-- likely: POST used Prefer: return=representation, which needs to read the
-- new row back afterward, and there is no SELECT policy letting an owner
-- read their own non-PUBLIC gallery — only "Public galleries are readable"
-- exists, which requires visibility='PUBLIC'; every failing test used a
-- non-PUBLIC visibility). But the SAME probe's bare SQL DELETE still
-- affected zero rows, with manager_check = true computed in the very same
-- query. This isolates why: it re-checks is_profile_manager() computed
-- FROM THE ACTUAL STORED ROW (not a hardcoded variable) immediately before
-- deleting it, to rule out a value/type mismatch between the two.
--
-- Same insert-then-delete-cancels-out cleanup as before. Nothing left
-- behind unless insert succeeds but delete fails, in which case sweep for
-- the title 'RLS PROBE — DELETE ME IF FOUND'.
--
-- Safe to drop afterward with:
--   drop function if exists public.debug_gallery_delete_probe_v2();

create or replace function public.debug_gallery_delete_probe_v2()
returns table(
  stored_profile_id uuid,
  check_from_row boolean,
  check_from_variable boolean,
  visibility_before_delete text,
  delete_rows_affected integer,
  delete_error text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile uuid := '3cbff34b-7029-4b66-b330-a229dd8c2bed';
  v_test_id uuid := gen_random_uuid();
  v_stored_profile_id uuid;
  v_visibility text;
  v_check_from_row boolean;
  v_rows integer := 0;
  v_delete_error text := null;
begin
  insert into public.galleries (id, profile_id, title, visibility, state)
  values (v_test_id, v_profile, 'RLS PROBE — DELETE ME IF FOUND', 'LOCKED', 'ACTIVE');

  select profile_id, visibility, is_profile_manager(profile_id)
  into v_stored_profile_id, v_visibility, v_check_from_row
  from public.galleries where id = v_test_id;

  begin
    delete from public.galleries where id = v_test_id;
    get diagnostics v_rows = row_count;
  exception when others then
    v_delete_error := sqlstate || ': ' || sqlerrm;
  end;

  return query select
    v_stored_profile_id,
    v_check_from_row,
    public.is_profile_manager(v_profile),
    v_visibility,
    v_rows,
    v_delete_error;
end;
$$;

revoke execute on function public.debug_gallery_delete_probe_v2() from public;
revoke execute on function public.debug_gallery_delete_probe_v2() from anon;
grant execute on function public.debug_gallery_delete_probe_v2() to authenticated;
