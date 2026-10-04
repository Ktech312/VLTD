-- Launch cohort and VLT Lounge threads.
--
-- Launch access:
--   * Counts real auth accounts, not profiles (one account may own many profiles).
--   * Backfills every existing real account so the public counter starts truthfully.
--   * Excludes the fixed @vltd-seed.internal characters from the public total.
--   * An auth.users trigger rejects account 51 atomically, including concurrent signups.
--
-- Lounge:
--   * Extends the existing lounge_posts table instead of creating a second feed.
--   * Adds titles/categories, profile-scoped voting, threaded comments, and aggregate
--     score/comment counts without exposing account/email data.

-- ---------------------------------------------------------------------------
-- First 50 real accounts
-- ---------------------------------------------------------------------------

create table if not exists public.launch_access_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slot_number smallint not null unique check (slot_number between 1 and 50),
  claimed_at timestamptz not null default now()
);

alter table public.launch_access_claims enable row level security;
revoke all on table public.launch_access_claims from anon, authenticated;

do $$
declare
  v_real_users integer;
begin
  select count(*)::integer into v_real_users
  from auth.users
  where coalesce(email, '') not like '%@vltd-seed.internal';

  if v_real_users > 50 then
    raise exception 'Cannot enable the 50-account launch cap: % real accounts already exist', v_real_users;
  end if;
end;
$$;

insert into public.launch_access_claims (user_id, slot_number, claimed_at)
select id,
       row_number() over (order by created_at asc nulls last, id)::smallint,
       coalesce(created_at, now())
from auth.users
where coalesce(email, '') not like '%@vltd-seed.internal'
on conflict (user_id) do nothing;

create or replace function public.claim_launch_access_slot()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_slot smallint;
begin
  if coalesce(new.email, '') like '%@vltd-seed.internal' then
    return new;
  end if;

  -- Serialize claims so two simultaneous signups cannot both take the last slot.
  perform pg_advisory_xact_lock(hashtextextended('vltd-launch-access-50', 0));

  select candidate::smallint into v_slot
  from generate_series(1, 50) candidate
  where not exists (
    select 1 from public.launch_access_claims c where c.slot_number = candidate
  )
  order by candidate
  limit 1;

  if v_slot is null then
    raise exception using
      errcode = 'P0001',
      message = 'VLTD founding access is full (50 of 50 spots claimed)';
  end if;

  insert into public.launch_access_claims (user_id, slot_number, claimed_at)
  values (new.id, v_slot, coalesce(new.created_at, now()))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.claim_launch_access_slot() from public, anon, authenticated;

drop trigger if exists claim_launch_access_slot_on_auth_user on auth.users;
create trigger claim_launch_access_slot_on_auth_user
after insert on auth.users
for each row execute function public.claim_launch_access_slot();

create or replace function public.get_launch_access_status()
returns table (capacity integer, claimed integer, remaining integer, is_open boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    50,
    count(*)::integer,
    greatest(0, 50 - count(*)::integer),
    count(*) < 50
  from public.launch_access_claims;
$$;

revoke all on function public.get_launch_access_status() from public;
grant execute on function public.get_launch_access_status() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reddit-style Lounge threads
-- ---------------------------------------------------------------------------

alter table public.lounge_posts
  add column if not exists title text,
  add column if not exists category text not null default 'discussion',
  add column if not exists score integer not null default 0,
  add column if not exists comment_count integer not null default 0;

alter table public.lounge_posts drop constraint if exists lounge_posts_title_length_check;
alter table public.lounge_posts
  add constraint lounge_posts_title_length_check
  check (title is null or char_length(title) between 3 and 160);

alter table public.lounge_posts drop constraint if exists lounge_posts_category_check;
alter table public.lounge_posts
  add constraint lounge_posts_category_check
  check (category in ('discussion', 'question', 'showcase', 'news', 'help'));

create table if not exists public.lounge_post_votes (
  post_id uuid not null references public.lounge_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index if not exists lounge_post_votes_post_id_idx
  on public.lounge_post_votes(post_id);

alter table public.lounge_post_votes enable row level security;
revoke all on table public.lounge_post_votes from anon;
grant select on table public.lounge_post_votes to authenticated;
grant insert, update, delete on table public.lounge_post_votes to authenticated;

drop policy if exists "Lounge votes are publicly readable" on public.lounge_post_votes;
drop policy if exists "Users can read their own profile vote" on public.lounge_post_votes;
create policy "Users can read their own profile vote"
  on public.lounge_post_votes for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

drop policy if exists "Users can vote as their own profile" on public.lounge_post_votes;
create policy "Users can vote as their own profile"
  on public.lounge_post_votes for insert
  with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

drop policy if exists "Users can change their own profile vote" on public.lounge_post_votes;
create policy "Users can change their own profile vote"
  on public.lounge_post_votes for update
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

drop policy if exists "Users can remove their own profile vote" on public.lounge_post_votes;
create policy "Users can remove their own profile vote"
  on public.lounge_post_votes for delete
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

create table if not exists public.lounge_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.lounge_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.lounge_post_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  hidden_at timestamptz
);

create index if not exists lounge_post_comments_post_created_idx
  on public.lounge_post_comments(post_id, created_at);
create index if not exists lounge_post_comments_parent_id_idx
  on public.lounge_post_comments(parent_id);

alter table public.lounge_post_comments enable row level security;
grant select on table public.lounge_post_comments to anon, authenticated;
grant insert on table public.lounge_post_comments to authenticated;

drop policy if exists "Visible Lounge comments are publicly readable" on public.lounge_post_comments;
create policy "Visible Lounge comments are publicly readable"
  on public.lounge_post_comments for select using (hidden_at is null);

drop policy if exists "Users can comment as their own profile" on public.lounge_post_comments;
create policy "Users can comment as their own profile"
  on public.lounge_post_comments for insert
  with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
    and exists (
      select 1 from public.lounge_posts p
      where p.id = post_id and p.hidden_at is null
    )
    and (
      parent_id is null
      or exists (
        select 1 from public.lounge_post_comments parent
        where parent.id = parent_id and parent.post_id = post_id and parent.hidden_at is null
      )
    )
  );

create or replace function public.normalize_new_lounge_post_aggregates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.score := 0;
  new.comment_count := 0;
  return new;
end;
$$;

drop trigger if exists normalize_new_lounge_post_aggregates_before_insert on public.lounge_posts;
create trigger normalize_new_lounge_post_aggregates_before_insert
before insert on public.lounge_posts
for each row execute function public.normalize_new_lounge_post_aggregates();

create or replace function public.refresh_lounge_post_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
begin
  v_post_id := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
  update public.lounge_posts
  set score = coalesce((
    select sum(value)::integer from public.lounge_post_votes
    where post_id = v_post_id
  ), 0)
  where id = v_post_id;
  return null;
end;
$$;

drop trigger if exists refresh_lounge_post_score_after_vote on public.lounge_post_votes;
create trigger refresh_lounge_post_score_after_vote
after insert or update or delete on public.lounge_post_votes
for each row execute function public.refresh_lounge_post_score();

create or replace function public.refresh_lounge_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
begin
  v_post_id := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
  update public.lounge_posts
  set comment_count = (
    select count(*)::integer from public.lounge_post_comments
    where post_id = v_post_id and hidden_at is null
  )
  where id = v_post_id;
  return null;
end;
$$;

drop trigger if exists refresh_lounge_post_comment_count_after_comment on public.lounge_post_comments;
create trigger refresh_lounge_post_comment_count_after_comment
after insert or update of hidden_at or delete on public.lounge_post_comments
for each row execute function public.refresh_lounge_post_comment_count();

create or replace function public.hide_lounge_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment_profile_id uuid;
  v_post_profile_id uuid;
  v_allowed boolean;
begin
  select c.profile_id, p.profile_id
  into v_comment_profile_id, v_post_profile_id
  from public.lounge_post_comments c
  join public.lounge_posts p on p.id = c.post_id
  where c.id = p_comment_id;

  if v_comment_profile_id is null then
    raise exception 'Comment not found';
  end if;

  select exists (
    select 1 from public.profiles
    where id in (v_comment_profile_id, v_post_profile_id)
      and user_id = auth.uid()
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Not authorized to hide this comment';
  end if;

  update public.lounge_post_comments set hidden_at = now() where id = p_comment_id;
end;
$$;

revoke all on function public.hide_lounge_comment(uuid) from public;
grant execute on function public.hide_lounge_comment(uuid) to authenticated;
