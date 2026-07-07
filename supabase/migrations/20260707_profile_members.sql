-- ─────────────────────────────────────────────────────────────
-- Phase 1: Membership layer + RLS hardening
-- =============================================================
-- Introduces public.profile_members so a profile (esp. a business)
-- can have multiple users and a transferable owner, and rewrites the
-- access rules on vault_items / galleries / gallery_items to gate on
-- membership instead of a single user_id / a hardcoded profile id.
--
-- This ALSO closes real security holes found in the current policies:
--   • vault_items were world-readable (USING true) — private items leaked.
--   • vault_items writes were locked to ONE hardcoded profile id, so any
--     non-owner user's items could never sync.
--   • galleries + gallery_items were world-WRITABLE (USING true) — anyone
--     could edit/delete anyone's exhibits.
--
-- Public reads still work: 883 public items + all 46 PUBLIC/ACTIVE galleries
-- remain readable via the proper is_public / visibility policies.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Membership table ─────────────────────────────────────
create table if not exists public.profile_members (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner','admin','member')),
  created_at  timestamptz not null default now(),
  primary key (profile_id, user_id)
);

alter table public.profile_members enable row level security;

-- ── 2. Backfill — every existing profile's user_id becomes its owner ──
insert into public.profile_members (profile_id, user_id, role)
  select id, user_id, 'owner' from public.profiles
  on conflict (profile_id, user_id) do nothing;

-- ── 3. Membership helpers (security definer avoids RLS recursion) ──
create or replace function public.is_profile_member(p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profile_members m
    where m.profile_id = p_profile and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_profile_owner(p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profile_members m
    where m.profile_id = p_profile and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- vault_items.profile_id is TEXT — guard the uuid cast against bad data
create or replace function public.is_profile_member_text(p_profile text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile is not null
     and p_profile ~ '^[0-9a-fA-F-]{36}$'
     and exists (
       select 1 from public.profile_members m
       where m.profile_id = p_profile::uuid and m.user_id = auth.uid()
     );
$$;

-- ── 4. profile_members RLS — members can read their own profiles' rosters ──
drop policy if exists "members read own roster" on public.profile_members;
create policy "members read own roster" on public.profile_members
  for select to authenticated
  using (public.is_profile_member(profile_id));
-- (writes to membership happen through owner-only RPCs added in a later phase)

-- ── 5. vault_items — membership-scoped ──────────────────────
drop policy if exists "vault_items_public_read"        on public.vault_items;  -- USING true (leak)
drop policy if exists "Public items readable by anyone" on public.vault_items;
drop policy if exists "vault_items_select_own"         on public.vault_items;  -- hardcoded id
drop policy if exists "vault_items_insert_own"         on public.vault_items;
drop policy if exists "vault_items_update_own"         on public.vault_items;
drop policy if exists "vault_items_delete_own"         on public.vault_items;

create policy "vault_items_read_member" on public.vault_items
  for select to authenticated
  using (public.is_profile_member_text(profile_id));

create policy "vault_items_read_public" on public.vault_items
  for select to anon, authenticated
  using (is_public = true);

create policy "vault_items_write_member" on public.vault_items
  for all to authenticated
  using (public.is_profile_member_text(profile_id))
  with check (public.is_profile_member_text(profile_id));

-- ── 6. galleries — membership-scoped, keep public read ──────
drop policy if exists "galleries_public_write"            on public.galleries;  -- USING true (danger)
drop policy if exists "galleries_public_read"             on public.galleries;  -- USING true
drop policy if exists "galleries_manage_own"              on public.galleries;  -- user_id based
drop policy if exists "Owners can manage their galleries" on public.galleries;
-- keep: "Public galleries are readable" (PUBLIC+ACTIVE) and "anon_read_by_public_token"

create policy "galleries_manage_member" on public.galleries
  for all to authenticated
  using (public.is_profile_member(profile_id))
  with check (public.is_profile_member(profile_id));

-- ── 7. gallery_items — scoped via the parent gallery's membership ──
drop policy if exists "gallery_items_authenticated_write" on public.gallery_items;  -- USING true (danger)
drop policy if exists "gallery_items_public_read"         on public.gallery_items;  -- USING true

create policy "gallery_items_read_public" on public.gallery_items
  for select to anon, authenticated
  using (exists (
    select 1 from public.galleries g
    where g.id = gallery_items.gallery_id
      and ((g.visibility = 'PUBLIC' and g.state = 'ACTIVE') or g.public_token is not null)
  ));

create policy "gallery_items_read_member" on public.gallery_items
  for select to authenticated
  using (exists (
    select 1 from public.galleries g
    where g.id = gallery_items.gallery_id and public.is_profile_member(g.profile_id)
  ));

create policy "gallery_items_write_member" on public.gallery_items
  for all to authenticated
  using (exists (
    select 1 from public.galleries g
    where g.id = gallery_items.gallery_id and public.is_profile_member(g.profile_id)
  ))
  with check (exists (
    select 1 from public.galleries g
    where g.id = gallery_items.gallery_id and public.is_profile_member(g.profile_id)
  ));
