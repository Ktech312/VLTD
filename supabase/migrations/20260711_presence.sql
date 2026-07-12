-- Presence / usage tracking for profiles.
-- last_seen_at: updated by a client heartbeat while the app is open.
-- session_started_at: start of the current continuous session (resets after idle).

alter table public.profiles
  add column if not exists last_seen_at      timestamptz,
  add column if not exists session_started_at timestamptz;

create index if not exists idx_profiles_last_seen on public.profiles (last_seen_at desc);

-- Heartbeat entry point. SECURITY DEFINER so it can write regardless of the
-- table's RLS, but it only ever touches a profile the caller actually owns.
-- If the profile was idle > 10 min (or brand new), start a fresh session.
create or replace function public.touch_presence(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    session_started_at = case
      when last_seen_at is null or last_seen_at < now() - interval '10 minutes'
        then now()
      else session_started_at
    end,
    last_seen_at = now()
  where id = p_profile_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.touch_presence(uuid) to authenticated;
