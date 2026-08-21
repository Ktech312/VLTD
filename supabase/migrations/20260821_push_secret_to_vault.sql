-- SECURITY FIX (2026-08-21): the previous migration
-- (20260821_push_notifications.sql) hardcoded PUSH_INTERNAL_SECRET in
-- plain text in the trigger function body -- committed to a PUBLIC repo.
-- An outside security researcher (independently, responsibly) found it,
-- verified the leaked token still authenticated against production, and
-- reported it. No real user was notified (they tested with a nonexistent
-- profile id) but the secret must be treated as permanently compromised.
--
-- Fix: the secret now lives in Supabase Vault -- encrypted at rest,
-- readable only via a SQL function call, and NEVER written into a
-- migration file or anything else committed to git again. Before running
-- this migration, run the one-time vault.create_secret(...) command given
-- separately in chat (deliberately not saved as a file) to store the NEW
-- rotated secret first.

create extension if not exists supabase_vault;

create or replace function public.notify_push_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_id uuid;
  v_sender_name text;
  v_secret text;
begin
  select case when c.profile_a_id = new.sender_profile_id then c.profile_b_id else c.profile_a_id end
    into v_recipient_id
  from public.conversations c
  where c.id = new.conversation_id;

  if v_recipient_id is null then
    return new;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'push_internal_secret'
  limit 1;

  -- Not configured yet (vault secret missing) -- fail quiet. A DM should
  -- never fail to send just because a push notification can't go out.
  if v_secret is null then
    return new;
  end if;

  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'A collector')
    into v_sender_name
  from public.profiles where id = new.sender_profile_id;

  perform net.http_post(
    url := 'https://vltd.vercel.app/api/push/send-internal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'profileId', v_recipient_id,
      'title', coalesce(v_sender_name, 'New message'),
      'body', left(new.body, 120),
      'url', '/messages'
    )
  );

  return new;
end;
$$;
