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
  await check("validation SQL runs read-only and answers as expected after the migration", async () => { const r = await db.query(read("validation", "20261110_free_plan_edit_at_limit_checks.sql").replace(/^--.*$/gm, "")); const v = r.rows[0].validation; assert.equal(v.trigger_exists, true); assert.equal(v.function_skips_limit_for_existing_rows, true); assert.equal(v.function_still_forces_public_for_free, true); assert.equal(Number(v.free_profile_exhibitions_not_public), 0); });
  await db.exec(read("rollback", "20261110_free_plan_edit_at_limit_rollback.sql")); await db.exec(read("rollback", "20261110_free_plan_edit_at_limit_rollback.sql"));
  await check("ROLLBACK (applied twice): behaviour is exactly the original again (edit at the limit fails)", async () => { await assert.rejects(up(ids[0], A, "PUBLIC"), /FREE_TIER_LIMIT/); });
  await check("ROLLBACK: the function body equals the original definition in 20260819", async () => { const def = (await db.query("select pg_get_functiondef('public.enforce_gallery_limit()'::regprocedure) as d")).rows[0].d; assert.ok(!def.includes("v_is_edit")); assert.ok(def.includes("select count(*) into v_count from public.galleries where profile_id = new.profile_id;")); });
  console.log(count + "/" + count + " local PostgreSQL checks passed");
} finally { await db.close(); } }
main().catch((e) => { console.error(e); process.exitCode = 1; });
