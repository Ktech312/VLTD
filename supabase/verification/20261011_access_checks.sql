-- Access checks for Museum Alpha (owner only) and the 3D Gallery (approved only).
-- READ-ONLY: it changes nothing that stays. The one test that tries to change a profile is undone before
-- it finishes. Run it in the Supabase SQL editor after both 20261011 migrations, then send the table
-- it returns (one row per check) to the designer.
--
-- It tests each kind of visitor by pretending to be them inside the database:
--   signed-out, an unapproved user, an approved 3D user, a non-owner admin, and the owner.
-- If this database has no example of a kind of user (for example no non-owner admin), that check says
-- NOT VERIFIED instead of passing.

create temp table if not exists access_checks (
  n serial primary key,
  who text,
  what text,
  expected text,
  actual text,
  result text
);
truncate access_checks;

do $$
declare
  v_owner constant text := 'eck1679@gmail.com';
  v_admin_email text;
  v_unapproved uuid;
  v_approved uuid;
  v_cnt bigint;
  v_bool boolean;
  v_orig boolean;
  v_after boolean;
  t text;
  tbls text[] := array['museum_campus_config','museum_spotlight_programs','museum_store_items','museum_room_items','museum_room_meta'];
  persona record;
begin
  select email into v_admin_email
    from public.user_roles
   where coalesce(role, '') <> 'owner' and lower(email) <> lower(v_owner)
   limit 1;
  select id into v_unapproved from public.profiles where museum_beta_enabled = false limit 1;
  select id into v_approved from public.profiles where museum_beta_enabled = true limit 1;

  -- ── Table reads, for each kind of visitor ────────────────────────────────
  for persona in
    select * from (values
      ('signed-out', null::text),
      ('unapproved user', 'someone-else@example.com'),
      ('approved 3D user', 'approved-3d-user@example.com'),
      ('non-owner admin', v_admin_email)
    ) as x(who, email)
  loop
    if persona.who = 'non-owner admin' and persona.email is null then
      insert into access_checks(who, what, expected, actual, result)
      values (persona.who, 'read the 5 Museum Alpha tables', '0 rows', 'no non-owner admin exists in user_roles', 'NOT VERIFIED');
      continue;
    end if;

    foreach t in array tbls loop
      begin
        if persona.email is null then
          perform set_config('request.jwt.claims', '', true);
          set local role anon;
        else
          perform set_config('request.jwt.claims',
            json_build_object('role','authenticated','email',persona.email,'sub',gen_random_uuid())::text, true);
          set local role authenticated;
        end if;
        execute format('select count(*) from public.%I', t) into v_cnt;
        reset role;
        insert into access_checks(who, what, expected, actual, result)
        values (persona.who, 'read ' || t, '0 rows', v_cnt || ' rows', case when v_cnt = 0 then 'PASS' else 'FAIL' end);
      exception when insufficient_privilege then
        reset role;
        insert into access_checks(who, what, expected, actual, result)
        values (persona.who, 'read ' || t, '0 rows or denied', 'access denied', 'PASS');
      end;
    end loop;
  end loop;

  -- ── Owner function, for each kind of visitor ─────────────────────────────
  for persona in
    select * from (values
      ('unapproved user', 'someone-else@example.com', false),
      ('approved 3D user', 'approved-3d-user@example.com', false),
      ('non-owner admin', v_admin_email, false),
      ('owner', v_owner, true)
    ) as x(who, email, want)
  loop
    if persona.email is null then
      insert into access_checks(who, what, expected, actual, result)
      values (persona.who, 'is_vltd_owner()', persona.want::text, 'no such user to test', 'NOT VERIFIED');
      continue;
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('role','authenticated','email',persona.email,'sub',gen_random_uuid())::text, true);
    set local role authenticated;
    select public.is_vltd_owner() into v_bool;
    reset role;
    insert into access_checks(who, what, expected, actual, result)
    values (persona.who, 'is_vltd_owner()', persona.want::text, v_bool::text, case when v_bool = persona.want then 'PASS' else 'FAIL' end);
  end loop;

  -- ── 3D Gallery approval: who counts as approved ──────────────────────────
  if v_unapproved is null then
    insert into access_checks(who, what, expected, actual, result)
    values ('unapproved user', 'has_3d_gallery_access(unapproved profile)', 'false', 'no unapproved profile exists', 'NOT VERIFIED');
  else
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email','someone-else@example.com','sub',gen_random_uuid())::text, true);
    set local role authenticated;
    select public.has_3d_gallery_access(v_unapproved) into v_bool;
    reset role;
    insert into access_checks(who, what, expected, actual, result)
    values ('unapproved user', 'has_3d_gallery_access(unapproved profile)', 'false', v_bool::text, case when v_bool = false then 'PASS' else 'FAIL' end);
  end if;

  if v_approved is null then
    insert into access_checks(who, what, expected, actual, result)
    values ('approved 3D user', 'has_3d_gallery_access(approved profile)', 'true', 'no approved profile exists yet', 'NOT VERIFIED');
  else
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','email','approved-3d-user@example.com','sub',gen_random_uuid())::text, true);
    set local role authenticated;
    select public.has_3d_gallery_access(v_approved) into v_bool;
    reset role;
    insert into access_checks(who, what, expected, actual, result)
    values ('approved 3D user', 'has_3d_gallery_access(approved profile)', 'true', v_bool::text, case when v_bool = true then 'PASS' else 'FAIL' end);
  end if;

  -- ── Who can switch museum_beta_enabled (each attempt is undone) ───────────
  if v_unapproved is null then
    insert into access_checks(who, what, expected, actual, result)
    values ('all', 'try to approve a profile for 3D', 'n/a', 'no unapproved profile to try on', 'NOT VERIFIED');
  else
    select museum_beta_enabled into v_orig from public.profiles where id = v_unapproved;

    for persona in
      select * from (values
        ('non-owner admin', v_admin_email, false),
        ('owner', v_owner, true)
      ) as x(who, email, can_change)
    loop
      if persona.email is null then
        insert into access_checks(who, what, expected, actual, result)
        values (persona.who, 'set museum_beta_enabled', 'unchanged', 'no non-owner admin exists in user_roles', 'NOT VERIFIED');
        continue;
      end if;
      v_after := v_orig;
      begin
        perform set_config('request.jwt.claims',
          json_build_object('role','authenticated','email',persona.email,'sub',gen_random_uuid())::text, true);
        set local role authenticated;
        update public.profiles set museum_beta_enabled = true where id = v_unapproved;
        select museum_beta_enabled into v_after from public.profiles where id = v_unapproved;
        raise exception 'undo this test change';
      exception when others then
        null;
      end;
      reset role;
      insert into access_checks(who, what, expected, actual, result)
      values (
        persona.who,
        'set museum_beta_enabled (undone afterwards)',
        case when persona.can_change then 'changes to true' else 'stays ' || v_orig::text end,
        'after attempt: ' || coalesce(v_after::text, 'null'),
        case when persona.can_change then (case when v_after = true then 'PASS' else 'FAIL (or the owner is not allowed to update this row)' end)
             else (case when v_after = v_orig then 'PASS' else 'FAIL' end) end
      );
    end loop;

    select museum_beta_enabled into v_after from public.profiles where id = v_unapproved;
    insert into access_checks(who, what, expected, actual, result)
    values ('(cleanup)', 'profile unchanged after the tests', v_orig::text, v_after::text, case when v_after = v_orig then 'PASS' else 'FAIL' end);
  end if;

  -- ── Policies and triggers as they are right now ──────────────────────────
  insert into access_checks(who, what, expected, actual, result)
  select 'live policies', c.relname, 'no public read policy; owner policy present',
         coalesce(string_agg(p.polname || ' [' || p.polcmd::text || ']', ', ' order by p.polname), 'none'),
         case when bool_or(p.polname ilike 'Public can read%') then 'FAIL' when count(p.polname) = 0 then 'FAIL' else 'PASS' end
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    left join pg_policy p on p.polrelid = c.oid
   where c.relname = any (tbls)
   group by c.relname;

  insert into access_checks(who, what, expected, actual, result)
  select 'live trigger', 'protect_profile_billing_columns is owner-checked', 'contains the owner check',
         case when pg_get_functiondef(f.oid) ilike '%is_vltd_owner%' then 'yes' else 'no' end,
         case when pg_get_functiondef(f.oid) ilike '%is_vltd_owner%' then 'PASS' else 'FAIL' end
    from pg_proc f join pg_namespace n on n.oid = f.pronamespace and n.nspname = 'public'
   where f.proname = 'protect_profile_billing_columns';

  insert into access_checks(who, what, expected, actual, result)
  select 'live policies', 'virtual_rooms ' || p.polname, 'insert/update need 3D approval',
         p.polcmd::text,
         case when p.polcmd in ('a','w') and pg_get_expr(coalesce(p.polwithcheck, p.polqual), p.polrelid) ilike '%has_3d_gallery_access%' then 'PASS'
              when p.polcmd in ('a','w') then 'FAIL' else 'info' end
    from pg_policy p join pg_class c on c.oid = p.polrelid and c.relname = 'virtual_rooms';

  insert into access_checks(who, what, expected, actual, result)
  values ('signed-out / any visitor', 'billing columns (tier, stripe, scan limits)', 'unchanged behaviour', 'not changed by these migrations; not re-tested here', 'NOT VERIFIED');
end $$;

select n, who, what, expected, actual, result from access_checks order by n;
