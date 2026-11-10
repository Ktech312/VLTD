-- Rollback for 20261110_registered_users_exhibitions_hide_layout_from_signed_out.sql: restores the five link functions exactly as supabase/migrations/20261018_gallery_links_respect_private.sql
-- defined them, then removes the two helpers the migration added. It does not touch gallery_public_row (so the held RC-05 SQL, if installed, is left as it is).
-- Safe to run more than once. Changes no data.
begin;

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

drop function if exists public.gallery_for_link(public.galleries);
drop function if exists public.gallery_blocks_signed_out(public.galleries);

commit;
