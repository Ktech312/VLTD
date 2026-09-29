-- Fixes the real failure the corrected security test just caught:
-- trust_this_device() calling gen_random_bytes() raised "function
-- gen_random_bytes(integer) does not exist". Confirmed via
-- debug_pgcrypto_location() (dropped again at the bottom of this file,
-- its job is done): pgcrypto is installed in the `extensions` schema, not
-- `public` -- 20260927c's own `create extension if not exists pgcrypto`
-- landed there (Supabase's own default for new extensions), but every
-- function it defined deliberately sets `search_path = public` (a real,
-- intentional security choice for a SECURITY DEFINER function, not an
-- oversight), so `extensions` was never visible to them.
--
-- Fix: schema-qualify the two pgcrypto calls (extensions.gen_random_bytes,
-- extensions.digest) directly, rather than widening search_path to
-- include `extensions` -- keeps these functions' name resolution exactly
-- as narrow as 20260927c intended, just points the two calls that
-- actually need pgcrypto at its real, known location. `encode()` itself
-- needs no change -- it's a core pg_catalog function, always visible
-- regardless of search_path, not part of pgcrypto.
--
-- Both function bodies are otherwise byte-identical to 20260927c.
-- trust_this_device()'s signature/grants/revokes are unchanged; same for
-- check_trusted_device(). revoke_trusted_device() has no crypto calls and
-- is untouched.

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

  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'This session has not completed a two-factor challenge yet.';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.mfa_trusted_devices (user_id, token_hash, label, expires_at)
  values (auth.uid(), v_hash, p_label, now() + (v_days || ' days')::interval);

  return v_token;
end;
$$;

create or replace function public.check_trusted_device(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
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

-- Diagnostic cleanup — debug_pgcrypto_location() answered its one
-- question (pgcrypto is in `extensions`), same drop-once-served pattern
-- as every other debug_* function in this migration history.
drop function if exists public.debug_pgcrypto_location();
