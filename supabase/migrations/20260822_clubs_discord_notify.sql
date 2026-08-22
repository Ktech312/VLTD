-- ─────────────────────────────────────────────────────────────
-- Clubs → Discord (phase 2 of 3, EK's ask). Posts a new club discussion
-- post to that club's configured Discord channel, if the owner has set
-- one up.
--
-- Simpler than the existing DM push-notification trigger
-- (20260821_push_notifications.sql): a Discord webhook URL IS the
-- credential (Discord authenticates purely by knowing the URL) and its
-- endpoint accepts a plain JSON POST, so Postgres can call it directly via
-- pg_net -- no intermediate Next.js route, no shared secret to manage or
-- leak. The one thing to protect is the URL itself, which already lives
-- owner-only in club_integrations (see 20260822_clubs.sql) and is never
-- read by this function from anywhere else.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

create extension if not exists pg_net;

create or replace function public.notify_discord_on_new_club_post()
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
  select discord_webhook_url into v_webhook_url
  from public.club_integrations
  where club_id = new.club_id;

  -- No webhook configured for this club -- nothing to do, and a missing
  -- integration should never block the post itself from saving.
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
      'content', format(
        '**%s** posted in **%s**:%s%s%s%shttps://vltd.vercel.app/clubs/%s',
        v_author_name, coalesce(v_club_name, 'a VLTD club'), chr(10), chr(10),
        left(new.body, 1500), chr(10) || chr(10), new.club_id
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_discord_on_new_club_post on public.club_posts;
create trigger trg_notify_discord_on_new_club_post
  after insert on public.club_posts
  for each row execute function public.notify_discord_on_new_club_post();
