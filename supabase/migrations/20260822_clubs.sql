-- ─────────────────────────────────────────────────────────────
-- Clubs — real collector clubs + discussion boards, with real moderation.
-- Phase 1 of 3 (EK's ask): native clubs now, Discord webhook posting and
-- Reddit cross-posting are separate follow-ups that need EK's own setup on
-- those platforms before they can go live -- this migration includes the
-- integrations table for that, but no actual Discord/Reddit call happens
-- from SQL.
--
-- Mirrors this app's existing lounge_posts pattern (visible-only select,
-- insert-as-your-own-profile, moderation ONLY through security-definer
-- functions -- never a raw UPDATE/DELETE policy, so "permission to
-- moderate" can never become a backdoor to edit/delete someone else's row
-- directly) -- extended with real membership, roles, and bans, since a
-- club (unlike the single shared Lounge) needs its own member list and its
-- own moderators.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

-- ── Clubs ──────────────────────────────────────────────────────
create table if not exists public.clubs (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 2 and 60),
  description       text not null default '' check (char_length(description) <= 500),
  owner_profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at        timestamptz not null default now()
);

create index if not exists clubs_created_at_idx on public.clubs(created_at desc);

alter table public.clubs enable row level security;

drop policy if exists "Clubs are publicly readable" on public.clubs;
create policy "Clubs are publicly readable"
  on public.clubs for select
  using (true);

drop policy if exists "Users can create a club as their own profile" on public.clubs;
create policy "Users can create a club as their own profile"
  on public.clubs for insert
  with check (owner_profile_id in (select id from public.profiles where user_id = auth.uid()));

drop policy if exists "Owner can update their club" on public.clubs;
create policy "Owner can update their club"
  on public.clubs for update
  using (owner_profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (owner_profile_id in (select id from public.profiles where user_id = auth.uid()));

drop policy if exists "Owner can delete their club" on public.clubs;
create policy "Owner can delete their club"
  on public.clubs for delete
  using (owner_profile_id in (select id from public.profiles where user_id = auth.uid()));

-- ── Membership ─────────────────────────────────────────────────
-- No direct insert/update/delete policy at all, on purpose -- every
-- membership change (joining, leaving, being removed, promotion) goes
-- through a security-definer function below, same reasoning as
-- hide_lounge_post(): a raw policy here would be a backdoor around the
-- moderation/ban rules those functions enforce.
create table if not exists public.club_members (
  club_id     uuid not null references public.clubs(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  joined_at   timestamptz not null default now(),
  primary key (club_id, profile_id)
);

create index if not exists club_members_profile_idx on public.club_members(profile_id);

alter table public.club_members enable row level security;

drop policy if exists "Club membership is publicly readable" on public.club_members;
create policy "Club membership is publicly readable"
  on public.club_members for select
  using (true);

-- Auto-add the creator as owner the moment a club is created -- atomic with
-- the insert, not a second client-side step that could fail halfway.
create or replace function public.handle_new_club()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.club_members (club_id, profile_id, role)
  values (new.id, new.owner_profile_id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_club_created on public.clubs;
create trigger on_club_created
  after insert on public.clubs
  for each row execute function public.handle_new_club();

-- ── Bans ───────────────────────────────────────────────────────
-- Deliberately no client-facing policy at all (RLS enabled, zero policies
-- = fully locked to the client). Only the security-definer functions below
-- (which run with elevated rights, bypassing RLS) ever read or write this
-- table -- a banned member finds out by join_club() refusing them, not by
-- being able to browse the ban list.
create table if not exists public.club_bans (
  club_id           uuid not null references public.clubs(id) on delete cascade,
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  banned_by_profile uuid references public.profiles(id),
  reason            text,
  banned_at         timestamptz not null default now(),
  primary key (club_id, profile_id)
);

alter table public.club_bans enable row level security;

-- ── Shared staff-check helper ─────────────────────────────────────
-- "Is this profile the owner or a moderator of this club" -- reused by
-- every moderation policy/function below instead of repeating the same
-- subquery five times (and risking one copy drifting from the others).
create or replace function public.is_club_staff(p_club_id uuid, p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id and profile_id = p_profile_id and role in ('owner', 'moderator')
  );
$$;

-- ── Membership functions ──────────────────────────────────────────
create or replace function public.join_club(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id from public.profiles where user_id = auth.uid() limit 1;
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

create or replace function public.leave_club(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id from public.profiles where user_id = auth.uid() limit 1;
  if v_profile_id is null then
    raise exception 'No active profile';
  end if;

  if exists (select 1 from public.clubs where id = p_club_id and owner_profile_id = v_profile_id) then
    raise exception 'The owner can''t leave -- delete the club instead';
  end if;

  delete from public.club_members where club_id = p_club_id and profile_id = v_profile_id;
end;
$$;

-- Owner/moderator removes a member and bans them from rejoining. Can't be
-- used on the owner (moderators shouldn't be able to remove the person who
-- made them a moderator).
create or replace function public.remove_club_member(p_club_id uuid, p_target_profile_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
begin
  select id into v_caller_profile_id from public.profiles where user_id = auth.uid() limit 1;
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

-- Owner-only: promote a member to moderator, or demote back to member.
create or replace function public.set_club_moderator(p_club_id uuid, p_target_profile_id uuid, p_is_moderator boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_profile_id uuid;
begin
  select id into v_caller_profile_id from public.profiles where user_id = auth.uid() limit 1;
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

-- ── Posts ──────────────────────────────────────────────────────
create table if not exists public.club_posts (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  hidden_at   timestamptz
);

create index if not exists club_posts_club_created_idx on public.club_posts(club_id, created_at desc);

alter table public.club_posts enable row level security;

drop policy if exists "Visible club posts are publicly readable" on public.club_posts;
create policy "Visible club posts are publicly readable"
  on public.club_posts for select
  using (hidden_at is null);

drop policy if exists "Members can post to their club" on public.club_posts;
create policy "Members can post to their club"
  on public.club_posts for insert
  with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
    and exists (select 1 from public.club_members where club_id = club_posts.club_id and profile_id = club_posts.profile_id)
  );

-- No UPDATE/DELETE policy on purpose -- moderation only through
-- hide_club_post() below.
create or replace function public.hide_club_post(p_post_id uuid)
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

  select id into v_caller_profile_id from public.profiles where user_id = auth.uid() limit 1;

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

-- ── Reports ────────────────────────────────────────────────────
create table if not exists public.club_post_reports (
  id                 uuid primary key default gen_random_uuid(),
  post_id            uuid not null references public.club_posts(id) on delete cascade,
  reporter_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason             text not null check (char_length(reason) between 1 and 300),
  created_at         timestamptz not null default now(),
  resolved_at        timestamptz
);

create index if not exists club_post_reports_post_idx on public.club_post_reports(post_id);

alter table public.club_post_reports enable row level security;

drop policy if exists "Users can report a post as their own profile" on public.club_post_reports;
create policy "Users can report a post as their own profile"
  on public.club_post_reports for insert
  with check (reporter_profile_id in (select id from public.profiles where user_id = auth.uid()));

-- Only that report's club staff can see reports (not the reporter, not
-- other members -- moderation queue is staff-only).
drop policy if exists "Club staff can view reports for their club" on public.club_post_reports;
create policy "Club staff can view reports for their club"
  on public.club_post_reports for select
  using (
    exists (
      select 1 from public.club_posts cp
      join public.profiles p on p.user_id = auth.uid()
      where cp.id = club_post_reports.post_id
        and public.is_club_staff(cp.club_id, p.id)
    )
  );

create or replace function public.resolve_club_report(p_report_id uuid)
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

  select id into v_caller_profile_id from public.profiles where user_id = auth.uid() limit 1;
  if v_caller_profile_id is null or not public.is_club_staff(v_club_id, v_caller_profile_id) then
    raise exception 'Not authorized to resolve reports for this club';
  end if;

  update public.club_post_reports set resolved_at = now() where id = p_report_id;
end;
$$;

-- ── Integrations (Discord webhook / Reddit subreddit) ─────────────
-- Owner-only, both read and write -- a webhook URL is a bearer secret (
-- anyone who has it can post to that Discord channel as this club), so it
-- deliberately lives in its OWN table rather than as a column on `clubs`
-- (which every member can read) -- even a moderator doesn't get this.
create table if not exists public.club_integrations (
  club_id             uuid primary key references public.clubs(id) on delete cascade,
  discord_webhook_url text,
  reddit_subreddit    text,
  updated_at          timestamptz not null default now()
);

alter table public.club_integrations enable row level security;

drop policy if exists "Owner manages their club integrations" on public.club_integrations;
create policy "Owner manages their club integrations"
  on public.club_integrations for all
  using (
    club_id in (select id from public.clubs where owner_profile_id in (select id from public.profiles where user_id = auth.uid()))
  )
  with check (
    club_id in (select id from public.clubs where owner_profile_id in (select id from public.profiles where user_id = auth.uid()))
  );
