// Runs 10-ai-scan-reservations.sql, its validation and rollback in a real in-process Postgres (PGlite) on a copy of the CURRENT allowance setup:
// the 20260723 quota migration, the hardened membership guard from repair-batch-6 SQL 1, and the profile membership helper, so the new functions are tested against the real ones.
// Note on concurrency: PGlite runs one connection, so "at the same instant" here means many requests issued together and decided one after the other. The
// protection itself is the row lock taken inside reserve_ai_scan (checked in validation-10.sql); this test proves the decisions that lock serialises are right.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..", "..", "..");
const PG_DIR = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(PG_DIR, "node_modules", "@electric-sql/pglite"));
const SQLD = path.join(__dirname, "..", "sql");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const ALICE = "00000000-0000-0000-0000-0000000000a1", BOB = "00000000-0000-0000-0000-0000000000b2", CAROL = "00000000-0000-0000-0000-0000000000c3";
const PA = "11111111-1111-1111-1111-111111111111", PB = "22222222-2222-2222-2222-222222222222", PBIZ = "33333333-3333-3333-3333-333333333333";
const R = (n) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;
(async () => {
  const db = new PGlite();
  const quota = fs.readFileSync(path.join(ROOT, "supabase", "migrations", "20260723_bulk_scan_quota.sql"), "utf8");
  const sql1 = fs.readFileSync(path.join(ROOT, "docs", "audit-2026-10-18", "repair-batch-6", "sql", "1-scan-quota-guard-and-avatar-uploads.sql"), "utf8");
  const guards = sql1.slice(sql1.indexOf("-- Strict guard"), sql1.indexOf('drop policy if exists "avatars_member_insert"'));
  const members = fs.readFileSync(path.join(ROOT, "supabase", "migrations", "20260707_profile_members.sql"), "utf8");
  const isMember = members.slice(members.indexOf("create or replace function public.is_profile_member(p_profile uuid)"), members.indexOf("create or replace function public.is_profile_owner"));
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
    create table public.user_roles (email text primary key, role text);
    create table public.profiles (id uuid primary key, user_id uuid, created_at timestamptz not null default now(), tier text default 'FREE');
    create table public.profile_members (profile_id uuid not null references public.profiles(id) on delete cascade, user_id uuid not null, role text not null default 'member', primary key (profile_id, user_id));
    grant usage on schema public, auth to anon, authenticated, service_role;
  `);
  await db.exec(isMember);
  await db.exec(quota);
  await db.exec(guards);
  await db.exec(`
    insert into public.profiles (id, user_id, created_at) values ('${PA}', '${ALICE}', now() - interval '40 days'), ('${PB}', '${BOB}', now() - interval '40 days'), ('${PBIZ}', '${ALICE}', now() - interval '40 days');
    insert into public.profile_members (profile_id, user_id, role) values ('${PA}', '${ALICE}', 'owner'), ('${PB}', '${BOB}', 'owner'), ('${PBIZ}', '${ALICE}', 'owner'), ('${PA}', '${CAROL}', 'member');
    update public.bulk_scan_quotas set monthly_limit = 3 where tier = 'FREE';
  `);
  const as = async (sub, sqlText, params = [], role = "authenticated") => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub || ""}', false), set_config('request.jwt.claim.role', '${role}', false)`);
    await db.exec(`set role ${role}`);
    try { return { rows: (await db.query(sqlText, params)).rows }; } catch (e) { return { error: String(e.message || e) }; } finally { await db.exec("reset role"); }
  };
  const reserve = (sub, profile, req, kind = "item", role = "authenticated") => as(sub, "select * from public.reserve_ai_scan($1, $2, $3)", [profile, req, kind], role);
  const complete = (sub, profile, req, ok) => as(sub, "select * from public.complete_ai_scan($1, $2, $3)", [profile, req, ok]);
  const used = async (p) => (await db.query("select bulk_scans_used u from public.profiles where id = $1", [p])).rows[0].u;
  const ledger = async (p, r) => (await db.query("select state from public.ai_scan_requests where profile_id = $1 and request_id = $2", [p, r])).rows[0]?.state ?? null;

  // before: the existing atomic function works and shares the same counter
  let r = await as(ALICE, "select * from public.consume_bulk_scan($1, 1)", [PBIZ]);
  check("before the file: the existing consume_bulk_scan spends one scan atomically", !r.error && r.rows[0].granted === 1 && r.rows[0].used === 1, r);
  await db.exec(`update public.profiles set bulk_scans_used = 0 where id = '${PBIZ}'`);

  const sql = fs.readFileSync(path.join(SQLD, "10-ai-scan-reservations.sql"), "utf8");
  await db.exec(sql); await db.exec(sql);
  check("the file applies and can be run again", true);
  const val = (await db.query(fs.readFileSync(path.join(SQLD, "validation-10.sql"), "utf8").replace(/^--.*$/gm, ""))).rows[0].result;
  check("validation-10.sql: every value is true", Object.values(val).every((v) => v === true), val);

  // basic reservation
  r = await reserve(ALICE, PA, R(1));
  check("a member reserves one scan: reserved, 1 of 3 used, 2 left", !r.error && r.rows[0].outcome === "reserved" && r.rows[0].used === 1 && r.rows[0].remaining === 2 && r.rows[0].scan_limit === 3, r);
  check("the profile's own counter went up by exactly one", (await used(PA)) === 1);
  r = await reserve(ALICE, PA, R(1));
  check("the SAME request again is a duplicate and spends nothing", !r.error && r.rows[0].outcome === "duplicate" && (await used(PA)) === 1, r);
  r = await reserve(CAROL, PA, R(1));
  check("a duplicate from another member of the profile is still a duplicate", !r.error && r.rows[0].outcome === "duplicate" && (await used(PA)) === 1, r);

  // limit
  r = await reserve(ALICE, PA, R(2)); const r3 = await reserve(ALICE, PA, R(3)); const r4 = await reserve(ALICE, PA, R(4));
  check("requests up to the allowance reserve; the next one is 'limit' and spends nothing", r.rows[0].outcome === "reserved" && r3.rows[0].outcome === "reserved" && r4.rows[0].outcome === "limit" && (await used(PA)) === 3 && r4.rows[0].remaining === 0, [r, r3, r4]);
  check("a refused request leaves no reservation row behind", (await ledger(PA, R(4))) === null);

  // refund
  r = await complete(ALICE, PA, R(3), false);
  check("a provider failure gives the scan back (released, 2 of 3 used)", !r.error && r.rows[0].outcome === "released" && (await used(PA)) === 2 && (await ledger(PA, R(3))) === "released", r);
  r = await complete(ALICE, PA, R(3), false);
  check("giving back twice does nothing more", r.rows[0].outcome === "released" && (await used(PA)) === 2, r);
  r = await reserve(ALICE, PA, R(3));
  check("a released request id may be reserved again (a genuine retry)", r.rows[0].outcome === "reserved" && (await used(PA)) === 3, r);
  r = await complete(ALICE, PA, R(3), true);
  check("a successful scan keeps its charge (done)", r.rows[0].outcome === "done" && (await used(PA)) === 3 && (await ledger(PA, R(3))) === "done", r);
  r = await complete(ALICE, PA, R(3), false);
  check("a finished scan cannot be given back afterwards", r.rows[0].outcome === "done" && (await used(PA)) === 3, r);
  r = await reserve(ALICE, PA, R(3));
  check("a finished request id is a duplicate", r.rows[0].outcome === "duplicate" && (await used(PA)) === 3, r);

  // access
  r = await reserve(BOB, PA, R(10));
  check("a signed-in account that is NOT a member of the profile is refused", !!r.error && /not authorized/.test(r.error) && (await used(PA)) === 3, r);
  r = await complete(BOB, PA, R(2), false);
  check("and cannot give someone else's scan back", !!r.error && /not authorized/.test(r.error) && (await used(PA)) === 3, r);
  r = await reserve(null, PA, R(11), "item", "anon");
  check("an anonymous caller cannot execute reserve at all", !!r.error && /permission denied/.test(r.error), r);
  r = await as(null, "select * from public.complete_ai_scan($1, $2, false)", [PA, R(2)], "anon");
  check("an anonymous caller cannot execute complete either", !!r.error && /permission denied/.test(r.error), r);
  r = await as(ALICE, "select * from public.ai_scan_numbers($1)", [PA]);
  check("signed-in people cannot call the number helper directly", !!r.error && /permission denied/.test(r.error), r);
  r = await as(ALICE, "select * from public.ai_scan_requests");
  check("signed-in people cannot read the request table", !!r.error && /permission denied/.test(r.error), r);
  r = await reserve(null, PB, R(12), "item", "service_role");
  check("the server's service role may reserve", !r.error && r.rows[0].outcome === "reserved", r);
  r = await reserve(ALICE, PBIZ, R(13), "bogus");
  check("an unknown scan kind is refused", !!r.error && /unknown scan kind/.test(r.error), r);
  r = await as(ALICE, "select * from public.reserve_ai_scan($1, null, 'item')", [PBIZ]);
  check("a missing request id is refused", !!r.error && /request id is required/.test(r.error), r);
  r = await reserve(ALICE, "99999999-9999-9999-9999-999999999999", R(14));
  check("a profile that does not exist is refused", !!r.error, r);

  // two profiles of one person keep separate allowances
  r = await reserve(ALICE, PBIZ, R(20), "coa");
  check("a person's other profile has its own allowance (and certificate scans count the same way)", r.rows[0].outcome === "reserved" && r.rows[0].used === 1 && (await used(PA)) === 3, r);

  // many at once (decided one after the other)
  await db.exec(`update public.profiles set bulk_scans_used = 0 where id = '${PBIZ}'; delete from public.ai_scan_requests where profile_id = '${PBIZ}'`);
  const many = await Promise.all(Array.from({ length: 8 }, (_, i) => reserve(ALICE, PBIZ, R(100 + i))));
  const outcomes = many.map((x) => x.rows?.[0]?.outcome);
  check("eight different requests together against an allowance of 3: exactly 3 reserved, 5 limit, never more spent than allowed", outcomes.filter((o) => o === "reserved").length === 3 && outcomes.filter((o) => o === "limit").length === 5 && (await used(PBIZ)) === 3, { outcomes, used: await used(PBIZ) });
  await db.exec(`update public.profiles set bulk_scans_used = 0 where id = '${PBIZ}'; delete from public.ai_scan_requests where profile_id = '${PBIZ}'`);
  const same = await Promise.all(Array.from({ length: 8 }, () => reserve(ALICE, PBIZ, R(200))));
  const so = same.map((x) => x.rows?.[0]?.outcome);
  check("eight copies of ONE request together: exactly one is reserved and seven are duplicates, one scan spent", so.filter((o) => o === "reserved").length === 1 && so.filter((o) => o === "duplicate").length === 7 && (await used(PBIZ)) === 1, { so, used: await used(PBIZ) });

  // cycle roll-over
  await db.exec(`update public.profiles set bulk_scans_used = 3, bulk_scans_cycle_start = (current_date - interval '90 days')::date where id = '${PBIZ}'`);
  r = await reserve(ALICE, PBIZ, R(300));
  check("a lapsed cycle rolls over: the first scan of the new cycle reserves (1 used)", r.rows[0].outcome === "reserved" && r.rows[0].used === 1, r);
  await db.exec(`update public.profiles set bulk_scans_used = 2, bulk_scans_cycle_start = (current_date + interval '1 day')::date where id = '${PBIZ}'`);
  await db.exec(`update public.ai_scan_requests set cycle_start = (current_date - interval '5 days')::date where profile_id = '${PBIZ}' and request_id = '${R(300)}'`);
  r = await complete(ALICE, PBIZ, R(300), false);
  check("a scan taken in an EARLIER cycle is not given back into the current one (the profile counter is left as it was)", r.rows[0].outcome === "released" && (await used(PBIZ)) === 2, r);

  // old rows are cleared
  await db.exec(`insert into public.ai_scan_requests (profile_id, request_id, kind, state, cycle_start, created_at) values ('${PBIZ}', '${R(400)}', 'item', 'done', current_date, now() - interval '5 days')`);
  await reserve(ALICE, PBIZ, R(401));
  check("request rows older than 3 days are cleared out", (await ledger(PBIZ, R(400))) === null);

  // the existing function still works and shares the counter
  await db.exec(`update public.profiles set bulk_scans_used = 0, bulk_scans_cycle_start = null where id = '${PB}'; delete from public.ai_scan_requests where profile_id = '${PB}'`);
  r = await as(BOB, "select * from public.consume_bulk_scan($1, 1)", [PB]);
  check("the existing consume_bulk_scan is untouched and still spends from the same counter", !r.error && r.rows[0].granted === 1 && (await used(PB)) === 1, r);

  // rollback
  await db.exec(fs.readFileSync(path.join(SQLD, "rollback-10.sql"), "utf8"));
  check("rollback removes the functions and the table", (await db.query("select to_regprocedure('public.reserve_ai_scan(uuid,uuid,text)') is null a, to_regclass('public.ai_scan_requests') is null b")).rows[0].a === true && (await db.query("select to_regclass('public.ai_scan_requests') is null b")).rows[0].b === true);
  r = await as(ALICE, "select * from public.consume_bulk_scan($1, 1)", [PBIZ]);
  check("after rollback the existing allowance function still works", !r.error && r.rows[0].granted === 1, r);
  await db.exec(sql);
  check("and the file can be applied again after a rollback", (await db.query("select to_regprocedure('public.reserve_ai_scan(uuid,uuid,text)') is not null a")).rows[0].a === true);
  console.log(`\n${pass} of ${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
