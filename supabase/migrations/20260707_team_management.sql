-- ─────────────────────────────────────────────────────────────
-- Phase 3: Team management (Owner / Admin / Member)
-- =============================================================
-- Adds owner/admin-only RPCs to invite, remove, and re-role members
-- of a profile (business team), plus a roster lister with emails.
-- Refines item/gallery RLS so members can read/add/edit but only
-- managers (owner/admin) can delete. Safe to re-run.
--
-- Depends on: 20260707_profile_members.sql
-- ─────────────────────────────────────────────────────────────

-- ── Manager check (owner or admin) ──────────────────────────
create or replace function public.is_profile_manager(p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profile_members m
    where m.profile_id = p_profile and m.user_id = auth.uid() and m.role in ('owner','admin')
  );
$$;

create or replace function public.is_profile_manager_text(p_profile text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile ~ '^[0-9a-fA-F-]{36}$'
     and exists (
       select 1 from public.profile_members m
       where m.profile_id = p_profile::uuid and m.user_id = auth.uid() and m.role in ('owner','admin')
     );
$$;

-- ── RPCs ────────────────────────────────────────────────────
create or replace function public.add_profile_member(p_profile uuid, p_email text, p_role text default 'member')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_target uuid;
begin
  if not public.is_profile_manager(p_profile) then
    return jsonb_build_object('ok', false, 'error', 'Only owners or admins can add members.');
  end if;
  if p_role not in ('admin','member') then
    return jsonb_build_object('ok', false, 'error', 'Role must be admin or member.');
  end if;
  select id into v_target from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_target is null then
    return jsonb_build_object('ok', false, 'error', 'No VLTD account found for that email — they must sign up first.');
  end if;
  insert into public.profile_members (profile_id, user_id, role)
    values (p_profile, v_target, p_role)
    on conflict (profile_id, user_id) do update set role = excluded.role;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.add_profile_member(uuid, text, text) to authenticated;

create or replace function public.remove_profile_member(p_profile uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_profile_manager(p_profile) then
    return jsonb_build_object('ok', false, 'error', 'Only owners or admins can remove members.');
  end if;
  if exists (select 1 from public.profile_members where profile_id = p_profile and user_id = p_user and role = 'owner') then
    return jsonb_build_object('ok', false, 'error', 'The owner cannot be removed.');
  end if;
  delete from public.profile_members where profile_id = p_profile and user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.remove_profile_member(uuid, uuid) to authenticated;

create or replace function public.update_member_role(p_profile uuid, p_user uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_profile_manager(p_profile) then
    return jsonb_build_object('ok', false, 'error', 'Only owners or admins can change roles.');
  end if;
  if p_role not in ('admin','member') then
    return jsonb_build_object('ok', false, 'error', 'Role must be admin or member.');
  end if;
  if exists (select 1 from public.profile_members where profile_id = p_profile and user_id = p_user and role = 'owner') then
    return jsonb_build_object('ok', false, 'error', 'The owner''s role cannot be changed here.');
  end if;
  update public.profile_members set role = p_role where profile_id = p_profile and user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.update_member_role(uuid, uuid, text) to authenticated;

-- Roster with emails (any member of the profile may view it)
create or replace function public.list_profile_members(p_profile uuid)
returns table(user_id uuid, email text, role text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.profile_members m
  join auth.users u on u.id = m.user_id
  where m.profile_id = p_profile and public.is_profile_member(p_profile)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
$$;
grant execute on function public.list_profile_members(uuid) to authenticated;

-- ── RLS role refinement: members read/add/edit, only managers delete ──
drop policy if exists "vault_items_write_member" on public.vault_items;
create policy "vault_items_insert_member" on public.vault_items
  for insert to authenticated with check (public.is_profile_member_text(profile_id));
create policy "vault_items_update_member" on public.vault_items
  for update to authenticated
  using (public.is_profile_member_text(profile_id))
  with check (public.is_profile_member_text(profile_id));
create policy "vault_items_delete_manager" on public.vault_items
  for delete to authenticated using (public.is_profile_manager_text(profile_id));

drop policy if exists "galleries_manage_member" on public.galleries;
create policy "galleries_insert_member" on public.galleries
  for insert to authenticated with check (public.is_profile_member(profile_id));
create policy "galleries_update_member" on public.galleries
  for update to authenticated
  using (public.is_profile_member(profile_id))
  with check (public.is_profile_member(profile_id));
create policy "galleries_delete_manager" on public.galleries
  for delete to authenticated using (public.is_profile_manager(profile_id));
