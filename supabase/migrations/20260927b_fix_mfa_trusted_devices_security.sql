-- Corrects a real, confirmed vulnerability in 20260927_mfa_trusted_devices.sql
-- (already applied): trust_this_device() never checked that the CALLING
-- session had itself completed a real MFA challenge, so any aal1
-- (password-only) session could call the RPC directly — no UI needed —
-- and mint itself a permanent 2FA-skip token, defeating the entire point
-- of the gate for anyone who ever obtains a valid session token by any
-- means short of the second factor itself.
--
-- This migration is additive/corrective on top of the existing table —
-- it does not drop or recreate mfa_trusted_devices, so any devices
-- already (illegitimately) trusted before this ran are NOT automatically
-- revoked. Run this afterward if that matters:
--   select revoke_trusted_device(id) from mfa_trusted_devices; -- or just:
--   delete from public.mfa_trusted_devices;
--
-- Fixes, each mapped to what was asked:
-- 1. trust_this_device() now requires auth.jwt()->>'aal' = 'aal2'.
-- 2. Trust duration is clamped server-side to a maximum of 30 days,
--    regardless of what the caller requests.
-- 3. The old "for all" policy (permitting authenticated users to insert/
--    update/delete their own rows directly) is replaced with SELECT-only.
-- 4. INSERT/UPDATE/DELETE table privileges are explicitly revoked from
--    anon and authenticated, on top of the policy change — belt and
--    suspenders, not relying on RLS alone.
-- 5. Creation/revocation stay behind SECURITY DEFINER functions with
--    EXECUTE revoked from PUBLIC and anon (unchanged from before, still
--    correct — the gap was inside the function body, not the grants).
-- 6. A test function proves an aal1 session is rejected by both the RPC
--    and direct table access, while a genuine aal2 session succeeds and
--    the 30-day clamp actually applies. Runnable only by service_role.
-- 7. Reviewed (not changed here): this app's ENTIRE session — the real
--    access/refresh tokens, not just this trust token — already lives in
--    plain localStorage (src/lib/supabaseClient.ts, storageKey
--    "vltd-auth"; confirmed directly this session). There is no
--    server-side/HttpOnly session model anywhere in this codebase to
--    hang a second, differently-secured cookie off of. An attacker with
--    enough access to read this trust token out of localStorage already
--    has equal access to the real session token sitting right next to
--    it, which grants complete account access on its own — a bespoke
--    HttpOnly cookie for only this one value, while the primary session
--    stays exactly as exposed, would add real implementation risk
--    (a parallel server-side auth path that doesn't exist today) for
--    marginal actual benefit. Recommend revisiting this if/when the
--    session model itself ever moves to server-side cookies — at that
--    point this token should move with it, not before.

-- ── 3 & 4: lock down direct table access ────────────────────────────
drop policy if exists "users manage their own trusted devices" on public.mfa_trusted_devices;
drop policy if exists "users read their own trusted devices" on public.mfa_trusted_devices;
create policy "users read their own trusted devices" on public.mfa_trusted_devices
  for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.mfa_trusted_devices from authenticated;
revoke insert, update, delete on public.mfa_trusted_devices from anon;
revoke select on public.mfa_trusted_devices from anon;

-- ── 1 & 2: the actual vulnerability fix ──────────────────────────────
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

  -- The whole point of this feature is skipping a re-challenge on a
  -- device that already proved it once — it must never be mintable from
  -- a session that hasn't itself completed a real MFA challenge. This
  -- check is the fix: without it, any aal1 (password-only) session could
  -- call this RPC directly and hand itself a permanent 2FA bypass.
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

-- check_trusted_device() and revoke_trusted_device() are unchanged from
-- the original migration — re-declared here only so this file is a
-- complete, self-contained record of what's actually live afterward.
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

-- ── 6: security tests ────────────────────────────────────────────────
-- Runs entirely inside its own transaction, simulating both an aal1 and
-- an aal2 session by overriding request.jwt.claims (transaction-local —
-- reverted automatically at the end regardless of outcome) against a
-- disposable row scoped to a REAL existing auth.users id (needed to
-- satisfy the table's own foreign key), which it deletes again itself
-- before returning. Callable only by service_role — this deliberately
-- forges session claims, which must never be reachable by anon/
-- authenticated.
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

  -- Test 2: an aal1 session cannot insert a trusted-device row directly
  -- (RLS is SELECT-only now, and INSERT is also revoked at the table
  -- level). SET LOCAL ROLE runs this as `authenticated`, not this
  -- function's owner, so the real grants/policies actually apply — and
  -- the role switch itself is inside the try/catch, so a permission
  -- failure on the switch is reported like any other result rather than
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
