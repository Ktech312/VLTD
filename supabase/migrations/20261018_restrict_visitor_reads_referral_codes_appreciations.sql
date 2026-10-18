-- APPLIED to production by EK on 2026-10-17 and verified there (see HANDOFF.md row 7). Recorded here as the migration that was run.
-- Why and what was checked: docs/proposals/public-data-referral-codes-and-appreciations-2026-10-17.md
-- Run order that was used: 1) supabase/validation/public_data_before_after_checks.sql (BEFORE: showed the exposure)  2) this file  3) the same checks file (AFTER).
-- Safe to run more than once. Changes grants only: no table, policy, row or column is changed or deleted.
--
-- Who gets what afterwards
--   visitors (anon)      referral_codes: nothing.   appreciations: only id and item_id (enough for the public Vibe counts).
--   signed-in (authenticated) and the service key: exactly what they have today (nothing is taken from them).
-- Visitors could be getting access in two ways: a grant made to them directly, or one inherited from PUBLIC (a grant to everybody). Removing only the
-- direct one would leave the inherited one working, so both are removed. Step 0 first gives signed-in users and the service key their OWN grant of
-- what they hold now, so removing the inherited one cannot take it away from them.

begin;

-- Step 0: keep what signed-in users and the service key can read today, as a grant of their own.
do $$
declare
  t text;
  r text;
begin
  foreach t in array array['public.referral_codes', 'public.appreciations'] loop
    foreach r in array array['authenticated', 'service_role'] loop
      if has_table_privilege(r, t, 'select') then
        execute format('grant select on %s to %I', t, r);
      end if;
    end loop;
  end loop;
end
$$;

-- Step 1: referral_codes. No feature reads it as a visitor (the invite page and admin page are signed in; redeeming is signed in and not used yet).
revoke select on public.referral_codes from public;
revoke select on public.referral_codes from anon;

-- Step 2: appreciations. Visitors keep only what the public Vibe counts use.
revoke select on public.appreciations from public;
revoke select on public.appreciations from anon;
grant select (id, item_id) on public.appreciations to anon;

commit;

-- UNDO (restores the earlier, wider access):
--   grant select on public.referral_codes to anon;
--   grant select on public.appreciations to anon;
