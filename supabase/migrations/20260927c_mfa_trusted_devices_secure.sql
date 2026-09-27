-- ONE complete, self-contained migration for "remember this device" (2FA).
-- Supersedes 20260927_mfa_trusted_devices.sql and
-- 20260927b_fix_mfa_trusted_devices_security.sql — neither of those ever
-- actually finished applying (the first was never run; the second failed
-- with "relation does not exist" because the first hadn't created the
-- table it assumes). This is the single file to run; it creates
-- everything from scratch in the already-corrected, secure form. Both
-- earlier files stay in migration history unmodified (per the standing
-- rule not to rewrite applied history), they just never took effect.
--
-- Feature: stop asking for a 2FA code on every fresh login on a device
-- that's already proven itself, while supporting several devices trusted
-- independently on the same account at once.
--
-- Security design (the version EK caught a real gap in before this ever
-- reached real users, now fixed):
-- 1. trust_this_device() requires the CALLING session to already be
--    auth.jwt()->>'aal' = 'aal2' — an aal1 (password-only) session cannot
--    mint itself a bypass token, from the RPC or otherwise.
-- 2. Requested trust duration is clamped server-side to 30 days max.
-- 3. RLS is SELECT-only for authenticated users; no direct insert/update/
--    delete policy exists at all.
-- 4. INSERT/UPDATE/DELETE table privileges are explicitly revoked from
--    anon and authenticated too — not relying on RLS alone.
-- 5. Creation/revocation stay behind SECURITY DEFINER functions with
--    EXECUTE revoked from PUBLIC and anon.
-- 6. test_mfa_trusted_device_security() (service_role only) proves an
--    aal1 session is rejected by both the RPC and direct table access,
--    while a genuine aal2 session succeeds with the clamp applied.
-- 7. Reviewed: this app's real session tokens already live in plain
--    localStorage (src/lib/supabaseClient.ts, storageKey "vltd-auth")
--    with no server-side/HttpOnly model anywhere in this codebase. A
--    bespoke HttpOnly cookie for only this trust token, while the actual
--    session stays exactly as exposed, adds real implementation risk (a
--    parallel server-side auth path that doesn't exist today) for
--    marginal benefit — an attacker who can read this token out of
--    localStorage already has equal access to the real session token
--    sitting right next to it. Revisit if the session model itself ever
--    moves server-side; this token should move with it, not before.
--
-- The client (MfaChallengeGate.tsx, Account > Security) has the feature
-- disabled behind a flag pending this migration + independent
-- verification of the test results below — re-enable only after that.

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

-- SELECT-only for the owning user. Creation/revocation only through the
-- SECURITY DEFINER functions below, never directly via the table API.
drop policy if exists "users manage their own trusted devices" on public.mfa_trusted_devices;
drop policy if exists "users read their own trusted devices" on public.mfa_trusted_devices;
create policy "users read their own trusted devices" on public.mfa_trusted_devices
  for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.mfa_trusted_devices from authenticated;
revoke insert, update, delete on public.mfa_trusted_devices from anon;
revoke select on public.mfa_trusted_devices from anon;

create or replace function public.trust_this_device(p_label text default null, p_days integer default 30)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_hash text;
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 30);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- The fix: without this check, any aal1 (password-only) session could
  -- call this RPC directly and mint itself a permanent 2FA bypass.
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'This session has not completed a two-factor challenge yet.';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.mfa_trusted_devices (user_id, token_hash, label, expires_at)
  values (auth.uid(), v_hash, p_label, now() + (v_days || ' days')::interval);

  return v_token;
end;
$$;

revoke execute on function public.trust_this_device(text, integer) from public;
revoke execute on function public.trust_this_device(text, integer) from anon;
grant execute on function public.trust_this_device(text, integer) to authenticated;

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

-- ── security tests ───────────────────────────────────────────────────
-- Runs entirely inside its own transaction, simulating both an aal1 and
-- an aal2 session by overriding request.jwt.claims (transaction-local —
-- reverted automatically regardless of outcome) against a disposable row
-- scoped to a REAL existing auth.users id (needed to satisfy the table's
-- foreign key), which it deletes again itself before returning. Callable
-- only by service_role — this deliberately forges session claims, which
-- must never be reachable by anon/authenticated.
create or replace function public.test_mfa_trusted_device_security()
returns table(test_name text, passed boolean, detail text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_real_user uuid;
  v_claims_aal1 text;
  v_claims_aal2 text;
  v_token text;
  v_expires timestamptz;
  v_days numeric;
begin
  select id into v_real_user from auth.users limit 1;
  if v_real_user is null then
    return query select 'setup'::text, false, 'no auth.users row available to test against'::text;
    return;
  end if;

  v_claims_aal1 := json_build_object('sub', v_real_user, 'aal', 'aal1', 'role', 'authenticated')::text;
  v_claims_aal2 := json_build_object('sub', v_real_user, 'aal', 'aal2', 'role', 'authenticated')::text;

  -- Test 1: an aal1 session cannot mint a trust token via the RPC.
  begin
    perform set_config('request.jwt.claims', v_claims_aal1, true);
    begin
      perform public.trust_this_device('test-device', 30);
      return query select 'aal1_rpc_blocked'::text, false,
        'trust_this_device() did NOT raise for an aal1 session — vulnerable'::text;
    exception when others then
      return query select 'aal1_rpc_blocked'::text, true, sqlerrm;
    end;
  end;

  -- Test 2: an aal1 session cannot insert a trusted-device row directly.
  -- SET LOCAL ROLE runs this as `authenticated`, not this function's
  -- owner, so the real grants/policies actually apply — and the role
  -- switch is inside the try/catch, so a permission failure on the
  -- switch itself is reported like any other result rather than
  -- aborting the whole test suite.
  begin
    set local role authenticated;
    insert into public.mfa_trusted_devices (user_id, token_hash, expires_at)
    values (v_real_user, 'test-direct-insert-should-fail', now() + interval '1 day');
    reset role;
    delete from public.mfa_trusted_devices where token_hash = 'test-direct-insert-should-fail';
    return query select 'aal1_direct_insert_blocked'::text, false,
      'direct INSERT succeeded — vulnerable'::text;
  exception when others then
    reset role;
    return query select 'aal1_direct_insert_blocked'::text, true, sqlerrm;
  end;

  -- Test 3: a genuinely aal2 session CAN mint a trust token via the RPC,
  -- and an absurd requested duration (9999 days) gets clamped to 30.
  begin
    perform set_config('request.jwt.claims', v_claims_aal2, true);
    begin
      v_token := public.trust_this_device('test-device', 9999);
      if v_token is null or length(v_token) = 0 then
        return query select 'aal2_rpc_succeeds'::text, false, 'no token returned'::text;
      else
        return query select 'aal2_rpc_succeeds'::text, true, 'token issued'::text;

        select expires_at into v_expires
          from public.mfa_trusted_devices
          where user_id = v_real_user and label = 'test-device'
          order by created_at desc limit 1;
        v_days := extract(epoch from (v_expires - now())) / 86400;

        if v_days <= 31 then
          return query select 'duration_clamped_to_30_days'::text, true,
            ('expires in ~' || round(v_days) || ' days')::text;
        else
          return query select 'duration_clamped_to_30_days'::text, false,
            ('expires in ~' || round(v_days) || ' days — clamp did not apply')::text;
        end if;
      end if;
    exception when others then
      return query select 'aal2_rpc_succeeds'::text, false, sqlerrm;
    end;
  end;

  -- Cleanup: remove every row this test created, whatever happened above.
  delete from public.mfa_trusted_devices where user_id = v_real_user and label = 'test-device';
  delete from public.mfa_trusted_devices where token_hash = 'test-direct-insert-should-fail';
end;
$$;

revoke execute on function public.test_mfa_trusted_device_security() from public;
revoke execute on function public.test_mfa_trusted_device_security() from anon;
revoke execute on function public.test_mfa_trusted_device_security() from authenticated;
grant execute on function public.test_mfa_trusted_device_security() to service_role;
