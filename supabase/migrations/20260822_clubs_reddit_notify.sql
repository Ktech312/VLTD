-- ─────────────────────────────────────────────────────────────
-- Clubs → Reddit (phase 3 of 3, EK's ask). Cross-posts a new club
-- discussion post to that club's configured subreddit, if the owner has
-- set one up.
--
-- Unlike Discord (a webhook URL that Postgres can call directly), Reddit
-- requires real OAuth -- there's no way around a server-side round trip,
-- so this follows the EXACT same shape as the existing DM push-
-- notification trigger (20260821_push_notifications.sql /
-- 20260821_push_secret_to_vault.sql): the secret lives in Supabase Vault,
-- never hardcoded in a migration file (that mistake already happened once
-- with the push secret and had to be remediated -- not repeating it).
--
-- Before running this migration, run this in the SQL editor first (value
-- given separately in chat, never committed to a file):
--   select vault.create_secret('<the value from chat>', 'clubs_internal_secret');
-- And set the matching CLUBS_INTERNAL_SECRET env var in Vercel to the same
-- value, plus the real Reddit credentials -- see
-- src/app/api/clubs/notify-reddit/route.ts's header comment for the full
-- list of what's needed there.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

create extension if not exists supabase_vault;
create extension if not exists pg_net;

create or replace function public.notify_reddit_on_new_club_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subreddit text;
  v_secret text;
  v_club_name text;
  v_author_name text;
begin
  select reddit_subreddit into v_subreddit
  from public.club_integrations
  where club_id = new.club_id;

  if v_subreddit is null or v_subreddit = '' then
    return new;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'clubs_internal_secret'
  limit 1;

  -- Not configured yet -- fail quiet, same reasoning as the push trigger:
  -- a club post should never fail to save just because cross-posting
  -- can't go out.
  if v_secret is null then
    return new;
  end if;

  select name into v_club_name from public.clubs where id = new.club_id;
  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'A collector')
    into v_author_name
  from public.profiles where id = new.profile_id;

  perform net.http_post(
    url := 'https://vltd.vercel.app/api/clubs/notify-reddit',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'subreddit', v_subreddit,
      'title', format('%s (from %s on VLTD)', v_author_name, coalesce(v_club_name, 'a VLTD club')),
      'body', format('%s%s%shttps://vltd.vercel.app/clubs/%s', new.body, chr(10), chr(10), new.club_id)
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_reddit_on_new_club_post on public.club_posts;
create trigger trg_notify_reddit_on_new_club_post
  after insert on public.club_posts
  for each row execute function public.notify_reddit_on_new_club_post();
