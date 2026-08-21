-- Web Push for real-time DM notifications, even when VLTD is fully closed
-- (Android/desktop always; iOS 16.4+ after Add to Home Screen). Scoped and
-- confirmed with EK 2026-08-21 before building -- see HANDOFF.md §2.
--
-- pg_net lets a Postgres trigger fire an async HTTP call the instant a
-- direct message is inserted, same shape as the existing
-- touch_conversation_on_message trigger. If this extension isn't available
-- on this project, this statement will fail loudly -- tell me and we'll
-- switch to Supabase's dashboard-configured Database Webhooks instead,
-- same end result.
create extension if not exists pg_net;

-- One row per device/browser a person has enabled notifications on.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists idx_push_subscriptions_profile on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

create policy "read own push subscriptions" on public.push_subscriptions
  for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

create policy "write own push subscriptions" on public.push_subscriptions
  for all
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

-- Fires the instant a DM is sent. Looks up the OTHER participant (the
-- recipient, not the sender), then calls the internal send endpoint --
-- which does the actual push delivery via the web-push library, since
-- Postgres can't speak the Web Push protocol directly.
--
-- NOTE: this function is superseded immediately below by
-- 20260821_push_secret_to_vault.sql, which replaces it with a version
-- that reads the bearer secret from Supabase Vault instead of hardcoding
-- it in SQL. Both migrations must be run, in order.
create or replace function public.notify_push_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_id uuid;
  v_sender_name text;
begin
  select case when c.profile_a_id = new.sender_profile_id then c.profile_b_id else c.profile_a_id end
    into v_recipient_id
  from public.conversations c
  where c.id = new.conversation_id;

  if v_recipient_id is null then
    return new;
  end if;

  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'A collector')
    into v_sender_name
  from public.profiles where id = new.sender_profile_id;

  perform net.http_post(
    url := 'https://vltd.vercel.app/api/push/send-internal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer REPLACED_BY_NEXT_MIGRATION'
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

drop trigger if exists trg_notify_push_on_new_message on public.direct_messages;
create trigger trg_notify_push_on_new_message
  after insert on public.direct_messages
  for each row execute function public.notify_push_on_new_message();
