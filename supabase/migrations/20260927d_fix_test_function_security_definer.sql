-- Corrects one real error in test_mfa_trusted_device_security() from
-- 20260927c: calling it raised "cannot set parameter 'role' within
-- security-definer function" — Postgres hard-blocks SET ROLE inside any
-- SECURITY DEFINER function body, full stop, regardless of what it's
-- trying to do. The test needs to actually switch to the `authenticated`
-- role for its direct-INSERT check to mean anything (otherwise it would
-- run as the function's owner, which bypasses RLS entirely and would
-- always "pass" without truly testing anything).
--
-- Fix: SECURITY INVOKER instead of DEFINER. This function is granted to
-- service_role only, which already has more than enough privilege on its
-- own (bypasses RLS, can read auth.users, can SET ROLE) to run as itself
-- rather than needing an owner's elevated identity — the restriction
-- only applies to DEFINER functions, not to a service_role caller acting
-- as its own, already-privileged self. Everything else in the migration
-- applied correctly; only this one function's execution mode changes.

create or replace function public.test_mfa_trusted_device_security()
returns table(test_name text, passed boolean, detail text)
language plpgsql
security invoker
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
