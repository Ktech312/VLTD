-- Real backend for the VLT Lounge's "Ask the Lounge" / "Post Update" buttons
-- and the "Lounge Live" feed. Mirrors the comments.sql pattern (visible-only
-- select, insert-as-your-own-profile, hide via a security-definer function
-- rather than a raw UPDATE policy so "permission to hide" can't become a
-- backdoor to edit someone else's post).

create table if not exists public.lounge_posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('question', 'update')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  hidden_at timestamptz
);

create index if not exists lounge_posts_created_at_idx on public.lounge_posts(created_at desc);
create index if not exists lounge_posts_profile_id_idx on public.lounge_posts(profile_id);

alter table public.lounge_posts enable row level security;

-- Anyone can read posts that haven't been hidden.
create policy "Visible lounge posts are publicly readable"
  on public.lounge_posts for select
  using (hidden_at is null);

-- A user can post as one of their own profiles.
create policy "Users can post to the Lounge as their own profile"
  on public.lounge_posts for insert
  with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
  );

-- No direct UPDATE/DELETE policy on purpose - moderation only through
-- hide_lounge_post() below, which only ever sets hidden_at.
create or replace function public.hide_lounge_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_is_author boolean;
begin
  select profile_id into v_profile_id
  from public.lounge_posts where id = p_post_id;

  if v_profile_id is null then
    raise exception 'Post not found';
  end if;

  select exists (
    select 1 from public.profiles
    where id = v_profile_id and user_id = auth.uid()
  ) into v_is_author;

  if not v_is_author then
    raise exception 'Not authorized to hide this post';
  end if;

  update public.lounge_posts set hidden_at = now() where id = p_post_id;
end;
$$;
