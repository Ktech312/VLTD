-- Private exhibitions must stay private to anyone holding an old link, and share links must not carry more than the page needs.
--
-- Found 2026-10-17 (account-isolation check, synthetic QA exhibition, signed-out caller): the share-link and invite-link functions
-- from 20260823 looked an exhibition up by its token and returned the WHOLE row whatever its visibility. After an owner switched an
-- exhibition to Private (visibility = 'LOCKED'), anyone who still had the old link could call the function directly and read the
-- title, description, layout (with the item snapshots), item notes, alias fields and analytics. The page hid it; the function did not.
--
-- WHAT THIS DOES
--   1. A caller who is NOT a member of the exhibition's profile gets a row back only when the exhibition is shareable:
--        visibility PUBLIC or INVITE (Guest View / Registered Users)  AND  state ACTIVE.
--      Private (LOCKED), Storage/draft (state STORAGE) and any unknown value return nothing. (This is the same rule the
--      public-exhibition read policy already uses: PUBLIC and ACTIVE.)
--   2. Members of the exhibition's profile (the owner and their team) still get their own exhibition through the link, whatever its
--      state, so an owner opening their own old link sees the "private" notice instead of "not found".
--   3. Invitation links keep every restriction they had (unknown, disabled or expired invites return nothing) and now ALSO obey
--      point 1. The invite "financial history" function obeys it too (it returned purchase prices for a Private exhibition).
--   4. For everyone except members, the returned row leaves out analytics_unique_view_keys (visitor identifiers), and when the
--      exhibition uses an alias (alias_enabled) profile_id is returned empty, so the real account is not named in the response.
--      (The page already shows only the alias for those; see the matching site change.)
--   Link functions only. No table, policy, grant or data changes. Safe to run more than once.
--
-- AFTER RUNNING: run supabase/validation/20261018_gallery_links_respect_private_checks.sql (read-only) and send me the results.
--
-- UNDO (restores the previous behaviour): re-run supabase/migrations/20260823_fix_gallery_share_and_invite_tokens.sql, then
--   drop function if exists public.gallery_public_row(public.galleries);
--   and re-run the get_invite_item_financials block from supabase/migrations/20261007_public_item_columns.sql.

-- A. What a link holder is allowed to receive of an exhibition row (internal helper: not callable by visitors).
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

-- B. Share link (public_token)
create or replace function public.get_gallery_by_share_token(p_token text)
returns setof public.galleries
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.*
  from public.galleries g
  cross join lateral public.gallery_public_row(g) r
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
    and (
      public.is_profile_member(g.profile_id)
      or (g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE')
    )
  order by gi.position asc;
$$;

grant execute on function public.get_gallery_items_by_share_token(text) to anon, authenticated;

-- C. Invitation links: same checks as before (known, not disabled, not expired) plus the rule above.
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
    cross join lateral public.gallery_public_row(g) r
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
      and (
        public.is_profile_member(g.profile_id)
        or (g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE')
      )
    order by gi.position asc;
end;
$$;

grant execute on function public.get_gallery_items_by_invite_token(text) to anon, authenticated;

-- D. Invite "financial history": purchase prices only for an invite that allows it, is valid, AND whose exhibition is shareable.
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
      and (
        public.is_profile_member(g.profile_id)
        or (g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE')
      );
end;
$$;

grant execute on function public.get_invite_item_financials(text) to anon, authenticated;
