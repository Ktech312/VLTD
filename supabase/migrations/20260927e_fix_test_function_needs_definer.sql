-- Corrects a real error found by actually invoking 20260927d's function
-- after EK ran it: "permission denied for table users". Root cause: that
-- migration switched test_mfa_trusted_device_security() to SECURITY
-- INVOKER to dodge the original "cannot set parameter role within
-- security-definer function" error, on the assumption that service_role
-- already has direct SELECT access to auth.users on its own grants. It
-- doesn't -- service_role's elevated access to auth.users comes THROUGH
-- SECURITY DEFINER functions owned by a role that has it, not from a
-- direct grant of its own. Running as the literal caller (service_role)
-- via INVOKER lost that access.
--
-- The actual fix is simpler than the INVOKER workaround: 20260927d's
-- rewritten test body no longer contains any SET ROLE / SET LOCAL ROLE
-- statement anywhere (Test 2 was replaced with pure catalog reads --
-- has_table_privilege(), pg_policies -- neither needs a role switch) --
-- so the entire reason for avoiding SECURITY DEFINER no longer applies.
-- Reverting to SECURITY DEFINER restores auth.users access via the
-- function's owner and cannot reintroduce the original error, since
-- there is nothing left in this function body that calls SET ROLE.
--
-- Function body is otherwise byte-identical to 20260927d -- only the
-- security mode changes.

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

  -- Test 2: static catalog assertions (no SET ROLE anywhere in this
  -- function, so SECURITY DEFINER above is safe).
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
