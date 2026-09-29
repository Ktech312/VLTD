-- Corrects test_mfa_trusted_device_security() from 20260927c. This file
-- was never actually run (confirmed — the blocker it was meant to fix was
-- still reported live after it was written), so this replaces its content
-- outright rather than adding yet another corrective migration on top of
-- an unapplied one. 20260927c itself (the table, RLS, trust_this_device(),
-- check_trusted_device(), revoke_trusted_device()) is untouched here and
-- must not be re-run or modified — this migration only ever
-- CREATE OR REPLACEs this one test function.
--
-- Two independent problems in the original test function, fixed together:
--
-- 1. "cannot set parameter 'role' within security-definer function" —
--    Postgres hard-blocks SET ROLE inside any SECURITY DEFINER function
--    body, full stop. Fixed by making the function SECURITY INVOKER
--    instead — it is granted to service_role only, which already has more
--    than enough privilege running as itself (bypasses RLS, can read
--    auth.users, can query any role's grants) without needing an owner
--    identity.
--
-- 2. The direct-insert test itself was the wrong shape even before the
--    SET ROLE error, independent of problem 1: SET ROLE authenticated
--    changes the POSTGRES ROLE's grant-level privileges, but this table's
--    RLS (and Supabase auth generally) key off auth.uid()/auth.jwt(),
--    which are driven by the request.jwt.claims GUC — not by the bare
--    role name. A SET-ROLE-based test proves less than it looks like it
--    does, and needs careful role-bouncing (reset role in both the
--    success and exception paths) to avoid leaking role state into later
--    tests. Replaced with static catalog assertions that check the actual
--    security model directly instead of trying to simulate a request:
--    does authenticated or anon hold a real INSERT/UPDATE/DELETE grant on
--    the table (has_table_privilege), and does any RLS policy exist that
--    could permit a mutation at all (pg_policies), for either role. Zero
--    side effects, nothing to reset.
--
-- Every other test (aal1 blocked via the RPC, aal2 succeeds via the RPC
-- with the 30-day clamp applied, full cleanup) is unchanged from
-- 20260927c.

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
  v_role text;
  v_priv text;
  v_has_priv boolean;
  v_policy_count integer;
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

  -- Test 2 (replaced — see header): static catalog assertions instead of
  -- SET LOCAL ROLE. Six privilege checks (INSERT/UPDATE/DELETE x
  -- authenticated/anon), each its own reported row.
  foreach v_role in array array['authenticated', 'anon'] loop
    foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE'] loop
      v_has_priv := has_table_privilege(v_role, 'public.mfa_trusted_devices', v_priv);
      return query select
        ('no_' || lower(v_priv) || '_priv_' || v_role)::text,
        (not v_has_priv),
        case when v_has_priv
          then (v_role || ' unexpectedly holds ' || v_priv || ' on mfa_trusted_devices — vulnerable')
          else (v_role || ' correctly has no ' || v_priv || ' grant')
        end::text;
    end loop;
  end loop;

  -- Plus one policy-existence check: no INSERT/UPDATE/DELETE/ALL-cmd RLS
  -- policy should exist on this table at all, for any role.
  select count(*) into v_policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mfa_trusted_devices'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  return query select 'no_mutation_policy_exists'::text, (v_policy_count = 0),
    case when v_policy_count = 0
      then 'no INSERT/UPDATE/DELETE/ALL-cmd policy exists on mfa_trusted_devices'
      else (v_policy_count || ' mutation-capable RLS policy(ies) found — review needed')
    end::text;

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
