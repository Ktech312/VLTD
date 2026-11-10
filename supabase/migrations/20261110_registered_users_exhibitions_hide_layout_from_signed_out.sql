-- "Registered Users" exhibitions: a signed-out caller of the share/invite link lookups must not receive the exhibition's item list.
--
-- FOUND 2026-11-09 (local check of what a visitor RECEIVES, not what the page shows): for an exhibition set to Registered Users (guestViewMode = 'guest', kept inside layout /
-- exhibition_layout) the page asks a signed-out visitor to sign in and shows no items, but get_gallery_by_share_token / get_gallery_by_invite_token still return the whole row to that
-- signed-out caller, including layout.publicItemSnapshots (item titles, photos, grades). Anyone holding the link could read them by calling the function directly.
--
-- WHAT THIS CHANGES (link lookups only, via the shared helper gallery_public_row): when the caller is NOT signed in (auth.uid() is null), the exhibition is Registered Users, and the
-- caller is not a member, layout and exhibition_layout are replaced by just {"guestViewMode":"guest"} (so the page still shows its sign-in gate) and item_notes is blanked. Signed-in
-- visitors, members/owners, and every other access mode receive exactly what they receive today. The signed-out caller also gets no gallery_items for such an exhibition.
-- No table, policy, grant or data changes. Safe to run more than once. NOT run by anyone yet.
--
-- DECISION FOR THE OWNER: this treats "Registered Users" as a real gate. If you want it to stay only a page-level nudge, do not run this.
-- AFTER RUNNING: run supabase/validation/20261110_registered_users_link_lookup_checks.sql (read-only) and send the result.
-- UNDO: supabase/rollback/20261110_registered_users_link_lookup_rollback.sql
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
           || case
                when auth.uid() is null
                 and coalesce(g.layout->>'guestViewMode', g.exhibition_layout->>'guestViewMode', '') = 'guest'
                then jsonb_build_object(
                       'layout', jsonb_build_object('guestViewMode', 'guest'),
                       'exhibition_layout', jsonb_build_object('guestViewMode', 'guest'),
                       'item_notes', null)
                else '{}'::jsonb
              end
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
      or (
        g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE'
        and not (auth.uid() is null and coalesce(g.layout->>'guestViewMode', g.exhibition_layout->>'guestViewMode', '') = 'guest')
      )
    )
  order by gi.position asc;
$$;

grant execute on function public.get_gallery_items_by_share_token(text) to anon, authenticated;

commit;
