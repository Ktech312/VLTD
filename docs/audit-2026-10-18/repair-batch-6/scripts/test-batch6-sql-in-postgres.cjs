// Runs the batch 6 SQL (scan-quota guard + avatar upload rules) and its rollback in a real in-process Postgres with synthetic data.
//   node test-batch6-sql-in-postgres.cjs   (PGLITE_DIR = folder holding node_modules/@electric-sql/pglite)
const fs = require("fs");
const path = require("path");
const PG_DIR = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(PG_DIR, "node_modules", "@electric-sql/pglite"));
const SQL = path.join(__dirname, "..", "sql");
const MIG = path.join(__dirname, "..", "..", "..", "..", "supabase", "migrations");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 400)); };

const ALICE = "00000000-0000-0000-0000-0000000000a1", BOB = "00000000-0000-0000-0000-0000000000b2";
const PA = "11111111-1111-1111-1111-111111111111", PB = "22222222-2222-2222-2222-222222222222"; // profile ids differ from user ids

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', nullif(current_setting('request.jwt.claim.email', true), '')) $$;
    create table public.profiles (id uuid primary key, user_id uuid, created_at timestamptz default now(), tier text default 'FREE');
    create table public.profile_members (profile_id uuid, user_id uuid, role text);
    create table public.user_roles (email text, role text);
    create function public.is_profile_member(p_profile uuid) returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from public.profile_members m where m.profile_id = p_profile and m.user_id = auth.uid()); $$;
    create function public.is_profile_member_text(p_profile text) returns boolean language sql stable security definer set search_path = public as $$
      select p_profile is not null and p_profile ~ '^[0-9a-fA-F-]{36}$' and exists (select 1 from public.profile_members m where m.profile_id = p_profile::uuid and m.user_id = auth.uid()); $$;
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated;
  `);
  await db.exec(fs.readFileSync(path.join(MIG, "20260723_bulk_scan_quota.sql"), "utf8"));
  await db.exec("grant select, update on public.profiles to authenticated");
  await db.query("insert into public.profiles (id, user_id) values ($1,$2), ($3,$4)", [PA, ALICE, PB, BOB]);
  await db.query("insert into public.profile_members values ($1,$2,'owner'), ($3,$4,'owner')", [PA, ALICE, PB, BOB]);

  const as = async (sub, sql, params = []) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub || ""}', false)`);
    await db.exec("set role authenticated");
    try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: String(e.message || e) }; } finally { await db.exec("reset role"); }
  };

  // ---------- before: the reported defect
  let r = await as(ALICE, "select * from public.bulk_scan_status($1)", [PA]);
  check("BEFORE: member whose profile id differs from user id is refused", !!r.error && /not authorized/.test(r.error), r);

  // ---------- apply
  await db.exec(fs.readFileSync(path.join(SQL, "1-scan-quota-guard-and-avatar-uploads.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(SQL, "1-scan-quota-guard-and-avatar-uploads.sql"), "utf8")); // idempotent re-run
  check("re-run is harmless", true);

  r = await as(ALICE, "select * from public.bulk_scan_status($1)", [PA]);
  check("member reads own profile's allowance (id differs from user id)", !r.error && r.rows.length === 1 && r.rows[0].scan_limit === 10, r);
  r = await as(ALICE, "select * from public.consume_bulk_scan($1, 2)", [PA]);
  check("member spends own profile's scans", !r.error && r.rows[0].granted === 2 && r.rows[0].remaining === 8, r);
  r = await as(ALICE, "select * from public.bulk_scan_status($1)", [PB]);
  check("member cannot read ANOTHER profile's allowance", !!r.error && /not authorized/.test(r.error), r);
  r = await as(ALICE, "select * from public.consume_bulk_scan($1, 1)", [PB]);
  check("member cannot spend ANOTHER profile's scans", !!r.error && /not authorized/.test(r.error), r);
  r = await as(BOB, "select * from public.bulk_scan_status($1)", [PA]);
  check("unrelated account cannot read A's allowance", !!r.error, r);
  await db.query("insert into public.profiles (id, user_id) values ($1,$1)", [ALICE]); // a profile whose id equals the user id (the old rule)
  r = await as(ALICE, "select * from public.bulk_scan_status($1)", [ALICE]);
  check("profile id = user id still works", !r.error && r.rows.length === 1, r);
  await db.query("insert into public.user_roles values ('boss@example.com','admin')");
  await db.exec("select set_config('request.jwt.claim.email','boss@example.com', false)");
  r = await as(BOB, "select * from public.bulk_scan_status($1)", [PA]);
  check("admin role still passes the guard", !r.error && r.rows.length === 1, r);
  await db.exec("select set_config('request.jwt.claim.email','', false)");
  r = await as("", "select * from public.bulk_scan_status($1)", [PA]);
  check("no session (server) still passes the guard (unchanged behaviour)", !r.error, r);

  // ---------- avatars
  const ins = (sub, name, bucket = "avatars") => as(sub, "insert into storage.objects (bucket_id, name) values ($1,$2) returning id", [bucket, name]);
  r = await ins(ALICE, `${PA}/avatar.jpg`);
  check("member uploads into own profile's folder", !r.error && r.rows.length === 1, r);
  r = await ins(ALICE, `${PB}/avatar.jpg`);
  check("member cannot upload into ANOTHER profile's folder", !!r.error && /row-level security/.test(r.error), r);
  r = await ins(ALICE, `${ALICE}/avatar.jpg`);
  check("user-id folder that is not a profile of theirs is refused", !!r.error && /row-level security/.test(r.error), r);
  r = await ins(ALICE, "probe.jpg");
  check("bucket-root file is refused", !!r.error && /row-level security/.test(r.error), r);
  r = await ins(ALICE, `${PA}/avatar.jpg`, "vault-images");
  check("the same path in another bucket is not allowed by these rules", !!r.error && /row-level security/.test(r.error), r);
  r = await as(ALICE, "update storage.objects set name = $1 where name = $1 and bucket_id = 'avatars' returning id", [`${PA}/avatar.jpg`]);
  check("member replaces (update) own avatar", !r.error && r.rows.length === 1, r);
  r = await as(BOB, "update storage.objects set name = name where bucket_id = 'avatars' returning id");
  check("unrelated account updates nothing", !r.error && r.rows.length === 0, r);
  r = await as(BOB, "select id from storage.objects where bucket_id = 'avatars'");
  check("unrelated account sees no rows through these rules", !r.error && r.rows.length === 0, r);
  r = await as(BOB, "delete from storage.objects where bucket_id = 'avatars' returning id");
  check("unrelated account deletes nothing", !r.error && r.rows.length === 0, r);
  const v = (await db.query(fs.readFileSync(path.join(SQL, "validation-1.sql"), "utf8").replace(/^--.*$/gm, ""))).rows[0].result;
  check("validation query: all true, 4 policies", v.guard_allows_profile_members === true && v.guard_still_allows_owner_email_and_admins === true && Number(v.avatar_policies) === 4 && v.avatar_policies_all_scoped_to_bucket === true, v);

  // ---------- rollback
  await db.exec(fs.readFileSync(path.join(SQL, "rollback-1.sql"), "utf8"));
  r = await as(ALICE, "select * from public.bulk_scan_status($1)", [PA]);
  check("ROLLBACK: guard back to the original behaviour", !!r.error && /not authorized/.test(r.error), r);
  r = await ins(ALICE, `${PA}/avatar2.jpg`);
  check("ROLLBACK: upload refused again", !!r.error && /row-level security/.test(r.error), r);
  const left = (await db.query("select count(*)::int c from pg_policies where policyname like 'avatars_member_%'")).rows[0].c;
  check("ROLLBACK: no avatar policies left", left === 0, left);

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
