-- Access checks (version 2) for Museum Alpha (owner only), the 3D Gallery (approved only), the private
-- Museum bake storage, and the two separate universe settings.
--
-- Run in the Supabase SQL editor AFTER these are applied:
--   20261011_museum_alpha_owner_and_3d_approval.sql
--   20261011_museum_alpha_owner_only_reads_and_beta_grant.sql
--   20261012_collection_interests_and_displayed_universes.sql
--   20261012_museum_room_bakes_private.sql
-- It returns one table. Send that table back.
--
-- Nothing stays changed. Every test that writes is undone before it finishes, and the last check proves the
-- test profiles are back to how they were.
--
-- How it works: it picks REAL accounts from this database (the owner, a non-owner admin, the owner of an
-- unapproved profile, the owner of an approved profile) and acts as each one with their real user id, so
-- profile memberships match. If a kind of account does not exist here, that check says NOT VERIFIED.
--
-- Results mean:
--   PASS         did what was expected.
--   FAIL         did not. Includes any unexpected error (the error is shown; it is never counted as a pass).
--   INCONCLUSIVE the test could not reach the thing it was meant to test (shown with the reason).
--   NOT VERIFIED there was no account of that kind to test with.
-- "blocked by row permissions" = the database refused or hid the row (0 rows). "approval trigger tested" = the
-- update was allowed through, and the trigger then kept the protected value. They are reported separately.

create temp table if not exists access_checks (
  n serial primary key,
  who text,
  what text,
  expected text,
  rows_affected int,
  actual text,
  result text
);
truncate access_checks;

create or replace function pg_temp.rec(p_who text, p_what text, p_expected text, p_rows int, p_actual text, p_result text)
returns void language sql as $$
  insert into access_checks(who, what, expected, rows_affected, actual, result)
  values (p_who, p_what, p_expected, p_rows, p_actual, p_result);
$$;

create or replace function pg_temp.mask(p_email text) returns text language sql as $$
  select case when p_email is null then null else left(p_email, 2) || '***@' || split_part(p_email, '@', 2) end;
$$;

create or replace function pg_temp.act_as(p_uid uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_uid, 'email', p_email)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end $$;

do $$
declare
  c_owner_email constant text := 'eck1679@gmail.com';
  v_owner_uid uuid;  v_owner_email text;
  v_admin_uid uuid;  v_admin_email text;
  v_unap_profile uuid; v_unap_uid uuid; v_unap_email text;
  v_ap_profile uuid;   v_ap_uid uuid;   v_ap_email text;
  v_cnt bigint;
  v_rows int;
  v_after boolean;
  v_orig_beta boolean;
  v_tier_before text; v_tier_after text;
  v_state text; v_msg text;
  v_a text; v_b text;
  t text;
  tbls text[] := array['museum_campus_config','museum_spotlight_programs','museum_store_items','museum_room_items','museum_room_meta'];
  act record;
  v_room uuid;
begin
  -- ── Real accounts to test with ─────────────────────────────────────────────
  select u.id, u.email into v_owner_uid, v_owner_email
    from auth.users u
   where lower(u.email) = c_owner_email
      or lower(u.email) in (select lower(r.email) from public.user_roles r where r.role = 'owner')
   limit 1;

  select u.id, u.email into v_admin_uid, v_admin_email
    from public.user_roles r
    join auth.users u on lower(u.email) = lower(r.email)
   where coalesce(r.role, '') <> 'owner' and lower(u.email) <> c_owner_email
   limit 1;

  select p.id, u.id, u.email into v_unap_profile, v_unap_uid, v_unap_email
    from public.profiles p
    join public.profile_members m on m.profile_id = p.id and m.role = 'owner'
    join auth.users u on u.id = m.user_id
   where p.museum_beta_enabled = false
     and u.id is distinct from v_owner_uid
     and lower(u.email) not in (select lower(r.email) from public.user_roles r)
   limit 1;

  select p.id, u.id, u.email into v_ap_profile, v_ap_uid, v_ap_email
    from public.profiles p
    join public.profile_members m on m.profile_id = p.id and m.role = 'owner'
    join auth.users u on u.id = m.user_id
   where p.museum_beta_enabled = true
     and u.id is distinct from v_owner_uid
     and lower(u.email) not in (select lower(r.email) from public.user_roles r)
   limit 1;

  perform pg_temp.rec('setup', 'owner account found', 'yes', null, coalesce(pg_temp.mask(v_owner_email), 'none'), case when v_owner_uid is null then 'NOT VERIFIED' else 'PASS' end);
  perform pg_temp.rec('setup', 'non-owner admin account found', 'yes', null, coalesce(pg_temp.mask(v_admin_email), 'none'), case when v_admin_uid is null then 'NOT VERIFIED' else 'PASS' end);
  perform pg_temp.rec('setup', 'unapproved user with a profile found', 'yes', null, coalesce(pg_temp.mask(v_unap_email), 'none'), case when v_unap_uid is null then 'NOT VERIFIED' else 'PASS' end);
  perform pg_temp.rec('setup', 'approved 3D user with a profile found', 'yes', null, coalesce(pg_temp.mask(v_ap_email), 'none (no profile is approved yet)'), case when v_ap_uid is null then 'NOT VERIFIED' else 'PASS' end);

  -- ── A. Reading the Museum Alpha tables and the bake files, as each kind of visitor ──
  for act in
    select * from (values
      ('signed-out',       null::uuid, null::text),
      ('unapproved user',  v_unap_uid, v_unap_email),
      ('approved 3D user', v_ap_uid,   v_ap_email),
      ('non-owner admin',  v_admin_uid, v_admin_email),
      ('owner',            v_owner_uid, v_owner_email)
    ) as x(label, uid, email)
  loop
    if act.label <> 'signed-out' and act.uid is null then
      perform pg_temp.rec(act.label, 'read the 5 Museum Alpha tables and the bake files', case when act.label = 'owner' then 'readable' else '0 rows' end, null, 'no such account to test with', 'NOT VERIFIED');
      continue;
    end if;

    foreach t in array array_cat(tbls, array['storage.objects (museum-room-bakes)']) loop
      v_cnt := null; v_state := null; v_msg := null;
      begin
        if act.label = 'signed-out' then perform pg_temp.act_as_anon(); else perform pg_temp.act_as(act.uid, act.email); end if;
        if t like 'storage.objects%' then
          select count(*) into v_cnt from storage.objects where bucket_id = 'museum-room-bakes';
        else
          execute format('select count(*) from public.%I', t) into v_cnt;
        end if;
      exception when others then
        v_state := sqlstate; v_msg := sqlerrm;
      end;
      reset role;

      if v_state is not null and v_state = '42501' and act.label <> 'owner' then
        perform pg_temp.rec(act.label, 'read ' || t, '0 rows or denied', null, 'denied by permissions (42501)', 'PASS');
      elsif v_state is not null then
        perform pg_temp.rec(act.label, 'read ' || t, case when act.label = 'owner' then 'readable' else '0 rows' end, null, 'unexpected error ' || v_state || ': ' || left(v_msg, 120), 'FAIL');
      elsif act.label = 'owner' then
        perform pg_temp.rec(act.label, 'read ' || t, 'readable, no error', v_cnt::int, v_cnt || ' rows visible', 'PASS');
      else
        perform pg_temp.rec(act.label, 'read ' || t, '0 rows', v_cnt::int, v_cnt || ' rows visible', case when v_cnt = 0 then 'PASS' else 'FAIL' end);
      end if;
    end loop;
  end loop;

  -- Bake bucket is private, and no stored link is still a public link.
  select (case when b.public then 'PUBLIC' else 'private' end) into v_a from storage.buckets b where b.id = 'museum-room-bakes';
  perform pg_temp.rec('storage', 'museum-room-bakes bucket', 'private', null, coalesce(v_a, 'bucket not found'), case when v_a = 'private' then 'PASS' else 'FAIL' end);
  select count(*) into v_cnt from public.museum_room_meta where baked_asset_url like 'http%';
  perform pg_temp.rec('storage', 'baked_asset_url rows still holding a public link', '0', v_cnt::int, v_cnt || ' rows', case when v_cnt = 0 then 'PASS' else 'FAIL (run 20261012_museum_room_bakes_private.sql)' end);

  -- ── B. Who can switch museum_beta_enabled (each attempt is undone) ──────────
  if v_unap_profile is null then
    perform pg_temp.rec('all', 'approval trigger', 'n/a', null, 'no unapproved profile to try on', 'NOT VERIFIED');
  else
    select museum_beta_enabled into v_orig_beta from public.profiles where id = v_unap_profile;

    for act in
      select * from (values
        ('unapproved user (own profile)', v_unap_uid,  v_unap_email,  'own row: approval trigger must keep it false'),
        ('non-owner admin',               v_admin_uid, v_admin_email, 'other profile: approval trigger must keep it false'),
        ('owner',                         v_owner_uid, v_owner_email, 'owner may approve')
      ) as x(label, uid, email, note)
    loop
      if act.uid is null then
        perform pg_temp.rec(act.label, 'set museum_beta_enabled = true', act.note, null, 'no such account to test with', 'NOT VERIFIED');
        continue;
      end if;
      v_rows := null; v_after := null; v_state := null; v_msg := null;
      begin
        perform pg_temp.act_as(act.uid, act.email);
        update public.profiles set museum_beta_enabled = true where id = v_unap_profile;
        get diagnostics v_rows = row_count;
        select museum_beta_enabled into v_after from public.profiles where id = v_unap_profile;
        raise exception 'ROLLBACK_TEST' using errcode = 'P0001';
      exception
        when sqlstate 'P0001' then
          if sqlerrm <> 'ROLLBACK_TEST' then v_state := sqlstate; v_msg := sqlerrm; end if;
        when others then
          v_state := sqlstate; v_msg := sqlerrm;
      end;
      reset role;

      if v_state is not null then
        perform pg_temp.rec(act.label, 'set museum_beta_enabled = true', act.note, v_rows, 'unexpected error ' || v_state || ': ' || left(v_msg, 120), 'FAIL');
      elsif act.label = 'owner' then
        perform pg_temp.rec(act.label, 'set museum_beta_enabled = true', act.note, v_rows,
          v_rows || ' row(s) updated, value after: ' || coalesce(v_after::text, 'null'),
          case when v_rows = 1 and v_after = true then 'PASS (owner can approve; undone)'
               when v_rows = 0 then 'INCONCLUSIVE (blocked by row permissions, so the owner path was not exercised)'
               else 'FAIL' end);
      elsif v_rows = 0 then
        perform pg_temp.rec(act.label, 'set museum_beta_enabled = true', act.note, v_rows, '0 rows updated',
          'PASS - blocked by row permissions (approval trigger NOT exercised by this account)');
      else
        perform pg_temp.rec(act.label, 'set museum_beta_enabled = true', act.note, v_rows,
          v_rows || ' row(s) updated, value after: ' || coalesce(v_after::text, 'null'),
          case when v_after = false then 'PASS - approval trigger tested (update was allowed, value stayed false)'
               else 'FAIL - the account approved itself or someone else' end);
      end if;
    end loop;

    -- The test profile must be exactly as it was.
    select museum_beta_enabled into v_after from public.profiles where id = v_unap_profile;
    perform pg_temp.rec('(cleanup)', 'test profile museum_beta_enabled is back to the original', v_orig_beta::text, null, v_after::text,
      case when v_after = v_orig_beta then 'PASS' else 'FAIL' end);

    -- Other billing protections still hold: an ordinary account cannot change its own tier.
    select tier into v_tier_before from public.profiles where id = v_unap_profile;
    v_rows := null; v_tier_after := null; v_state := null; v_msg := null;
    begin
      perform pg_temp.act_as(v_unap_uid, v_unap_email);
      update public.profiles set tier = 'FULL' where id = v_unap_profile;
      get diagnostics v_rows = row_count;
      select tier into v_tier_after from public.profiles where id = v_unap_profile;
      raise exception 'ROLLBACK_TEST' using errcode = 'P0001';
    exception
      when sqlstate 'P0001' then
        if sqlerrm <> 'ROLLBACK_TEST' then v_state := sqlstate; v_msg := sqlerrm; end if;
      when others then
        v_state := sqlstate; v_msg := sqlerrm;
    end;
    reset role;
    if v_state is not null then
      perform pg_temp.rec('unapproved user (own profile)', 'billing protection: set own tier', 'tier unchanged', v_rows, 'unexpected error ' || v_state || ': ' || left(v_msg, 120), 'FAIL');
    elsif v_rows = 0 then
      perform pg_temp.rec('unapproved user (own profile)', 'billing protection: set own tier', 'tier unchanged', v_rows, '0 rows updated', 'PASS - blocked by row permissions (billing trigger NOT exercised)');
    else
      perform pg_temp.rec('unapproved user (own profile)', 'billing protection: set own tier', 'tier unchanged', v_rows,
        v_rows || ' row(s) updated, tier before ' || coalesce(v_tier_before, 'null') || ', after ' || coalesce(v_tier_after, 'null'),
        case when v_tier_after is not distinct from v_tier_before then 'PASS - billing trigger tested (update allowed, tier kept)' else 'FAIL' end);
    end if;
  end if;

  -- ── C. 3D Gallery saved rooms: approved can write, unapproved cannot ────────
  if v_ap_profile is null then
    perform pg_temp.rec('approved 3D user', 'create and change a saved 3D room', 'allowed', null, 'no approved profile exists yet', 'NOT VERIFIED');
  else
    v_rows := null; v_state := null; v_msg := null; v_a := null;
    begin
      perform pg_temp.act_as(v_ap_uid, v_ap_email);
      insert into public.virtual_rooms(profile_id, title) values (v_ap_profile, 'access-check (undone)') returning id into v_room;
      get diagnostics v_rows = row_count;
      update public.virtual_rooms set title = 'access-check 2 (undone)' where id = v_room;
      get diagnostics v_cnt = row_count;
      v_a := 'insert ' || v_rows || ' row, update ' || v_cnt || ' row';
      raise exception 'ROLLBACK_TEST' using errcode = 'P0001';
    exception
      when sqlstate 'P0001' then
        if sqlerrm <> 'ROLLBACK_TEST' then v_state := sqlstate; v_msg := sqlerrm; end if;
      when others then
        v_state := sqlstate; v_msg := sqlerrm;
    end;
    reset role;
    if v_state is not null then
      perform pg_temp.rec('approved 3D user', 'create and change a saved 3D room', 'insert 1 row, update 1 row', v_rows, 'error ' || v_state || ': ' || left(v_msg, 120), 'FAIL');
    else
      perform pg_temp.rec('approved 3D user', 'create and change a saved 3D room (undone)', 'insert 1 row, update 1 row', v_rows, v_a,
        case when v_rows = 1 and v_cnt = 1 then 'PASS' else 'FAIL' end);
    end if;
  end if;

  if v_unap_profile is null then
    perform pg_temp.rec('unapproved user', 'create and change a saved 3D room', 'blocked', null, 'no unapproved profile exists', 'NOT VERIFIED');
  else
    -- insert attempt by the unapproved profile's real owner
    v_rows := null; v_state := null; v_msg := null;
    begin
      perform pg_temp.act_as(v_unap_uid, v_unap_email);
      insert into public.virtual_rooms(profile_id, title) values (v_unap_profile, 'access-check (undone)');
      get diagnostics v_rows = row_count;
      raise exception 'ROLLBACK_TEST' using errcode = 'P0001';
    exception
      when sqlstate 'P0001' then
        if sqlerrm <> 'ROLLBACK_TEST' then v_state := sqlstate; v_msg := sqlerrm; end if;
      when others then
        v_state := sqlstate; v_msg := sqlerrm;
    end;
    reset role;
    if v_state = '42501' and v_msg ilike '%row-level security%' then
      perform pg_temp.rec('unapproved user', 'create a saved 3D room', 'blocked', 0, 'refused: ' || left(v_msg, 100), 'PASS - blocked by the approval policy');
    elsif v_state is not null then
      perform pg_temp.rec('unapproved user', 'create a saved 3D room', 'blocked by the approval policy', v_rows, 'other error ' || v_state || ': ' || left(v_msg, 120), 'FAIL');
    else
      perform pg_temp.rec('unapproved user', 'create a saved 3D room', 'blocked', v_rows, 'the insert went through', 'FAIL');
    end if;

    -- change attempt: a room is created for the unapproved profile as setup (undone), then that account tries to change it
    v_rows := null; v_state := null; v_msg := null; v_a := null;
    begin
      insert into public.virtual_rooms(profile_id, title) values (v_unap_profile, 'access-check setup (undone)') returning id into v_room;
      perform pg_temp.act_as(v_unap_uid, v_unap_email);
      update public.virtual_rooms set title = 'changed (undone)' where id = v_room;
      get diagnostics v_rows = row_count;
      raise exception 'ROLLBACK_TEST' using errcode = 'P0001';
    exception
      when sqlstate 'P0001' then
        if sqlerrm <> 'ROLLBACK_TEST' then v_state := sqlstate; v_msg := sqlerrm; end if;
      when others then
        v_state := sqlstate; v_msg := sqlerrm;
    end;
    reset role;
    if v_state is not null then
      perform pg_temp.rec('unapproved user', 'change a saved 3D room', 'blocked', v_rows, 'error ' || v_state || ': ' || left(v_msg, 120), 'FAIL');
    else
      perform pg_temp.rec('unapproved user', 'change a saved 3D room (undone)', 'blocked, 0 rows', v_rows, v_rows || ' row(s) changed',
        case when v_rows = 0 then 'PASS - blocked by the approval policy' else 'FAIL' end);
    end if;
  end if;

  -- ── D. Collection interests and Universes displayed are independent ────────
  if v_unap_profile is null then
    perform pg_temp.rec('settings', 'collection_interests and displayed_universes are independent', 'each change leaves the other alone', null, 'no test profile', 'NOT VERIFIED');
  elsif not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'displayed_universes')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'collection_interests') then
    perform pg_temp.rec('settings', 'the two separate columns exist', 'yes', null, 'missing', 'FAIL (run 20261012_collection_interests_and_displayed_universes.sql)');
  else
    perform pg_temp.rec('settings', 'the two separate columns exist', 'yes', null, 'both present', 'PASS');
    v_rows := null; v_state := null; v_msg := null; v_a := null; v_b := null;
    declare
      i0 text; d0 text; i1 text; d1 text; i2 text; d2 text; r1 int; r2 int;
    begin
      begin
        perform pg_temp.act_as(v_unap_uid, v_unap_email);
        select collection_interests::text, displayed_universes::text into i0, d0 from public.profiles where id = v_unap_profile;
        update public.profiles set displayed_universes = array['ART'] where id = v_unap_profile;
        get diagnostics r1 = row_count;
        select collection_interests::text, displayed_universes::text into i1, d1 from public.profiles where id = v_unap_profile;
        update public.profiles set collection_interests = array['MUSIC'] where id = v_unap_profile;
        get diagnostics r2 = row_count;
        select collection_interests::text, displayed_universes::text into i2, d2 from public.profiles where id = v_unap_profile;
        v_a := 'start interests=' || coalesce(i0,'null') || ' displayed=' || coalesce(d0,'null');
        v_b := 'after changing displayed: interests=' || coalesce(i1,'null') || ' displayed=' || coalesce(d1,'null')
            || ' | after changing interests: interests=' || coalesce(i2,'null') || ' displayed=' || coalesce(d2,'null');
        v_rows := r1 + r2;
        raise exception 'ROLLBACK_TEST' using errcode = 'P0001';
      exception
        when sqlstate 'P0001' then
          if sqlerrm <> 'ROLLBACK_TEST' then v_state := sqlstate; v_msg := sqlerrm; end if;
        when others then
          v_state := sqlstate; v_msg := sqlerrm;
      end;
      reset role;
      if v_state is not null then
        perform pg_temp.rec('settings', 'change one setting, the other stays', 'unchanged', v_rows, 'error ' || v_state || ': ' || left(v_msg, 120), 'FAIL');
      elsif r1 = 0 or r2 = 0 then
        perform pg_temp.rec('settings', 'change one setting, the other stays', 'unchanged', v_rows, '0 rows updated: ' || v_a, 'INCONCLUSIVE (blocked by row permissions)');
      else
        perform pg_temp.rec('settings', 'changing Universes displayed leaves Collection interests unchanged (undone)', 'interests unchanged', r1, v_a || ' -> ' || v_b,
          case when i1 is not distinct from i0 and d1 = '{ART}' then 'PASS' else 'FAIL' end);
        perform pg_temp.rec('settings', 'changing Collection interests leaves Universes displayed unchanged (undone)', 'displayed unchanged', r2, v_b,
          case when d2 is not distinct from d1 and i2 = '{MUSIC}' then 'PASS' else 'FAIL' end);
      end if;
    end;
  end if;

  -- ── D2. The settings migration with populated data (every change is undone) ─────────
  if v_unap_profile is null then
    perform pg_temp.rec('settings', 'populated migration cases', 'all pass', null, 'no test profile', 'NOT VERIFIED');
  elsif not exists (select 1 from pg_proc f join pg_namespace n on n.oid = f.pronamespace and n.nspname = 'public' where f.proname = 'vltd_backfill_universe_settings') then
    perform pg_temp.rec('settings', 'populated migration cases', 'all pass', null, 'the migration function is missing', 'FAIL (run 20261012_collection_interests_and_displayed_universes.sql)');
  else
    declare
      i1 text; d1 text; i2 text; d2 text; i3 text; d3 text; i4 text; d4 text; i5 text; d5 text;
      n1 int; n5 int; v_flag boolean;
    begin
      v_state := null; v_msg := null;
      select exists (select 1 from public.vltd_migration_flags where name = '20261012_universe_settings_backfill') into v_flag;
      begin
        -- Start as a database that only has the old shared column filled in.
        update public.profiles set focused_universes = array['MUSIC','ART'], collection_interests = null, displayed_universes = null where id = v_unap_profile;
        -- 1. The first-run copy keeps the old selections in both new columns.
        n1 := public.vltd_backfill_universe_settings(true, v_unap_profile);
        select collection_interests::text, displayed_universes::text into i1, d1 from public.profiles where id = v_unap_profile;
        -- 2. Changing Universes displayed leaves Collection interests alone.
        update public.profiles set displayed_universes = array['GAMES'] where id = v_unap_profile;
        select collection_interests::text, displayed_universes::text into i2, d2 from public.profiles where id = v_unap_profile;
        -- 3. Clearing interests on purpose is stored as an empty list and leaves Universes displayed alone.
        update public.profiles set collection_interests = array[]::text[] where id = v_unap_profile;
        select collection_interests::text, displayed_universes::text into i3, d3 from public.profiles where id = v_unap_profile;
        -- 4. "Show all" (null) is stored, and the cleared interests stay cleared.
        update public.profiles set displayed_universes = null where id = v_unap_profile;
        select collection_interests::text, displayed_universes::text into i4, d4 from public.profiles where id = v_unap_profile;
        -- 5. Running the migration again copies nothing and changes nothing.
        n5 := public.vltd_backfill_universe_settings();
        select collection_interests::text, displayed_universes::text into i5, d5 from public.profiles where id = v_unap_profile;
        raise exception 'ROLLBACK_TEST' using errcode = 'P0001';
      exception
        when sqlstate 'P0001' then
          if sqlerrm <> 'ROLLBACK_TEST' then v_state := sqlstate; v_msg := sqlerrm; end if;
        when others then
          v_state := sqlstate; v_msg := sqlerrm;
      end;
      if v_state is not null then
        perform pg_temp.rec('settings', 'populated migration cases', 'all pass', null, 'error ' || v_state || ': ' || left(v_msg, 120), 'FAIL');
      else
        perform pg_temp.rec('settings', 'first-run copy keeps the old selections', 'both = {MUSIC,ART}', n1, 'interests=' || coalesce(i1,'null') || ' displayed=' || coalesce(d1,'null'), case when i1 = '{MUSIC,ART}' and d1 = '{MUSIC,ART}' then 'PASS' else 'FAIL' end);
        perform pg_temp.rec('settings', 'changing Universes displayed leaves interests unchanged', 'interests {MUSIC,ART}, displayed {GAMES}', null, 'interests=' || coalesce(i2,'null') || ' displayed=' || coalesce(d2,'null'), case when i2 = '{MUSIC,ART}' and d2 = '{GAMES}' then 'PASS' else 'FAIL' end);
        perform pg_temp.rec('settings', 'clearing interests is stored and leaves displayed unchanged', 'interests {} (empty, not null), displayed {GAMES}', null, 'interests=' || coalesce(i3,'null') || ' displayed=' || coalesce(d3,'null'), case when i3 = '{}' and d3 = '{GAMES}' then 'PASS' else 'FAIL' end);
        perform pg_temp.rec('settings', 'show all (null) is stored; cleared interests stay cleared', 'interests {}, displayed null', null, 'interests=' || coalesce(i4,'null') || ' displayed=' || coalesce(d4,'null'), case when i4 = '{}' and d4 is null then 'PASS' else 'FAIL' end);
        perform pg_temp.rec('settings', 're-running the migration changes nothing', '0 rows copied; interests {}, displayed null', n5, 'interests=' || coalesce(i5,'null') || ' displayed=' || coalesce(d5,'null') || '; flag present=' || v_flag::text, case when n5 = 0 and i5 = '{}' and d5 is null and v_flag then 'PASS' else 'FAIL' end);
      end if;
    end;
  end if;

  -- ── E. The rules as they stand right now ────────────────────────────────────
  insert into access_checks(who, what, expected, rows_affected, actual, result)
  select 'live policies', c.relname, 'no public read policy; owner policy present', null,
         coalesce(string_agg(p2.polname || ' [' || p2.polcmd::text || ']', ', ' order by p2.polname), 'none'),
         case when bool_or(p2.polname ilike 'Public can read%') then 'FAIL' when count(p2.polname) = 0 then 'FAIL' else 'PASS' end
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    left join pg_policy p2 on p2.polrelid = c.oid
   where c.relname = any (tbls)
   group by c.relname;

  insert into access_checks(who, what, expected, rows_affected, actual, result)
  select 'live trigger', 'protect_profile_billing_columns is owner-checked', 'contains the owner check', null,
         case when pg_get_functiondef(f.oid) ilike '%is_vltd_owner%' then 'yes' else 'no' end,
         case when pg_get_functiondef(f.oid) ilike '%is_vltd_owner%' then 'PASS' else 'FAIL' end
    from pg_proc f join pg_namespace n on n.oid = f.pronamespace and n.nspname = 'public'
   where f.proname = 'protect_profile_billing_columns';

  insert into access_checks(who, what, expected, rows_affected, actual, result)
  select 'live policies', 'virtual_rooms ' || p2.polname, 'insert/update need 3D approval', null, p2.polcmd::text,
         case when p2.polcmd in ('a','w') and pg_get_expr(coalesce(p2.polwithcheck, p2.polqual), p2.polrelid) ilike '%has_3d_gallery_access%' then 'PASS'
              when p2.polcmd in ('a','w') then 'FAIL' else 'info' end
    from pg_policy p2 join pg_class c on c.oid = p2.polrelid and c.relname = 'virtual_rooms';
end $$;

select n, who, what, expected, rows_affected, actual, result from access_checks order by n;
