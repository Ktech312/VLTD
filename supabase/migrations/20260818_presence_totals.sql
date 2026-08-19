-- Cumulative usage tracking, on top of the existing presence columns.
-- last_seen_at / session_started_at (20260711_presence.sql) only describe
-- the CURRENT session — they get overwritten each time a new session starts,
-- so there was no way to show a real "average session length" or "total time
-- on the app" without inventing numbers. This adds real running totals.
--
-- total_seconds_online: accumulated across every heartbeat, ever.
-- session_count:        incremented each time a new session starts (i.e.
--                        the same moments session_started_at resets).
-- Average session length = total_seconds_online / session_count.

alter table public.profiles
  add column if not exists total_seconds_online bigint not null default 0,
  add column if not exists session_count         integer not null default 0;

-- Replaces the 20260711_presence.sql version of touch_presence: same
-- session-reset logic, plus accumulates elapsed time into the running
-- totals. The per-heartbeat delta is capped at 3x the client's heartbeat
-- interval (60s, see PresenceHeartbeat.tsx) so a late/stale heartbeat can't
-- inflate the total.
create or replace function public.touch_presence(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_seen timestamptz;
  v_is_new_session boolean;
  v_elapsed_seconds integer;
begin
  select last_seen_at into v_last_seen
  from public.profiles
  where id = p_profile_id and user_id = auth.uid();

  v_is_new_session := v_last_seen is null or v_last_seen < now() - interval '10 minutes';
  v_elapsed_seconds := case
    when v_is_new_session then 0
    else least(180, greatest(0, extract(epoch from (now() - v_last_seen))::integer))
  end;

  update public.profiles
  set
    session_started_at = case when v_is_new_session then now() else session_started_at end,
    session_count = session_count + (case when v_is_new_session then 1 else 0 end),
    total_seconds_online = total_seconds_online + v_elapsed_seconds,
    last_seen_at = now()
  where id = p_profile_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.touch_presence(uuid) to authenticated;
