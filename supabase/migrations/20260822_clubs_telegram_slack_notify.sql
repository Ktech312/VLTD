-- ─────────────────────────────────────────────────────────────
-- Clubs → Telegram + Slack. Both free, no approval process (unlike
-- Reddit's new manual-review gate) -- same shape as Discord: the
-- credential itself (a bot token, or a webhook URL) is enough to post,
-- so Postgres calls the platform directly via pg_net, no Next.js route
-- or shared secret needed for either.
--
-- Extends club_integrations (already owner-only RLS from
-- 20260822_clubs.sql -- adding columns to an existing table doesn't need
-- new policies, the existing "Owner manages their club integrations"
-- policy already covers the whole row).
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

alter table public.club_integrations
  add column if not exists telegram_bot_token text,
  add column if not exists telegram_chat_id text,
  add column if not exists slack_webhook_url text;

create extension if not exists pg_net;

-- ── Telegram ───────────────────────────────────────────────────
-- The bot token goes in the URL path itself (Telegram's own convention --
-- same "the URL is the credential" shape as a Discord webhook), so no
-- separate Authorization header is needed either.
create or replace function public.notify_telegram_on_new_club_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot_token text;
  v_chat_id text;
  v_club_name text;
  v_author_name text;
begin
  select telegram_bot_token, telegram_chat_id into v_bot_token, v_chat_id
  from public.club_integrations
  where club_id = new.club_id;

  if v_bot_token is null or v_bot_token = '' or v_chat_id is null or v_chat_id = '' then
    return new;
  end if;

  select name into v_club_name from public.clubs where id = new.club_id;
  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'A collector')
    into v_author_name
  from public.profiles where id = new.profile_id;

  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_bot_token || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'chat_id', v_chat_id,
      'text', format(
        '%s posted in %s:%s%s%s%shttps://vltd.vercel.app/clubs/%s',
        v_author_name, coalesce(v_club_name, 'a VLTD club'), chr(10), chr(10),
        left(new.body, 1500), chr(10) || chr(10), new.club_id
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_telegram_on_new_club_post on public.club_posts;
create trigger trg_notify_telegram_on_new_club_post
  after insert on public.club_posts
  for each row execute function public.notify_telegram_on_new_club_post();

-- ── Slack ──────────────────────────────────────────────────────
-- Slack incoming webhooks work exactly like Discord's -- the URL is the
-- credential, plain JSON POST, no auth header.
create or replace function public.notify_slack_on_new_club_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_webhook_url text;
  v_club_name text;
  v_author_name text;
begin
  select slack_webhook_url into v_webhook_url
  from public.club_integrations
  where club_id = new.club_id;

  if v_webhook_url is null or v_webhook_url = '' then
    return new;
  end if;

  select name into v_club_name from public.clubs where id = new.club_id;
  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'A collector')
    into v_author_name
  from public.profiles where id = new.profile_id;

  perform net.http_post(
    url := v_webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'text', format(
        '*%s* posted in *%s*:%s%s%s%shttps://vltd.vercel.app/clubs/%s',
        v_author_name, coalesce(v_club_name, 'a VLTD club'), chr(10), chr(10),
        left(new.body, 1500), chr(10) || chr(10), new.club_id
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_slack_on_new_club_post on public.club_posts;
create trigger trg_notify_slack_on_new_club_post
  after insert on public.club_posts
  for each row execute function public.notify_slack_on_new_club_post();
