-- Comments on public Exhibitions.
--
-- Moderation rule (per your answer): a comment's author can hide their own
-- comment, and the exhibition's owner can also hide any comment left on
-- their own exhibition. "Hide" rather than hard-delete, so there's a trail
-- if it's ever needed - hidden comments just stop being publicly visible.
--
-- Both moderation paths go through hide_comment() below instead of a raw
-- UPDATE policy, specifically so neither an author nor an exhibition owner
-- can use "permission to hide" as a backdoor to edit someone else's comment
-- text - the function only ever touches hidden_at, nothing else.
--
-- BEFORE RUNNING: verify galleries.id's actual type in Supabase Studio
-- (Table Editor or the same information_schema query you ran for
-- vault_items/profiles). This assumes uuid, matching how gallery ids are
-- generated in code (crypto.randomUUID()). If it's actually text, change
-- `exhibition_id uuid` below to `exhibition_id text` before running.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.galleries(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  hidden_at timestamptz
);

create index if not exists comments_exhibition_id_idx on public.comments(exhibition_id);
create index if not exists comments_author_id_idx on public.comments(author_id);

alter table public.comments enable row level security;

-- Anyone can read comments that haven't been hidden.
create policy "Visible comments are publicly readable"
  on public.comments for select
  using (hidden_at is null);

-- A user can post a comment as one of their own profiles.
create policy "Users can comment as their own profile"
  on public.comments for insert
  with check (
    author_id in (select id from public.profiles where user_id = auth.uid())
  );

-- No direct UPDATE/DELETE policy on purpose - moderation only happens
-- through hide_comment() below, which runs as the function owner (security
-- definer) and only ever sets hidden_at.
create or replace function public.hide_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exhibition_id uuid;
  v_author_id uuid;
  v_is_author boolean;
  v_is_owner boolean;
begin
  select exhibition_id, author_id into v_exhibition_id, v_author_id
  from public.comments where id = p_comment_id;

  if v_exhibition_id is null then
    raise exception 'Comment not found';
  end if;

  select exists (
    select 1 from public.profiles
    where id = v_author_id and user_id = auth.uid()
  ) into v_is_author;

  select exists (
    select 1 from public.galleries g
    join public.profiles p on p.id = g.profile_id
    where g.id = v_exhibition_id and p.user_id = auth.uid()
  ) into v_is_owner;

  if not (v_is_author or v_is_owner) then
    raise exception 'Not authorized to hide this comment';
  end if;

  update public.comments set hidden_at = now() where id = p_comment_id;
end;
$$;
