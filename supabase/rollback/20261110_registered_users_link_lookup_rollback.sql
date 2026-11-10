-- Rollback for 20261110_registered_users_exhibitions_hide_layout_from_signed_out.sql: restores gallery_public_row and get_gallery_items_by_share_token exactly as
-- supabase/migrations/20261018_gallery_links_respect_private.sql defined them. Safe to run more than once. Changes no data.
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

create or replace function public.get_gallery_items_by_share_token(p_token text)
returns setof public.gallery_items
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select gi.*
  from public.gallery_items gi
  join public.galleries g on g.id = gi.gallery_id
  where g.public_token = p_token
    and (
      public.is_profile_member(g.profile_id)
      or (g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE')
    )
  order by gi.position asc;
$$;

grant execute on function public.get_gallery_items_by_share_token(text) to anon, authenticated;

commit;
