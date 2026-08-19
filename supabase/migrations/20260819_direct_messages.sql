-- Real 1:1 direct messaging. Replaces the "Inbox coming soon" placeholder
-- on /messages and the stubbed chat-icon link in TopNav (both explicitly
-- left as "wired later" comments in the code).

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  profile_a_id uuid not null references public.profiles(id) on delete cascade,
  profile_b_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_distinct_participants check (profile_a_id <> profile_b_id),
  -- Canonical ordering (a < b) enforced by get_or_create_conversation below,
  -- so this unique constraint guarantees exactly one conversation per pair.
  unique (profile_a_id, profile_b_id)
);

create index if not exists idx_conversations_a on public.conversations (profile_a_id, last_message_at desc);
create index if not exists idx_conversations_b on public.conversations (profile_b_id, last_message_at desc);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_direct_messages_conversation on public.direct_messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;

-- A profile can only see conversations it's a participant in.
create policy "read own conversations" on public.conversations
  for select
  using (
    profile_a_id in (select id from public.profiles where user_id = auth.uid())
    or profile_b_id in (select id from public.profiles where user_id = auth.uid())
  );

-- A profile can only see messages in a conversation it's a participant in.
create policy "read own conversation messages" on public.direct_messages
  for select
  using (
    conversation_id in (
      select id from public.conversations
      where profile_a_id in (select id from public.profiles where user_id = auth.uid())
         or profile_b_id in (select id from public.profiles where user_id = auth.uid())
    )
  );

-- Sending: the sender must own the profile AND be a participant in the
-- target conversation.
create policy "send own messages" on public.direct_messages
  for insert
  with check (
    sender_profile_id in (select id from public.profiles where user_id = auth.uid())
    and conversation_id in (
      select id from public.conversations
      where profile_a_id in (select id from public.profiles where user_id = auth.uid())
         or profile_b_id in (select id from public.profiles where user_id = auth.uid())
    )
  );

-- Marking read: only the RECIPIENT (not the sender) can mark a message
-- read, and only read_at may change — mirrors the "moderation only via a
-- SECURITY DEFINER function" pattern used elsewhere (hide_lounge_post etc.)
-- by keeping this narrow rather than a broad UPDATE policy.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id from public.profiles where user_id = auth.uid();
  if v_profile_id is null then
    return;
  end if;

  update public.direct_messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and sender_profile_id <> v_profile_id
    and read_at is null
    and conversation_id in (
      select id from public.conversations
      where profile_a_id = v_profile_id or profile_b_id = v_profile_id
    );
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Finds or creates the (canonically ordered) conversation between the
-- caller and another profile. SECURITY DEFINER because creating a
-- conversation involves both participants' rows, which a plain INSERT
-- policy on the caller's own auth.uid() can't cleanly express for a
-- two-party unique constraint.
create or replace function public.get_or_create_conversation(p_other_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  select id into v_profile_id from public.profiles where user_id = auth.uid();
  if v_profile_id is null or p_other_profile_id is null or v_profile_id = p_other_profile_id then
    return null;
  end if;

  if v_profile_id < p_other_profile_id then
    v_a := v_profile_id; v_b := p_other_profile_id;
  else
    v_a := p_other_profile_id; v_b := v_profile_id;
  end if;

  select id into v_id from public.conversations where profile_a_id = v_a and profile_b_id = v_b;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.conversations (profile_a_id, profile_b_id)
  values (v_a, v_b)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- Sending also needs last_message_at bumped — a trigger keeps this correct
-- regardless of which client path inserts a message.
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_conversation_on_message on public.direct_messages;
create trigger trg_touch_conversation_on_message
  after insert on public.direct_messages
  for each row execute function public.touch_conversation_on_message();
