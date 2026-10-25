// SQL package 10 on a REAL Postgres server (embedded-postgres, version 18) with SEPARATE DATABASE CONNECTIONS, on a copy of the CURRENT allowance setup:
// the 20260723 quota migration, the hardened membership guard from repair-batch-6 SQL 1, the profile membership helper, row-level security on profiles, and the REAL billing-column
// protection trigger from 20260823 (which is what silently undoes a counter change made by a member's own session). Roles anon / authenticated / service_role are real roles,
// and every "member" or "server" below is its own connection.
//   node test-sql10-real-postgres.cjs          (needs `npm i embedded-postgres pg` in EMBEDDED_PG_DIR)
const fs = require("fs");
const path = require("path");
const os = require("os");
const ROOT = path.join(__dirname, "..", "..", "..", "..");
const PG_DIR = process.env.EMBEDDED_PG_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/realpg";
const pgRequire = require("module").createRequire(path.join(PG_DIR, "package.json"));
const EmbeddedPostgres = pgRequire("embedded-postgres").default;
const { Client } = pgRequire("pg");
const SQLD = path.join(__dirname, "..", "sql");
const PORT = 54331;
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const ALICE = "00000000-0000-0000-0000-0000000000a1", BOB = "00000000-0000-0000-0000-0000000000b2", CAROL = "00000000-0000-0000-0000-0000000000c3";
const PA = "11111111-1111-1111-1111-111111111111", PB = "22222222-2222-2222-2222-222222222222", PBIZ = "33333333-3333-3333-3333-333333333333", PC = "44444444-4444-4444-4444-444444444444";
const R = (n) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-pg-"));
  const pgServer = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "pw", port: PORT, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {}, onError: () => {} });
  await pgServer.initialise(); await pgServer.start();
  const open = async () => { const c = new Client({ host: "localhost", port: PORT, user: "postgres", password: "pw", database: "postgres" }); await c.connect(); return c; };
  const admin = await open();
  // The set-up connection presents as the server (service role), exactly as the real server does: the billing-column trigger would otherwise undo this script's own counter edits.
  await admin.query("select set_config('request.jwt.claim.role', 'service_role', false)");
  const clients = [];
  /** A brand-new database connection that behaves as `role` with the JWT subject `sub`. */
  const conn = async (role, sub) => {
    const c = await open(); clients.push(c);
    await c.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false), set_config('request.jwt.claim.email', '', false)`, [sub || "", role === "postgres" ? "" : role]);
    if (role !== "postgres") await c.query(`set role ${role}`);
    return c;
  };
  const tryq = async (c, sql, params = []) => { try { return { rows: (await c.query(sql, params)).rows }; } catch (e) { return { error: String(e.message || e) }; } };

  const quota = fs.readFileSync(path.join(ROOT, "supabase", "migrations", "20260723_bulk_scan_quota.sql"), "utf8");
  const sql1 = fs.readFileSync(path.join(ROOT, "docs", "audit-2026-10-18", "repair-batch-6", "sql", "1-scan-quota-guard-and-avatar-uploads.sql"), "utf8");
  const guards = sql1.slice(sql1.indexOf("-- Strict guard"), sql1.indexOf('drop policy if exists "avatars_member_insert"'));
  const members = fs.readFileSync(path.join(ROOT, "supabase", "migrations", "20260707_profile_members.sql"), "utf8");
  const isMember = members.slice(members.indexOf("create or replace function public.is_profile_member(p_profile uuid)"), members.indexOf("create or replace function public.is_profile_owner"));
  const trigger = fs.readFileSync(path.join(ROOT, "supabase", "migrations", "20260823_protect_profile_billing_columns.sql"), "utf8");
  await admin.query(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
    create table public.user_roles (email text primary key, role text);
    create table public.profiles (id uuid primary key, user_id uuid, created_at timestamptz not null default now(), tier text default 'FREE', tier_expires_at timestamptz, tier_source text, stripe_customer_id text, account_code text);
    create table public.profile_members (profile_id uuid not null references public.profiles(id) on delete cascade, user_id uuid not null, role text not null default 'member', primary key (profile_id, user_id));
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter table public.profiles enable row level security;
    create policy profiles_read on public.profiles for select using (true);
    create policy profiles_update_own on public.profiles for update using (auth.uid() = user_id);
    grant select, update on public.profiles to authenticated;
    grant all on public.profiles to service_role;
  `);
  await admin.query(isMember);
  await admin.query(quota);
  await admin.query(trigger);
  await admin.query(guards);
  const seed = async () => {
    await admin.query(`
      delete from public.profile_members; delete from public.profiles;
      insert into public.profiles (id, user_id, created_at) values ('${PA}', '${ALICE}', now() - interval '40 days'), ('${PB}', '${BOB}', now() - interval '40 days'), ('${PBIZ}', '${ALICE}', now() - interval '40 days'), ('${PC}', '${CAROL}', now() - interval '40 days');
      insert into public.profile_members (profile_id, user_id, role) values ('${PA}', '${ALICE}', 'owner'), ('${PB}', '${BOB}', 'owner'), ('${PBIZ}', '${ALICE}', 'owner'), ('${PC}', '${CAROL}', 'owner'), ('${PA}', '${CAROL}', 'member');
      update public.bulk_scan_quotas set monthly_limit = 3 where tier = 'FREE';
    `);
    try { await admin.query("delete from public.ai_scan_requests"); } catch { /* before the file exists */ }
  };
  await seed();
  const used = async (p) => (await admin.query("select bulk_scans_used u from public.profiles where id = $1", [p])).rows[0].u;
  const ledgerState = async (p, r) => (await admin.query("select state from public.ai_scan_requests where profile_id = $1 and request_id = $2", [p, r])).rows[0]?.state ?? null;

  // ───────── the situation BEFORE the file: why completion has to be server-only, and why the counter must be written by the server ─────────
  const member = await conn("authenticated", ALICE);
  const server = await conn("service_role", "");
  let r = await tryq(member, "select * from public.consume_bulk_scan($1, 1)", [PBIZ]);
  const afterMember = await used(PBIZ);
  check("EXISTING BEHAVIOUR (why the server must write the counter): a member's own session calls consume_bulk_scan, is told 'granted 1', and the counter does NOT move (the billing-column trigger puts it back)", !r.error && r.rows[0].granted === 1 && afterMember === 0, { r, afterMember });
  r = await tryq(server, "select * from public.consume_bulk_scan($1, 1)", [PBIZ]);
  check("the same function called by the server (service role) really moves the counter", !r.error && r.rows[0].granted === 1 && (await used(PBIZ)) === 1, r);
  r = await tryq(member, "update public.profiles set bulk_scans_used = 0 where id = $1 returning bulk_scans_used", [PBIZ]);
  check("a member editing their own counter directly gets nothing (the existing protection holds)", !r.error && (await used(PBIZ)) === 1, r);
  await seed();

  // ───────── apply ─────────
  const sql = fs.readFileSync(path.join(SQLD, "10-ai-scan-reservations.sql"), "utf8");
  await admin.query(sql); await admin.query(sql);
  check("the file applies and can be run again", true);
  const val = (await admin.query(fs.readFileSync(path.join(SQLD, "validation-10.sql"), "utf8").replace(/^--.*$/gm, ""))).rows[0].result;
  check("validation-10.sql: every value is true", Object.values(val).every((v) => v === true), val);

  const reserve = (c, user, profile, req, kind = "item") => tryq(c, "select * from public.reserve_ai_scan($1, $2, $3, $4)", [user, profile, req, kind]);
  const complete = (c, profile, req, ok) => tryq(c, "select * from public.complete_ai_scan($1, $2, $3)", [profile, req, ok]);

  // ───────── only the server may reserve or complete ─────────
  r = await reserve(member, ALICE, PA, R(1));
  check("a signed-in member cannot call reserve_ai_scan at all (permission denied)", !!r.error && /permission denied/.test(r.error), r);
  r = await complete(member, PA, R(1), false);
  check("a signed-in member cannot call complete_ai_scan at all (permission denied)", !!r.error && /permission denied/.test(r.error), r);
  const anon = await conn("anon", "");
  r = await reserve(anon, ALICE, PA, R(1)); const r2 = await complete(anon, PA, R(1), true);
  check("an anonymous caller cannot call either", !!r.error && !!r2.error && /permission denied/.test(r.error + r2.error), [r, r2]);
  r = await tryq(member, "select * from public.ai_scan_numbers($1)", [PA]);
  check("a member cannot call the number helper directly", !!r.error && /permission denied/.test(r.error), r);
  r = await tryq(member, "select * from public.ai_scan_requests");
  check("a member cannot read the request table", !!r.error && /permission denied/.test(r.error), r);

  // ───────── a member cannot refund or complete, including DURING the provider call ─────────
  r = await reserve(server, ALICE, PA, R(2));
  check("the server reserves one scan for the verified member (reserved, 1 of 3, counter really moved)", !r.error && r.rows[0].outcome === "reserved" && r.rows[0].used === 1 && (await used(PA)) === 1, r);
  // (the provider call is now "in flight")
  r = await complete(member, PA, R(2), false);
  check("IN FLIGHT: the member cannot refund their own reservation (permission denied)", !!r.error && /permission denied/.test(r.error), r);
  r = await complete(member, PA, R(2), true);
  check("IN FLIGHT: the member cannot mark it complete either", !!r.error && /permission denied/.test(r.error), r);
  r = await tryq(member, "update public.ai_scan_requests set state = 'released' where request_id = $1", [R(2)]);
  check("IN FLIGHT: the member cannot edit the reservation row directly", !!r.error && /permission denied/.test(r.error), r);
  r = await tryq(member, "update public.profiles set bulk_scans_used = 0 where id = $1", [PA]);
  check("IN FLIGHT: the member cannot reset their own counter either (the existing protection keeps it)", !r.error && (await used(PA)) === 1, r);
  r = await tryq(member, "select * from public.reserve_ai_scan($1, $2, $3, 'item')", [ALICE, PA, R(2)]);
  check("IN FLIGHT: nor can they re-reserve the same id themselves", !!r.error, r);
  check("after all those attempts the reservation is untouched: reserved, 1 used", (await ledgerState(PA, R(2))) === "reserved" && (await used(PA)) === 1);
  r = await complete(server, PA, R(2), true);
  check("the SERVER completes it: done, the scan stays spent", !r.error && r.rows[0].outcome === "done" && (await used(PA)) === 1, r);
  r = await complete(server, PA, R(2), false);
  check("a later 'refund' for a finished scan changes nothing (once only)", !r.error && r.rows[0].outcome === "done" && (await used(PA)) === 1, r);

  // ───────── legitimate refund works once ─────────
  r = await reserve(server, ALICE, PA, R(3));
  const used3 = await used(PA);
  r = await complete(server, PA, R(3), false);
  check("the server refunds a failed provider call: released, the scan is given back", !r.error && r.rows[0].outcome === "released" && (await used(PA)) === used3 - 1 && (await ledgerState(PA, R(3))) === "released", r);
  r = await complete(server, PA, R(3), false);
  check("refunding again does nothing more", !r.error && r.rows[0].outcome === "released" && (await used(PA)) === used3 - 1, r);
  r = await reserve(server, ALICE, PA, R(3));
  check("a released request id may be reserved again (a genuine retry)", !r.error && r.rows[0].outcome === "reserved" && (await used(PA)) === used3, r);
  await complete(server, PA, R(3), true);

  // ───────── membership is the VERIFIED user's, before anything is reserved ─────────
  await seed();
  r = await reserve(server, BOB, PA, R(10));
  check("CROSS-PROFILE: a verified user who is not a member of the profile is refused, nothing reserved", !!r.error && /not authorized/.test(r.error) && (await used(PA)) === 0 && (await ledgerState(PA, R(10))) === null, r);
  r = await reserve(server, CAROL, PA, R(11));
  check("a real second member of the profile may reserve (the same rule as the existing guard)", !r.error && r.rows[0].outcome === "reserved", r);
  r = await reserve(server, null, PA, R(12));
  check("no verified user at all is refused", !!r.error && /verified user/.test(r.error), r);
  r = await reserve(server, ALICE, PA, null);
  check("no request id is refused", !!r.error && /request id/.test(r.error), r);
  r = await reserve(server, ALICE, PA, R(13), "bogus");
  check("an unknown scan kind is refused", !!r.error && /unknown scan kind/.test(r.error), r);
  r = await reserve(server, ALICE, "99999999-9999-9999-9999-999999999999", R(14));
  check("a profile that does not exist is refused", !!r.error, r);
  r = await reserve(server, ALICE, PA, R(15), "coa");
  check("a certificate scan counts from the same allowance", !r.error && r.rows[0].used === 2, r);
  r = await reserve(server, ALICE, PA, R(15), "coa");
  check("a repeated request id is a duplicate and spends nothing", !r.error && r.rows[0].outcome === "duplicate" && (await used(PA)) === 2, r);
  r = await reserve(server, ALICE, PA, R(16)); const lim = await reserve(server, ALICE, PA, R(17));
  check("at the allowance the next request is 'limit' and spends nothing", !r.error && r.rows[0].outcome === "reserved" && !lim.error && lim.rows[0].outcome === "limit" && (await used(PA)) === 3 && (await ledgerState(PA, R(17))) === null, [r, lim]);

  // ───────── true concurrency: separate database connections ─────────
  const pool = async (n, role, sub) => Promise.all(Array.from({ length: n }, () => conn(role, sub)));
  await seed();
  const conns = await pool(16, "service_role", "");
  let res = await Promise.all(conns.map((c, i) => reserve(c, ALICE, PBIZ, R(100 + i))));
  let outcomes = res.map((x) => x.rows?.[0]?.outcome ?? "ERR:" + x.error);
  check("16 DIFFERENT requests on 16 separate connections at once against an allowance of 3: exactly 3 reserved, 13 limit, never more spent than allowed", outcomes.filter((o) => o === "reserved").length === 3 && outcomes.filter((o) => o === "limit").length === 13 && (await used(PBIZ)) === 3, { outcomes, used: await used(PBIZ) });
  await seed();
  res = await Promise.all(conns.map((c) => reserve(c, ALICE, PBIZ, R(200))));
  outcomes = res.map((x) => x.rows?.[0]?.outcome ?? "ERR:" + x.error);
  check("16 copies of ONE request on 16 connections at once: exactly one reserved, 15 duplicates, one scan spent", outcomes.filter((o) => o === "reserved").length === 1 && outcomes.filter((o) => o === "duplicate").length === 15 && (await used(PBIZ)) === 1, { outcomes, used: await used(PBIZ) });
  await seed();
  await admin.query("update public.profiles set bulk_scan_limit_override = 1 where id = $1", [PBIZ]);
  let wins = 0, over = 0;
  for (let round = 0; round < 12; round++) {
    await admin.query("update public.profiles set bulk_scans_used = 0 where id = $1", [PBIZ]);
    await admin.query("delete from public.ai_scan_requests where profile_id = $1", [PBIZ]);
    const two = await Promise.all([reserve(conns[0], ALICE, PBIZ, R(300 + round * 2)), reserve(conns[1], ALICE, PBIZ, R(301 + round * 2))]);
    const got = two.filter((x) => x.rows?.[0]?.outcome === "reserved").length;
    if (got === 1 && (await used(PBIZ)) === 1) wins++; else over++;
  }
  check("THE LAST SCAN: two connections race for the one scan left, 12 rounds: exactly one wins every time, the counter never passes the limit", wins === 12 && over === 0, { wins, over });

  // refunds and completions race
  await seed();
  await reserve(server, ALICE, PBIZ, R(400));
  res = await Promise.all(conns.slice(0, 8).map((c) => complete(c, PBIZ, R(400), false)));
  outcomes = res.map((x) => x.rows?.[0]?.outcome ?? "ERR:" + x.error);
  check("8 refunds of ONE reservation on 8 connections at once: the scan is given back exactly once", outcomes.every((o) => o === "released") && (await used(PBIZ)) === 0, { outcomes, used: await used(PBIZ) });
  await seed();
  await reserve(server, ALICE, PBIZ, R(401));
  res = await Promise.all(conns.slice(0, 8).map((c, i) => complete(c, PBIZ, R(401), i % 2 === 0)));
  const finalState = await ledgerState(PBIZ, R(401)); const usedNow = await used(PBIZ);
  check("a success and a failure reported at the SAME instant for one reservation: one outcome wins and the counter agrees with it (done = still spent, released = given back once)", (finalState === "done" && usedNow === 1) || (finalState === "released" && usedNow === 0), { finalState, usedNow, outcomes: res.map((x) => x.rows?.[0]?.outcome) });
  await seed();
  const mixed = await Promise.all([
    ...conns.slice(0, 6).map((c, i) => reserve(c, BOB, PA, R(500 + i))),          // refused: not a member of A
    ...conns.slice(6, 12).map((c, i) => reserve(c, ALICE, PA, R(520 + i))),       // A's own
    ...conns.slice(12, 16).map((c, i) => reserve(c, BOB, PB, R(540 + i))),        // B's own
  ]);
  const refusedCross = mixed.slice(0, 6).every((x) => !!x.error && /not authorized/.test(x.error));
  check("CROSS-PROFILE under load: six requests for someone else's profile are all refused while the owners' own requests are decided correctly (A: 3 of 6, B: 3 of 4)", refusedCross && (await used(PA)) === 3 && (await used(PB)) === 3, { used: [await used(PA), await used(PB)], refusedCross });

  // ───────── the control: the same race WITHOUT the profile lock ─────────
  await seed();
  const def = (await admin.query("select pg_get_functiondef('public.reserve_ai_scan(uuid,uuid,uuid,text)'::regprocedure) d")).rows[0].d;
  const nolock = def.replace("public.reserve_ai_scan(", "public.reserve_ai_scan_nolock(").replace("perform 1 from public.profiles where id = p_profile for update;", "perform 1 from public.profiles where id = p_profile;").replace("select * into n from public.ai_scan_numbers(p_profile);", "select * into n from public.ai_scan_numbers(p_profile);\n  perform pg_sleep(0.2);");
  if (nolock === def) throw new Error("control could not be built");
  await admin.query(nolock); await admin.query("grant execute on function public.reserve_ai_scan_nolock(uuid, uuid, uuid, text) to service_role");
  res = await Promise.all(conns.slice(0, 8).map((c, i) => tryq(c, "select * from public.reserve_ai_scan_nolock($1, $2, $3, 'item')", [ALICE, PBIZ, R(600 + i)])));
  const grantedNoLock = res.filter((x) => x.rows?.[0]?.outcome === "reserved").length;
  check("NEGATIVE CONTROL (proves this test can see the bug): the same function WITHOUT the profile lock reserves more than the allowance of 3 when 8 connections race", grantedNoLock > 3, { grantedNoLock });
  await admin.query("drop function public.reserve_ai_scan_nolock(uuid, uuid, uuid, text)");

  // ───────── status is read-only (no stale carry-over) ─────────
  await seed();
  await admin.query("update public.profiles set bulk_scans_used = 2, bulk_scans_cycle_start = (current_date - interval '90 days')::date where id = $1", [PBIZ]);
  const ticker = await conn("authenticated", ALICE);
  r = await tryq(ticker, "select * from public.bulk_scan_status($1)", [PBIZ]);
  const rowAfterStatus = (await admin.query("select bulk_scans_used u, bulk_scans_cycle_start s from public.profiles where id = $1", [PBIZ])).rows[0];
  check("a member's ticker read of a lapsed cycle answers 0 used and WRITES NOTHING (no cycle start moved while the old count stayed)", !r.error && r.rows[0].used === 0 && rowAfterStatus.u === 2 && new Date(rowAfterStatus.s) < new Date(Date.now() - 80 * 86400000), { r, rowAfterStatus });
  r = await reserve(server, ALICE, PBIZ, R(700));
  check("the server's next reservation rolls the cycle and counts the first scan of the new one (1 used)", !r.error && r.rows[0].outcome === "reserved" && r.rows[0].used === 1 && (await used(PBIZ)) === 1, r);
  r = await tryq(await conn("authenticated", BOB), "select * from public.bulk_scan_status($1)", [PA]);
  check("a stranger still cannot read someone else's status", !!r.error && /not authorized/.test(r.error), r);
  r = await tryq(anon, "select * from public.bulk_scan_status($1)", [PA]);
  check("and an anonymous caller cannot read it at all", !!r.error && /permission denied/.test(r.error), r);

  // refund only inside the same cycle; old rows cleared
  await admin.query("update public.profiles set bulk_scans_used = 2, bulk_scans_cycle_start = (current_date + interval '1 day')::date where id = $1", [PBIZ]);
  await admin.query("update public.ai_scan_requests set cycle_start = (current_date - interval '5 days')::date where request_id = $1", [R(700)]);
  r = await complete(server, PBIZ, R(700), false);
  check("a scan taken in an EARLIER cycle is not given back into the current one", !r.error && r.rows[0].outcome === "released" && (await used(PBIZ)) === 2, r);
  await admin.query(`insert into public.ai_scan_requests (profile_id, request_id, kind, state, cycle_start, created_at) values ('${PBIZ}', '${R(800)}', 'item', 'done', current_date, now() - interval '5 days')`);
  await reserve(server, ALICE, PBIZ, R(801));
  check("request rows older than 3 days are cleared out", (await ledgerState(PBIZ, R(800))) === null);

  // ───────── rollback ─────────
  await admin.query(fs.readFileSync(path.join(SQLD, "rollback-10.sql"), "utf8"));
  check("rollback removes the new functions and the table", (await admin.query("select to_regprocedure('public.reserve_ai_scan(uuid,uuid,uuid,text)') is null a, to_regprocedure('public.complete_ai_scan(uuid,uuid,boolean)') is null b, to_regclass('public.ai_scan_requests') is null c")).rows[0].a === true && (await admin.query("select to_regclass('public.ai_scan_requests') is null c")).rows[0].c === true);
  await seed();
  await admin.query("update public.profiles set bulk_scans_used = 2, bulk_scans_cycle_start = (current_date - interval '90 days')::date where id = $1", [PBIZ]);
  r = await tryq(server, "select * from public.bulk_scan_status($1)", [PBIZ]);
  const rolledBack = (await admin.query("select bulk_scans_used u from public.profiles where id = $1", [PBIZ])).rows[0].u;
  check("after rollback bulk_scan_status is the old version again (it writes the roll) and the existing spend function still works for the server", !r.error && rolledBack === 0 && (await tryq(server, "select * from public.consume_bulk_scan($1, 1)", [PBIZ])).rows?.[0]?.granted === 1, { r, rolledBack });
  await admin.query(sql);
  check("and the file can be applied again after a rollback, with validation true", Object.values((await admin.query(fs.readFileSync(path.join(SQLD, "validation-10.sql"), "utf8").replace(/^--.*$/gm, ""))).rows[0].result).every((v) => v === true));

  console.log(`\n${pass} of ${pass + fail} passed`);
  for (const c of clients) { try { await c.end(); } catch { /* done */ } }
  await admin.end(); await pgServer.stop();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* temp */ }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("RUNNER ERROR", e); process.exit(2); });
