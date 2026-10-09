-- Club actions use the profile you are signed into (personal or Business), not whichever profile came first.
-- Safe to run more than once. Deletes no data; it replaces six functions with versions that take an optional profile.
-- The site still works if you run this later or never: it falls back to the old behaviour.

-- The profile an action runs as: the one asked for, if it belongs to the signed-in user; otherwise the first one.
create or replace function public.club_actor(p_profile_id uuid default null)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles
  where user_id = auth.uid()
  order by (id = p_profile_id) desc nulls last, id
  limit 1;
$$;
grant execute on function public.club_actor(uuid) to authenticated;

drop function if exists public.join_club(uuid);
create or replace function public.join_club(p_club_id uuid, p_profile_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := public.club_actor(p_profile_id);
  if v_profile_id is null then
    raise exception 'No active profile';
  end if;

  if exists (select 1 from public.club_bans where club_id = p_club_id and profile_id = v_profile_id) then
    raise exception 'You have been removed from this club';
  end if;

  insert into public.club_members (club_id, profile_id, role)
  values (p_club_id, v_profile_id, 'member')
  on conflict (club_id, profile_id) do nothing;
end;
$$;
grant execute on function public.join_club(uuid, uuid) to authenticated;

drop function if exists public.leave_club(uuid);
create or replace function public.leave_club(p_club_id uuid, p_profile_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := public.club_actor(p_profile_id);
  if v_profile_id is null then
    raise exception 'No active profile';
  end if;

  if exists (select 1 from public.clubs where id = p_club_id and owner_profile_id = v_profile_id) then
    raise exception 'The owner can''t leave -- delete the club instead';
  end if;

  delete from public.club_members where club_id = p_club_id and profile_id = v_profile_id;
end;
$$;
grant execute on function public.leave_club(uuid, uuid) to authenticated;

drop function if exists public.remove_club_member(uuid, uuid, text);
create or replace function public.remove_club_member(p_club_id uuid, p_target_profile_id uuid, p_reason text default null, p_profile_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
begin
  v_caller_profile_id := public.club_actor(p_profile_id);
  if v_caller_profile_id is null or not public.is_club_staff(p_club_id, v_caller_profile_id) then
    raise exception 'Not authorized to remove members from this club';
  end if;

  if exists (select 1 from public.clubs where id = p_club_id and owner_profile_id = p_target_profile_id) then
    raise exception 'Cannot remove the club owner';
  end if;

  delete from public.club_members where club_id = p_club_id and profile_id = p_target_profile_id;
  insert into public.club_bans (club_id, profile_id, banned_by_profile, reason)
  values (p_club_id, p_target_profile_id, v_caller_profile_id, p_reason)
  on conflict (club_id, profile_id) do update set reason = excluded.reason, banned_at = now();
end;
$$;
grant execute on function public.remove_club_member(uuid, uuid, text, uuid) to authenticated;

drop function if exists public.set_club_moderator(uuid, uuid, boolean);
create or replace function public.set_club_moderator(p_club_id uuid, p_target_profile_id uuid, p_is_moderator boolean, p_profile_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
begin
  v_caller_profile_id := public.club_actor(p_profile_id);
  if v_caller_profile_id is null or not exists (
    select 1 from public.clubs where id = p_club_id and owner_profile_id = v_caller_profile_id
  ) then
    raise exception 'Only the club owner can change moderators';
  end if;

  update public.club_members
  set role = case when p_is_moderator then 'moderator' else 'member' end
  where club_id = p_club_id and profile_id = p_target_profile_id and role <> 'owner';
end;
$$;
grant execute on function public.set_club_moderator(uuid, uuid, boolean, uuid) to authenticated;

drop function if exists public.hide_club_post(uuid);
create or replace function public.hide_club_post(p_post_id uuid, p_profile_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_author_profile_id uuid;
  v_caller_profile_id uuid;
begin
  select club_id, profile_id into v_club_id, v_author_profile_id from public.club_posts where id = p_post_id;
  if v_club_id is null then
    raise exception 'Post not found';
  end if;

  v_caller_profile_id := public.club_actor(p_profile_id);

  -- The post's own author can hide it (matches hide_lounge_post's rule),
  -- OR club staff can hide anyone's post (real moderation).
  if v_caller_profile_id is null or not (
    v_caller_profile_id = v_author_profile_id or public.is_club_staff(v_club_id, v_caller_profile_id)
  ) then
    raise exception 'Not authorized to hide this post';
  end if;

  update public.club_posts set hidden_at = now() where id = p_post_id;
end;
$$;
grant execute on function public.hide_club_post(uuid, uuid) to authenticated;

drop function if exists public.resolve_club_report(uuid);
create or replace function public.resolve_club_report(p_report_id uuid, p_profile_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_caller_profile_id uuid;
begin
  select cp.club_id into v_club_id
  from public.club_post_reports r
  join public.club_posts cp on cp.id = r.post_id
  where r.id = p_report_id;

  if v_club_id is null then
    raise exception 'Report not found';
  end if;

  v_caller_profile_id := public.club_actor(p_profile_id);
  if v_caller_profile_id is null or not public.is_club_staff(v_club_id, v_caller_profile_id) then
    raise exception 'Not authorized to resolve reports for this club';
  end if;

  update public.club_post_reports set resolved_at = now() where id = p_report_id;
end;
$$;
grant execute on function public.resolve_club_report(uuid, uuid) to authenticated;

