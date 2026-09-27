-- "Remember this device" for the global 2FA gate (MfaChallengeGate.tsx).
-- EK's ask: stop asking for a 2FA code on every fresh login on a device
-- that's already proven itself, while still supporting multiple trusted
-- devices at once (a phone and a laptop, say) independently.
--
-- Supabase's own AAL (Authenticator Assurance Level) has no built-in
-- "trust this device" concept — aal2 only exists on a session that just
-- completed a real mfa.verify() call, full stop. This adds an app-level
-- trust record instead: a random token, generated server-side and shown to
-- the client exactly once, stored only in that browser's localStorage.
-- Only its SHA-256 hash is ever persisted here — the raw token never
-- touches this table. A later visit sends the stored token back, gets it
-- hashed and compared, and if it matches an unexpired row for the current
-- user, MfaChallengeGate skips the modal entirely for that visit.
--
-- Deliberately scoped to the GENERAL app gate only. adminAuth.ts's
-- getMyAdminRole() (added after an outside security researcher's
-- disclosure) keeps requiring a real, freshly-verified aal2 session for
-- admin access — trusting a device for everyday use should never also
-- quietly lower the bar for admin actions.

create extension if not exists pgcrypto;

create table if not exists public.mfa_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists mfa_trusted_devices_user_id_idx on public.mfa_trusted_devices(user_id);

alter table public.mfa_trusted_devices enable row level security;

drop policy if exists "users manage their own trusted devices" on public.mfa_trusted_devices;
create policy "users manage their own trusted devices" on public.mfa_trusted_devices
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Called right after a successful mfa.verify(), only when the user opted
-- to remember this device. security definer so it can write regardless of
-- the session's current AAL — the whole point is establishing trust
-- before aal2 exists yet on some future visit.
create or replace function public.trust_this_device(p_label text default null, p_days integer default 30)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_hash text := encode(digest(v_token, 'sha256'), 'hex');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.mfa_trusted_devices (user_id, token_hash, label, expires_at)
  values (auth.uid(), v_hash, p_label, now() + (greatest(p_days, 1) || ' days')::interval);

  return v_token;
end;
$$;

revoke execute on function public.trust_this_device(text, integer) from public;
revoke execute on function public.trust_this_device(text, integer) from anon;
grant execute on function public.trust_this_device(text, integer) to authenticated;

-- Called by MfaChallengeGate before showing the 2FA modal on a session
-- that still needs one. Only ever compares hashes — the stored token
-- itself is never re-derivable from this table.
create or replace function public.check_trusted_device(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_rows integer;
begin
  if auth.uid() is null or p_token is null or p_token = '' then
    return false;
  end if;

  update public.mfa_trusted_devices
    set last_used_at = now()
    where user_id = auth.uid() and token_hash = v_hash and expires_at > now();
  get diagnostics v_rows = row_count;

  return v_rows > 0;
end;
$$;

revoke execute on function public.check_trusted_device(text) from public;
revoke execute on function public.check_trusted_device(text) from anon;
grant execute on function public.check_trusted_device(text) to authenticated;

-- For an Account > Security "trusted devices" list: revoke one (by id) or
-- every trusted device on this account (p_id null) — e.g. after noticing
-- an unrecognized device, or just wanting to force re-verification
-- everywhere.
create or replace function public.revoke_trusted_device(p_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_id is null then
    delete from public.mfa_trusted_devices where user_id = auth.uid();
  else
    delete from public.mfa_trusted_devices where user_id = auth.uid() and id = p_id;
  end if;
end;
$$;

revoke execute on function public.revoke_trusted_device(uuid) from public;
revoke execute on function public.revoke_trusted_device(uuid) from anon;
grant execute on function public.revoke_trusted_device(uuid) to authenticated;
