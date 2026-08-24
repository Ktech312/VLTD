-- Fixes real, confirmed holes surfaced by pulling the actual policies for
-- galleries / gallery_items / gallery_invites (none of these were in any
-- tracked migration — same blind spot as profiles_update_own earlier):
--
--   galleries."anon_read_by_public_token": using (public_token is not null)
--     — createGallery() gives EVERY gallery a token at creation, not just
--     when a share link is actually made, so this let anon read the FULL
--     row (title, description, cover image, and publicItemSnapshots -
--     the actual display content meant for share-link viewers) of ANY
--     gallery regardless of visibility, including Locked ones. Not
--     trivially exploitable (gallery ids are real random UUIDs, not
--     guessable) but the Locked setting provided zero real protection to
--     anyone who obtained an id through any other means.
--
--   gallery_invites_public_write: using(true) with_check(true), for ALL
--     commands, for BOTH anon and authenticated — the worst one found in
--     this whole audit. Anyone, logged in or not, could create a fake
--     invite for any gallery, disable/delete someone else's real invite,
--     or rewrite its permissions.
--
--   gallery_invites_lookup_read: using (disabled = false) — anyone could
--     read every non-disabled invite (its token, permissions, gallery_id)
--     for every gallery, without ever supplying a real token.
--
--   gallery_items_read_public (tracked in 20260707_profile_members.sql)
--     had the same "public_token is not null" pattern as the galleries
--     policy above.
--
-- RLS can't verify "did the caller supply the actual correct token" for
-- an anonymous request - it only sees row data, never what filter the
-- client applied. The real fix is to stop granting anonymous table
-- access based on token existence, and route legitimate token-based
-- reads through SECURITY DEFINER functions that take the token as an
-- explicit parameter and do the real comparison themselves.

-- ── 1. galleries: drop the broken anon policy ──────────────────────────
drop policy if exists "anon_read_by_public_token" on public.galleries;
-- "Public galleries are readable" (visibility='PUBLIC' and state='ACTIVE')
-- and the member-scoped policies are untouched - those were correct.

-- ── 2. gallery_items: remove the same broken bypass ────────────────────
drop policy if exists "gallery_items_read_public" on public.gallery_items;
create policy "gallery_items_read_public" on public.gallery_items
  for select to anon, authenticated
  using (exists (
    select 1 from public.galleries g
    where g.id = gallery_items.gallery_id
      and g.visibility = 'PUBLIC' and g.state = 'ACTIVE'
  ));

-- ── 3. gallery_invites: remove the wide-open write + read, replace with
--       real member-only management. Anonymous invite USE (validating a
--       link, marking it used) moves entirely to the RPCs below - there
--       is no anon policy on this table at all after this. ──────────────
drop policy if exists "gallery_invites_public_write" on public.gallery_invites;
drop policy if exists "gallery_invites_lookup_read" on public.gallery_invites;

create policy "gallery_invites_manage_member" on public.gallery_invites
  for all to authenticated
  using (exists (
    select 1 from public.galleries g
    where g.id = gallery_invites.gallery_id and public.is_profile_member(g.profile_id)
  ))
  with check (exists (
    select 1 from public.galleries g
    where g.id = gallery_invites.gallery_id and public.is_profile_member(g.profile_id)
  ));

-- ── 4. Real token verification, done in the function itself instead of
--       relying on RLS to guess the caller's intent ────────────────────

create or replace function public.get_gallery_by_share_token(p_token text)
returns setof public.galleries
language sql
stable
security definer
set search_path = public
as $$
  select * from public.galleries where public_token = p_token limit 1;
$$;

grant execute on function public.get_gallery_by_share_token(text) to anon, authenticated;

create or replace function public.get_gallery_items_by_share_token(p_token text)
returns setof public.gallery_items
language sql
stable
security definer
set search_path = public
as $$
  select gi.* from public.gallery_items gi
  join public.galleries g on g.id = gi.gallery_id
  where g.public_token = p_token
  order by gi.position asc;
$$;

grant execute on function public.get_gallery_items_by_share_token(text) to anon, authenticated;

-- Invite tokens additionally need the "disabled/expired" check the app
-- already relied on getGalleryByInviteToken() doing client-side - moved
-- inside the function so an invalid/expired/disabled invite genuinely
-- returns nothing, not just "the app chose not to show it."
create or replace function public.get_gallery_by_invite_token(p_token text)
returns setof public.galleries
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite public.gallery_invites%rowtype;
begin
  select * into v_invite from public.gallery_invites where token = p_token limit 1;
  if not found or v_invite.disabled or (v_invite.expires_at is not null and v_invite.expires_at < now()) then
    return;
  end if;
  return query select * from public.galleries where id = v_invite.gallery_id limit 1;
end;
$$;

grant execute on function public.get_gallery_by_invite_token(text) to anon, authenticated;

create or replace function public.get_gallery_items_by_invite_token(p_token text)
returns setof public.gallery_items
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite public.gallery_invites%rowtype;
begin
  select * into v_invite from public.gallery_invites where token = p_token limit 1;
  if not found or v_invite.disabled or (v_invite.expires_at is not null and v_invite.expires_at < now()) then
    return;
  end if;
  return query
    select * from public.gallery_items where gallery_id = v_invite.gallery_id order by position asc;
end;
$$;

grant execute on function public.get_gallery_items_by_invite_token(text) to anon, authenticated;

-- Replaces the removed gallery_invites_public_write path for the one
-- legitimate anonymous write this table needs: recording that a link was
-- used. Still validates the invite is real and not disabled/expired
-- first, rather than blindly updating whatever token string is passed.
create or replace function public.mark_invite_token_used(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.gallery_invites
     set last_used_at = now()
   where token = p_token
     and disabled = false
     and (expires_at is null or expires_at >= now());
end;
$$;

grant execute on function public.mark_invite_token_used(text) to anon, authenticated;

-- The invite page shows real "this link was disabled/expired" messaging
-- (getGalleryByInviteToken's existing client logic), which needs the raw
-- invite row even when it's invalid — get_gallery_by_invite_token above
-- deliberately returns nothing in that case, so it can't be reused here.
-- This one just returns the invite's own metadata unconditionally; the
-- gallery's actual content still only ever comes from the validating
-- function above, so this alone can't unlock anything.
create or replace function public.get_invite_token_info(p_token text)
returns setof public.gallery_invites
language sql
stable
security definer
set search_path = public
as $$
  select * from public.gallery_invites where token = p_token limit 1;
$$;

grant execute on function public.get_invite_token_info(text) to anon, authenticated;
