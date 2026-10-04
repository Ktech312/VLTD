-- Fix nested Lounge replies. The original policy's unqualified parent_id and
-- post_id references inside the parent subquery bound to the inner row, so a
-- legitimate reply could never satisfy the check.

drop policy if exists "Users can comment as their own profile" on public.lounge_post_comments;
create policy "Users can comment as their own profile"
  on public.lounge_post_comments for insert
  with check (
    profile_id in (select id from public.profiles where user_id = auth.uid())
    and exists (
      select 1 from public.lounge_posts p
      where p.id = lounge_post_comments.post_id and p.hidden_at is null
    )
    and (
      parent_id is null
      or exists (
        select 1 from public.lounge_post_comments parent
        where parent.id = lounge_post_comments.parent_id
          and parent.post_id = lounge_post_comments.post_id
          and parent.hidden_at is null
      )
    )
  );

-- Hiding a parent comment also hides every reply below it so the visible
-- comment count and rendered thread cannot diverge or leave orphaned replies.
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

  with recursive descendants as (
    select id from public.lounge_post_comments where id = p_comment_id
    union all
    select child.id
    from public.lounge_post_comments child
    join descendants parent on child.parent_id = parent.id
  )
  update public.lounge_post_comments
  set hidden_at = now()
  where id in (select id from descendants)
    and hidden_at is null;
end;
$$;
