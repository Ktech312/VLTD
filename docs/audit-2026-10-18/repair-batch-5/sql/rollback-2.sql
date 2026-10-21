-- UNDO for step 2: remove the public view and the sanitising helpers, and put the link function back as 20261018 defined it.
-- (Run rollback-4.sql first if step 4 was applied: step 4 requires the view.)
begin;

create or replace function public.gallery_public_row(g public.galleries)
returns public.galleries
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_populate_record(
    null::public.galleries,
    case
      when public.is_profile_member(g.profile_id) then to_jsonb(g)
      else (to_jsonb(g) - 'analytics_unique_view_keys')
           || case when g.alias_enabled then jsonb_build_object('profile_id', null) else '{}'::jsonb end
    end
  );
$$;
revoke all on function public.gallery_public_row(public.galleries) from public, anon, authenticated;

drop view if exists public.public_galleries;
drop function if exists public.gallery_public_layout(jsonb);
drop function if exists public.gallery_public_sections(jsonb);
drop function if exists public.gallery_public_snapshots(jsonb);
drop function if exists public.gallery_public_string_array(jsonb, boolean);
drop function if exists public.gallery_public_scalar(jsonb);

commit;
