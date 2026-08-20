-- Real bug found live-testing the new compose flow: accounts can own more
-- than one profiles row (profile_type personal/business — see
-- src/lib/auth.ts listMyProfiles/getStoredActiveProfileId), and
-- get_or_create_conversation / mark_conversation_read each resolved "the
-- caller's profile" with an unscoped
--   select id into v_profile_id from public.profiles where user_id = auth.uid()
-- which is ambiguous for a multi-profile account -- plpgsql just takes
-- whichever row postgres returns first, with no guarantee it matches the
-- profile the client is actually acting as (getStoredActiveProfileId()).
--
-- Symptom confirmed live: starting a conversation from the new compose
-- panel returned a real conversation id and opened it immediately, but the
-- conversation never appeared in a fresh listConversations() call (e.g.
-- after reload) -- because it had been created under a DIFFERENT profile_a/
-- profile_b pair than the client's active profile filters by.
--
-- Fix: both functions now take the caller's profile id as an explicit
-- parameter (same pattern direct_messages INSERT / sendMessage already
-- uses), and verify it actually belongs to auth.uid() instead of guessing.

drop function if exists public.get_or_create_conversation(uuid);

create or replace function public.get_or_create_conversation(p_caller_profile_id uuid, p_other_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if p_caller_profile_id is null or p_other_profile_id is null or p_caller_profile_id = p_other_profile_id then
    return null;
  end if;

  if not exists (
    select 1 from public.profiles where id = p_caller_profile_id and user_id = auth.uid()
  ) then
    return null;
  end if;

  if p_caller_profile_id < p_other_profile_id then
    v_a := p_caller_profile_id; v_b := p_other_profile_id;
  else
    v_a := p_other_profile_id; v_b := p_caller_profile_id;
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

grant execute on function public.get_or_create_conversation(uuid, uuid) to authenticated;

drop function if exists public.mark_conversation_read(uuid);

create or replace function public.mark_conversation_read(p_caller_profile_id uuid, p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_caller_profile_id is null then
    return;
  end if;

  if not exists (
    select 1 from public.profiles where id = p_caller_profile_id and user_id = auth.uid()
  ) then
    return;
  end if;

  update public.direct_messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and sender_profile_id <> p_caller_profile_id
    and read_at is null
    and conversation_id in (
      select id from public.conversations
      where profile_a_id = p_caller_profile_id or profile_b_id = p_caller_profile_id
    );
end;
$$;

grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;
