-- "Registered Users" exhibitions: a SIGNED-OUT caller of the share-link and invite-link lookups must not receive the exhibition's items, photos or notes.
--
-- WHAT WAS FOUND (local check on a real in-process PostgreSQL with the repository's own 20261018 functions, 2026-11-09; NOT observed on production): the share/invite pages ask a signed-out
-- visitor to sign in for a "Registered Users" exhibition (visibility INVITE, marker guestViewMode = 'guest' kept inside layout / exhibition_layout), but the lookup functions
-- get_gallery_by_share_token / get_gallery_by_invite_token / get_gallery_items_by_share_token / get_gallery_items_by_invite_token / get_invite_item_financials do not look at that marker.
-- Anyone holding such a link who calls the function directly (without the page) therefore receives layout.publicItemSnapshots (item titles, photos, grades), item notes, the cover image,
-- the item rows, and (invite with financial history) purchase prices. Whether production holds any such exhibition and link is not known from here; the validation file counts them.
--
-- WHAT THIS CHANGES: when the caller is NOT signed in (auth.uid() is null), is not a member of the exhibition's profile, and the exhibition carries the Registered Users marker:
--   * the exhibition row comes back with layout / exhibition_layout reduced to {"guestViewMode":"guest"} (so the page still shows its sign-in gate), item_notes and cover_image blank;
--     title and description still come back (the gate shows them, as today);
--   * the two item lookups and the invite financial-history lookup return nothing.
-- Every signed-in caller, every member/owner, and every other access mode (Public, Guest View, Private, revoked/expired invites, aliases, hidden items) receive exactly what 20261018 gave them.
-- Link functions only: no table, policy, grant, column or data changes. Safe to run more than once. NOT run by anyone yet.
--
-- INDEPENDENT OF THE HELD RC-05 SQL: this does not redefine gallery_public_row. It calls whichever version is installed (20261018's, or RC-05 stage 2's sanitising one) and applies the gate on top,
-- so it can be installed before or after that package without undoing it.
--
-- ORDER: independent of the app release. The pages need no change: share links already ask a signed-out visitor to sign in, and invite pages (/museum/invite/...) already require sign-in before they load, so
-- no page ever asks the database for this content signed out; only a direct call to the lookup functions could. Needs 20261018_gallery_links_respect_private.sql to be in place (the check below stops otherwise).
-- DECISION FOR THE OWNER: this treats "Registered Users" as a real gate. Do not run it if the mode is only meant as a page-level nudge.
-- AFTER RUNNING: run supabase/validation/20261110_registered_users_link_lookup_checks.sql (read-only) and send the one-row result.
-- UNDO: supabase/rollback/20261110_registered_users_link_lookup_rollback.sql
begin;

do $$
begin
  if to_regprocedure('public.gallery_public_row(public.galleries)') is null then
    raise exception 'gallery_public_row does not exist: 20261018_gallery_links_respect_private.sql is not applied. Nothing was changed.';
  end if;
end;
$$;

-- A. The rule, in one place (internal helper: not callable by visitors).
create or replace function public.gallery_blocks_signed_out(g public.galleries)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is null
     and not public.is_profile_member(g.profile_id)
     and coalesce(g.layout->>'guestViewMode', g.exhibition_layout->>'guestViewMode', '') = 'guest';
$$;

revoke all on function public.gallery_blocks_signed_out(public.galleries) from public, anon, authenticated;

-- B. The row a link caller receives: whatever gallery_public_row gives, minus the protected parts when the rule above applies.
create or replace function public.gallery_for_link(g public.galleries)
returns public.galleries
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.gallery_blocks_signed_out(g) then
      jsonb_populate_record(
        null::public.galleries,
        to_jsonb(public.gallery_public_row(g))
          || jsonb_build_object(
               'layout', jsonb_build_object('guestViewMode', 'guest'),
               'exhibition_layout', jsonb_build_object('guestViewMode', 'guest'),
               'item_notes', null,
               'cover_image', null))
    else public.gallery_public_row(g)
  end;
$$;

revoke all on function public.gallery_for_link(public.galleries) from public, anon, authenticated;

-- C. Share link.
create or replace function public.get_gallery_by_share_token(p_token text)
returns setof public.galleries
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.*
  from public.galleries g
  cross join lateral public.gallery_for_link(g) r
  where g.public_token = p_token
    and (
      public.is_profile_member(g.profile_id)
      or (g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE')
    )
  limit 1;
$$;

grant execute on function public.get_gallery_by_share_token(text) to anon, authenticated;

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
    and not public.gallery_blocks_signed_out(g)
    and (
      public.is_profile_member(g.profile_id)
      or (g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE')
    )
  order by gi.position asc;
$$;

grant execute on function public.get_gallery_items_by_share_token(text) to anon, authenticated;

-- D. Invitation link: still known, not disabled, not expired (unchanged), plus the rule.
create or replace function public.get_gallery_by_invite_token(p_token text)
returns setof public.galleries
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.gallery_invites%rowtype;
begin
  select * into v_invite from public.gallery_invites where token = p_token limit 1;
  if not found or v_invite.disabled or (v_invite.expires_at is not null and v_invite.expires_at < now()) then
    return;
  end if;
  return query
    select r.*
    from public.galleries g
    cross join lateral public.gallery_for_link(g) r
    where g.id = v_invite.gallery_id
      and (
        public.is_profile_member(g.profile_id)
        or (g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE')
      )
    limit 1;
end;
$$;

grant execute on function public.get_gallery_by_invite_token(text) to anon, authenticated;

create or replace function public.get_gallery_items_by_invite_token(p_token text)
returns setof public.gallery_items
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.gallery_invites%rowtype;
begin
  select * into v_invite from public.gallery_invites where token = p_token limit 1;
  if not found or v_invite.disabled or (v_invite.expires_at is not null and v_invite.expires_at < now()) then
    return;
  end if;
  return query
    select gi.*
    from public.gallery_items gi
    join public.galleries g on g.id = gi.gallery_id
    where gi.gallery_id = v_invite.gallery_id
      and not public.gallery_blocks_signed_out(g)
      and (
        public.is_profile_member(g.profile_id)
        or (g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE')
      )
    order by gi.position asc;
end;
$$;

grant execute on function public.get_gallery_items_by_invite_token(text) to anon, authenticated;

-- E. Invite "financial history" (purchase prices): the same rule.
create or replace function public.get_invite_item_financials(p_token text)
returns table(id text, purchase_price numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.gallery_invites%rowtype;
begin
  select * into v_invite from public.gallery_invites where token = p_token limit 1;
  if not found or v_invite.disabled or (v_invite.expires_at is not null and v_invite.expires_at < now()) then
    return;
  end if;
  if coalesce((v_invite.permissions ->> 'financialHistory')::boolean, false) is not true then
    return;
  end if;
  return query
    select vi.id::text, vi.purchase_price::numeric
    from public.vault_items vi
    join public.gallery_items gi on gi.artifact_id::text = vi.id::text
    join public.galleries g on g.id = gi.gallery_id
    where gi.gallery_id = v_invite.gallery_id
      and vi.is_public = true
      and not public.gallery_blocks_signed_out(g)
      and (
        public.is_profile_member(g.profile_id)
        or (g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE')
      );
end;
$$;

grant execute on function public.get_invite_item_financials(text) to anon, authenticated;

commit;
