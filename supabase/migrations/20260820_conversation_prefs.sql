-- Per-participant conversation preferences: star and hide. Both are
-- personal to each side of a conversation (starring it for yourself
-- shouldn't star it for the other person, and hiding it from your own
-- inbox shouldn't remove it from theirs), so this is a separate table
-- keyed by (profile_id, conversation_id) rather than columns on
-- conversations itself.

create table if not exists public.conversation_prefs (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  starred boolean not null default false,
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (profile_id, conversation_id)
);

alter table public.conversation_prefs enable row level security;

create policy "read own conversation prefs" on public.conversation_prefs
  for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "write own conversation prefs" on public.conversation_prefs
  for all
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

-- A conversation you'd hidden should resurface if new activity happens in
-- it (matches "archive, then a new reply brings it back" behavior most
-- inboxes have) — un-hide for BOTH participants whenever a message is
-- sent, not just the sender's own hidden flag.
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;

  update public.conversation_prefs
  set hidden = false, updated_at = now()
  where conversation_id = new.conversation_id and hidden = true;

  return new;
end;
$$;
