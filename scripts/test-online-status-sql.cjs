// Local PostgreSQL (PGlite) checks, as the ORDINARY roles (anon / authenticated), of the online-status migration, its validation (including the real direct-read check as an anonymous visitor and an unrelated signed-in account),
// its targeted repair and the rollbacks:  node scripts/test-online-status-sql.cjs
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const pgDir = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(pgDir, "node_modules/@electric-sql/pglite"));
const root = path.resolve(__dirname, ".."), read = (d, f) => fs.readFileSync(path.join(root, "supabase", d, f), "utf8");
const U1 = "00000000-0000-4000-8000-0000000000a1", U2 = "00000000-0000-4000-8000-0000000000a2", U3 = "00000000-0000-4000-8000-0000000000a3";
const P1 = "10000000-0000-4000-8000-000000000001", P2 = "10000000-0000-4000-8000-000000000002", P_PRIVATE = "10000000-0000-4000-8000-000000000003", P_UNFINISHED = "10000000-0000-4000-8000-000000000004", P3 = "10000000-0000-4000-8000-000000000005";
let n = 0; const check = async (name, fn) => { await fn(); n++; console.log("PASS " + name); };
(async () => { const db = new PGlite(); try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles (id uuid primary key, user_id uuid, display_name text, is_public boolean, onboarding_completed boolean, last_seen_at timestamptz);
    create table public.lounge_posts (id uuid primary key default gen_random_uuid(), profile_id uuid not null, body text, hidden_at timestamptz);
    create table public.lounge_post_comments (id uuid primary key default gen_random_uuid(), post_id uuid, profile_id uuid not null, body text, hidden_at timestamptz);
    create table public.public_content_reports (id uuid primary key default gen_random_uuid(), content_type text, content_id text, reason text, status text default 'open', created_at timestamptz default now());
    alter table public.profiles enable row level security;
    create policy owner_reads_own on public.profiles for select to authenticated using (user_id = auth.uid());
    create policy owner_updates_own on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    grant usage on schema public, auth to anon, authenticated; grant select, update on public.profiles to authenticated; grant select on public.lounge_posts, public.lounge_post_comments to authenticated;
    insert into auth.users values ('${U1}'), ('${U2}'), ('${U3}');
    insert into public.profiles values ('${P1}', '${U1}', 'One', true, true, now() - interval '2 minutes'), ('${P2}', '${U2}', 'Two', true, true, now() - interval '1 hour'), ('${P_PRIVATE}', '${U3}', 'Private', false, true, now()), ('${P_UNFINISHED}', '${U3}', 'Unfinished', true, false, now()), ('${P3}', '${U3}', 'Three', true, true, null);`);
  const as = async (sub, role, sql, params = []) => { await db.exec("reset role; select set_config('request.jwt.claim.sub', '" + (sub || "") + "', false); set role " + role); try { return (await db.query(sql, params)).rows; } finally { await db.exec("reset role"); } };
  const status = (who, id) => as(who === "anon" ? null : who, who === "anon" ? "anon" : "authenticated", "select * from public.get_public_online_status($1)", [id]);

  // ---- online status
  await db.exec(read("migrations", "20261112_online_status_off_by_default.sql")); await db.exec(read("migrations", "20261112_online_status_off_by_default.sql"));
  await check("ONLINE STATUS (applied twice): every existing profile starts OFF", async () => { const r = await db.query("select count(*)::int as c from public.profiles where show_online_status"); assert.equal(r.rows[0].c, 0); assert.equal((await db.query("select count(*)::int as c from public.profiles")).rows[0].c, 5); });
  await check("OFF by default: a signed-out visitor and another signed-in person get visible=false and NO last-active time for anyone", async () => { for (const p of [P1, P2, P_PRIVATE, P3]) { for (const who of ["anon", U2]) { const r = (await status(who, p))[0]; assert.equal(r.visible, false); assert.equal(r.last_seen_at, null); } } });
  await check("a visitor cannot read last_seen_at straight from the table either (row-level security) and cannot switch anyone's status", async () => { await assert.rejects(() => as(null, "anon", "select last_seen_at from public.profiles")); await assert.rejects(() => as(null, "anon", "update public.profiles set show_online_status = true")); assert.equal((await as(U2, "authenticated", "select last_seen_at from public.profiles where id = $1", [P1])).length, 0); const upd = await as(U2, "authenticated", "update public.profiles set show_online_status = true where id = $1 returning id", [P1]); assert.equal(upd.length, 0); });
  await check("the owner switches their own status ON: visitors then see visible=true and the last-active time, and only for that profile", async () => { const upd = await as(U1, "authenticated", "update public.profiles set show_online_status = true where id = $1 returning id", [P1]); assert.equal(upd.length, 1);
    for (const who of ["anon", U2]) { const r = (await status(who, P1))[0]; assert.equal(r.visible, true); assert.ok(r.last_seen_at); assert.equal((await status(who, P2))[0].visible, false); } });
  await check("ON for a person who has never been seen: visible=true with no time (the page shows nothing misleading)", async () => { await as(U3, "authenticated", "update public.profiles set show_online_status = true where id = $1", [P3]); const r = (await status("anon", P3))[0]; assert.equal(r.visible, true); assert.equal(r.last_seen_at, null); });
  await check("a private or unfinished profile never shows a status, even with the switch on", async () => { await as(U3, "authenticated", "update public.profiles set show_online_status = true where id in ($1, $2)", [P_PRIVATE, P_UNFINISHED]); for (const p of [P_PRIVATE, P_UNFINISHED]) { const r = (await status("anon", p))[0]; assert.equal(r.visible, false); assert.equal(r.last_seen_at, null); } });
  await check("an unknown profile id returns nothing; turning the switch off hides the time again", async () => { assert.equal((await status("anon", "10000000-0000-4000-8000-0000000000ff")).length, 0); await as(U1, "authenticated", "update public.profiles set show_online_status = false where id = $1", [P1]); const r = (await status("anon", P1))[0]; assert.equal(r.visible, false); assert.equal(r.last_seen_at, null); });
  await db.exec("alter table public.profiles add column session_started_at timestamptz; update public.profiles set session_started_at = last_seen_at;");
  const validate = async () => { const res = await db.exec(read("validation", "20261112_online_status_checks.sql").replace(/^--.*$/gm, "")); return res[res.length - 1].rows[0].validation; };
  await check("online-status validation SQL answers as expected (read-only)", async () => { const v = await validate(); for (const k of ["column_exists", "column_default_is_false", "column_not_null", "function_exists", "visitors_can_call_it"]) assert.equal(v[k], true, k); assert.equal(Number(v.profiles_total), 5); });
  await check("DIRECT-READ CHECK, expected result: an anonymous visitor and an unrelated signed-in account read NO hidden last-active time; privacy_status COMPLETE", async () => {
    const v = await validate(); assert.ok(v.hidden_activity_profiles_total > 0, "there is hidden activity to test against");
    for (const k of ["anon_last_seen_at_readable", "anon_session_started_at_readable", "signed_in_unrelated_last_seen_at_readable", "signed_in_unrelated_session_started_at_readable"]) assert.equal(Number(v[k]), 0, k);
    assert.equal(v.privacy_status, "COMPLETE"); assert.equal(v.anon_last_seen_at_readable === 0 && v.anon_last_seen_at_blocked, true, "anonymous has no table access at all here"); });
  await check("DIRECT-READ CHECK finds an exposure for an anonymous visitor: privacy_status INCOMPLETE, and only the anonymous counts are above zero", async () => {
    await db.exec("grant select on public.profiles to anon; create policy leak_anon on public.profiles for select to anon using (true);");
    const v = await validate(); assert.ok(v.privacy_status.startsWith("INCOMPLETE"), v.privacy_status); assert.ok(v.anon_last_seen_at_readable > 0); assert.equal(Number(v.signed_in_unrelated_last_seen_at_readable), 0);
    await db.exec("drop policy leak_anon on public.profiles; revoke select on public.profiles from anon;"); assert.equal((await validate()).privacy_status, "COMPLETE"); });
  await check("DIRECT-READ CHECK finds an exposure for an unrelated signed-in account: privacy_status INCOMPLETE, and only the signed-in counts are above zero", async () => {
    await db.exec("create policy leak_auth on public.profiles for select to authenticated using (true);");
    const v = await validate(); assert.ok(v.privacy_status.startsWith("INCOMPLETE"), v.privacy_status); assert.ok(v.signed_in_unrelated_last_seen_at_readable > 0); assert.ok(v.signed_in_unrelated_session_started_at_readable > 0); assert.equal(Number(v.anon_last_seen_at_readable), 0); });
  await check("the TARGETED REPAIR closes it: validation COMPLETE again; rows and other columns still readable; select * is refused (so the app's two select-star reads must be listed); roles without access gain none", async () => {
    await db.exec(read("repairs", "20261112_online_status_repair_if_exposed.sql")); await db.exec(read("repairs", "20261112_online_status_repair_if_exposed.sql"));
    const v = await validate(); assert.equal(v.privacy_status, "COMPLETE", JSON.stringify(v)); assert.equal(v.signed_in_unrelated_last_seen_at_blocked, true);
    const rows = await as(U2, "authenticated", "select id, user_id, display_name, is_public, show_online_status from public.profiles"); assert.ok(rows.length >= 5, "every row is still readable");
    await assert.rejects(() => as(U2, "authenticated", "select * from public.profiles"), /permission denied/); await assert.rejects(() => as(U2, "authenticated", "select last_seen_at from public.profiles"), /permission denied/);
    await assert.rejects(() => as(null, "anon", "select id from public.profiles"), /permission denied/); // anon never had access and still has none
    assert.equal((await as(U1, "authenticated", "update public.profiles set display_name = 'One' where id = $1 returning id", [P1])).length, 1, "writes are unchanged");
    const touch = (await status("anon", P1))[0]; assert.ok("visible" in touch, "the public lookup function still works"); });
  await check("the repair's ROLLBACK restores the earlier state (exposure back, so INCOMPLETE), and a profile with no hidden activity gives INCONCLUSIVE, not a false COMPLETE", async () => {
    await db.exec(read("rollback", "20261112_online_status_repair_rollback.sql")); await db.exec(read("rollback", "20261112_online_status_repair_rollback.sql"));
    assert.ok((await validate()).privacy_status.startsWith("INCOMPLETE")); await db.exec("drop policy leak_auth on public.profiles;"); assert.equal((await validate()).privacy_status, "COMPLETE");
    await db.exec("create temp table keep as select id, last_seen_at, session_started_at from public.profiles; update public.profiles set last_seen_at = null, session_started_at = null;");
    assert.ok((await validate()).privacy_status.startsWith("INCONCLUSIVE")); await db.exec("update public.profiles p set last_seen_at = k.last_seen_at, session_started_at = k.session_started_at from keep k where k.id = p.id; drop table keep;"); });

  // ---- rollbacks
  await db.exec(read("rollback", "20261112_online_status_rollback.sql")); await db.exec(read("rollback", "20261112_online_status_rollback.sql"));
  await check("ROLLBACK of the online-status migration (twice): function and column are gone; profiles intact", async () => { assert.equal((await db.query("select to_regprocedure('public.get_public_online_status(uuid)') as p")).rows[0].p, null); assert.equal((await db.query("select count(*)::int as c from public.profiles")).rows[0].c, 5); assert.equal((await db.query("select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'show_online_status'")).rows.length, 0); });
  await check("the migration can be installed again after its rollback", async () => { await db.exec(read("migrations", "20261112_online_status_off_by_default.sql")); assert.equal((await db.query("select count(*)::int as c from information_schema.columns where table_name = 'profiles' and column_name = 'show_online_status'")).rows[0].c, 1); });
  console.log(n + "/" + n + " local PostgreSQL checks passed");
} finally { await db.close(); } })().catch((e) => { console.error(e); process.exitCode = 1; });
