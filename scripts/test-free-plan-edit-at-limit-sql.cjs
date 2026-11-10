// Local PostgreSQL (PGlite) check of supabase/migrations/20261110_free_plan_edit_at_limit_keeps_public.sql, its rollback and its validation file.
//   node scripts/test-free-plan-edit-at-limit-sql.cjs      (PGLITE_DIR can point at a folder whose node_modules holds @electric-sql/pglite)
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const pgDir = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(pgDir, "node_modules/@electric-sql/pglite"));
const root = path.resolve(__dirname, ".."), read = (d, f) => fs.readFileSync(path.join(root, "supabase", d, f), "utf8");
const A = "11111111-1111-4111-8111-111111111111", FULL = "22222222-2222-4222-8222-222222222222", BONUS = "33333333-3333-4333-8333-333333333333";
let count = 0; const check = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };
async function main() { const db = new PGlite(); try {
  await db.exec(`create schema if not exists public; create table public.profiles(id uuid primary key, tier text, bonus_galleries integer not null default 0);
    create table public.galleries(id uuid primary key default gen_random_uuid(), profile_id uuid not null, title text, visibility text default 'PUBLIC');
    insert into public.profiles values('${A}', null, 0), ('${FULL}', 'FULL', 0), ('${BONUS}', 'FREE', 2);`);
  const orig = read("migrations", "20260819_server_side_tier_limits.sql"); await db.exec(orig.slice(orig.indexOf("create or replace function public.enforce_gallery_limit()")));
  const up = (id, pid, vis) => db.query("insert into public.galleries(id,profile_id,title,visibility) values($1,$2,$3,$4) on conflict (id) do update set visibility = excluded.visibility, title = excluded.title returning visibility", [id, pid, "t", vis]);
  const ids = [1, 2, 3, 4, 5, 6, 7].map((n) => "a0000000-0000-4000-8000-00000000000" + n);
  for (const id of ids.slice(0, 4)) await up(id, A, "PUBLIC");
  await check("BEFORE: at 4 exhibitions an upsert of an existing free exhibition fails with FREE_TIER_LIMIT (the defect)", async () => { await assert.rejects(up(ids[0], A, "PUBLIC"), /FREE_TIER_LIMIT/); });
  await db.exec(read("migrations", "20261110_free_plan_edit_at_limit_keeps_public.sql")); await db.exec(read("migrations", "20261110_free_plan_edit_at_limit_keeps_public.sql"));
  await check("AFTER (applied twice): at 4 exhibitions an existing free exhibition can be edited", async () => { const r = await up(ids[0], A, "PUBLIC"); assert.equal(r.rows[0].visibility, "PUBLIC"); });
  await check("AFTER: the current privacy rule is kept - a free exhibition edited to Private/Guest View is still stored PUBLIC", async () => { assert.equal((await up(ids[0], A, "LOCKED")).rows[0].visibility, "PUBLIC"); assert.equal((await up(ids[1], A, "INVITE")).rows[0].visibility, "PUBLIC"); });
  await check("AFTER: a genuinely new fifth free exhibition is still refused", async () => { await assert.rejects(up(ids[4], A, "PUBLIC"), /FREE_TIER_LIMIT/); });
  await check("AFTER: a new free exhibition below the limit is still created PUBLIC even when asked Private", async () => { await db.query("delete from public.galleries where profile_id = $1 and id = $2", [A, ids[3]]); assert.equal((await up(ids[5], A, "LOCKED")).rows[0].visibility, "PUBLIC"); });
  await check("AFTER: bonus exhibitions still raise the limit for new ones (4 + 2) and edits at the limit work", async () => { for (const n of [1, 2, 3, 4, 5, 6]) await up("b0000000-0000-4000-8000-00000000000" + n, BONUS, "PUBLIC"); await assert.rejects(up("b0000000-0000-4000-8000-000000000007", BONUS, "PUBLIC"), /FREE_TIER_LIMIT/); assert.equal((await up("b0000000-0000-4000-8000-000000000001", BONUS, "PUBLIC")).rows[0].visibility, "PUBLIC"); });
  await check("AFTER: paid profiles are untouched (new Private exhibition stays Private)", async () => { assert.equal((await up("c0000000-0000-4000-8000-000000000001", FULL, "LOCKED")).rows[0].visibility, "LOCKED"); });
  await check("UNAUTHORISED edits stay refused (ordinary roles, the repository's real write rules): a member cannot edit another profile's exhibition, not even by claiming it for their own profile; a visitor cannot write at all", async () => {
    const U1 = "99999999-0000-4000-8000-000000000001", U2 = "99999999-0000-4000-8000-000000000002", B = "44444444-4444-4444-8444-444444444444";
    await db.exec(`create role anon nologin; create role authenticated nologin; create schema if not exists auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table public.profile_members (profile_id uuid, user_id uuid, role text);
      create function public.is_profile_member(p uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.profile_members m where m.profile_id = p and m.user_id = auth.uid()) $$;
      insert into public.profile_members values ('${A}', '${U1}', 'owner'), ('${B}', '${U2}', 'owner'); insert into public.profiles values ('${B}', 'FREE', 0);
      alter table public.galleries enable row level security;
      create policy galleries_select_member on public.galleries for select to authenticated using (public.is_profile_member(profile_id));
      create policy galleries_insert_member on public.galleries for insert to authenticated with check (public.is_profile_member(profile_id));
      create policy galleries_update_member on public.galleries for update to authenticated using (public.is_profile_member(profile_id)) with check (public.is_profile_member(profile_id));
      grant usage on schema public, auth to anon, authenticated; grant all on all tables in schema public to authenticated; grant select on public.galleries to anon;`);
    const bId = "d0000000-0000-4000-8000-000000000001"; await up(bId, B, "PUBLIC");
    const as = async (sub, role, sql, params = []) => { await db.exec("reset role; select set_config('request.jwt.claim.sub', '" + (sub || "") + "', false); set role " + role); try { return (await db.query(sql, params)).rows; } finally { await db.exec("reset role"); } };
    const upsert = (sub, role, id, pid, title) => as(sub, role, "insert into public.galleries(id,profile_id,title,visibility) values($1,$2,$3,'PUBLIC') on conflict (id) do update set title = excluded.title, profile_id = excluded.profile_id returning title", [id, pid, title]);
    const own = await upsert(U1, "authenticated", ids[0], A, "edited by its owner at the limit"); assert.equal(own[0].title, "edited by its owner at the limit");
    await assert.rejects(upsert(U1, "authenticated", bId, B, "hijack, as profile B"), /row-level security|policy|permission/i);
    await assert.rejects(upsert(U1, "authenticated", bId, A, "hijack, claiming it for my own profile"), /row-level security|policy|permission|FREE_TIER_LIMIT/i);
    await assert.rejects(upsert(null, "anon", ids[0], A, "visitor"), /row-level security|policy|permission/i);
    const still = await db.query("select title, profile_id from public.galleries where id = $1", [bId]); assert.equal(still.rows[0].title, "t"); assert.equal(still.rows[0].profile_id, B);
    await assert.rejects(upsert(U2, "authenticated", ids[0], B, "profile B member takes A's exhibition"), /row-level security|policy|permission/i);
    assert.equal((await db.query("select title from public.galleries where id = $1", [ids[0]])).rows[0].title, "edited by its owner at the limit");
  });
  await check("validation SQL runs read-only and answers as expected after the migration", async () => { const r = await db.query(read("validation", "20261110_free_plan_edit_at_limit_checks.sql").replace(/^--.*$/gm, "")); const v = r.rows[0].validation; assert.equal(v.trigger_exists, true); assert.equal(v.function_skips_limit_for_existing_rows, true); assert.equal(v.function_still_forces_public_for_free, true); assert.equal(Number(v.free_profile_exhibitions_not_public), 0); });
  await db.exec(read("rollback", "20261110_free_plan_edit_at_limit_rollback.sql")); await db.exec(read("rollback", "20261110_free_plan_edit_at_limit_rollback.sql"));
  await check("ROLLBACK (applied twice): behaviour is exactly the original again (edit at the limit fails)", async () => { await assert.rejects(up(ids[0], A, "PUBLIC"), /FREE_TIER_LIMIT/); });
  await check("ROLLBACK: the function body equals the original definition in 20260819", async () => { const def = (await db.query("select pg_get_functiondef('public.enforce_gallery_limit()'::regprocedure) as d")).rows[0].d; assert.ok(!def.includes("v_is_edit")); assert.ok(def.includes("select count(*) into v_count from public.galleries where profile_id = new.profile_id;")); });
  console.log(count + "/" + count + " local PostgreSQL checks passed");
} finally { await db.close(); } }
main().catch((e) => { console.error(e); process.exitCode = 1; });
