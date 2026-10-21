// Runs 6-insurance-exclusions.sql, its validation and rollback in a real in-process Postgres with two accounts and an anonymous caller.
const fs = require("fs");
const path = require("path");
const PG_DIR = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(PG_DIR, "node_modules", "@electric-sql/pglite"));
const SQL = path.join(__dirname, "..", "sql");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 300)); };
const ALICE = "00000000-0000-0000-0000-0000000000a1", BOB = "00000000-0000-0000-0000-0000000000b2";
const PA = "11111111-1111-1111-1111-111111111111", PB = "22222222-2222-2222-2222-222222222222";
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles (id uuid primary key);
    create table public.profile_members (profile_id uuid, user_id uuid, role text);
    create function public.is_profile_member(p_profile uuid) returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from public.profile_members m where m.profile_id = p_profile and m.user_id = auth.uid()); $$;
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    insert into public.profiles values ('${PA}'), ('${PB}');
    insert into public.profile_members values ('${PA}', '${ALICE}', 'owner'), ('${PB}', '${BOB}', 'owner');
  `);
  const as = async (sub, sql, params = [], role = "authenticated") => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub || ""}', false)`);
    await db.exec(`set role ${role}`);
    try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: String(e.message || e) }; } finally { await db.exec("reset role"); }
  };
  const sql = fs.readFileSync(path.join(SQL, "6-insurance-exclusions.sql"), "utf8");
  await db.exec(sql); await db.exec(sql);
  check("applies and re-runs", true);
  let r = await as(ALICE, "insert into public.insurance_exclusions (profile_id, item_id) values ($1, 'item-1') returning item_id", [PA]);
  check("a member excludes an item of their own profile", !r.error && r.rows.length === 1, r);
  r = await as(ALICE, "insert into public.insurance_exclusions (profile_id, item_id) values ($1, 'item-2')", [PB]);
  check("a member cannot write another profile's exclusions", !!r.error && /row-level security/.test(r.error), r);
  r = await as(ALICE, "insert into public.insurance_exclusions (profile_id, item_id) values ($1, 'item-1')", [PA]);
  check("the same item twice is refused (one row per item)", !!r.error, r);
  r = await as(BOB, "select * from public.insurance_exclusions");
  check("an unrelated account reads nothing", !r.error && r.rows.length === 0, r);
  r = await as(ALICE, "select * from public.insurance_exclusions");
  check("the member reads their own", !r.error && r.rows.length === 1, r);
  r = await as(BOB, "delete from public.insurance_exclusions returning item_id");
  check("an unrelated account deletes nothing", !r.error && r.rows.length === 0, r);
  r = await as("", "select * from public.insurance_exclusions", [], "anon");
  check("an anonymous caller is refused", !!r.error && /permission denied/.test(r.error), r);
  r = await as(ALICE, "insert into public.insurance_exclusions (profile_id, item_id) values ($1, 'item-1'), ($1, 'item-9') on conflict (profile_id, item_id) do nothing", [PA]);
  check("the site's upload (insert ... on conflict do nothing) works for a member and skips duplicates", !r.error, r);
  r = await as(ALICE, "select count(*)::int c from public.insurance_exclusions");
  check("that upload left exactly the two rows", !r.error && r.rows[0].c === 2, r);
  r = await as(ALICE, "update public.insurance_exclusions set item_id = 'x'");
  check("rows cannot be edited (only added and removed)", !!r.error && /permission denied/.test(r.error), r);
  r = await as(ALICE, "delete from public.insurance_exclusions where profile_id = $1 and item_id in ('item-1', 'item-9') returning item_id", [PA]);
  check("the site's removal (delete ... where item_id in (...)) works for a member", !r.error && r.rows.length === 2, r);
  const v = (await db.query(fs.readFileSync(path.join(SQL, "validation-6.sql"), "utf8").replace(/^--.*$/gm, ""))).rows[0].result;
  check("validation: every flag true", Object.values(v).every((x) => x === true), v);
  await db.exec(fs.readFileSync(path.join(SQL, "rollback-6.sql"), "utf8"));
  check("ROLLBACK removes the table", (await db.query("select to_regclass('public.insurance_exclusions') t")).rows[0].t === null);
  console.log("\n" + pass + " pass, " + fail + " fail");
  process.exit(fail ? 1 : 0);
})();
