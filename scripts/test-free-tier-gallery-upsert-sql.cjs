// Local PostgreSQL (PGlite) check of supabase/migrations/20261109_gallery_upsert_not_a_new_exhibition.sql against the original free-tier trigger.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const pgDir = process.env.PGLITE_DIR || 'C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite';
const { PGlite } = require(path.join(pgDir, 'node_modules/@electric-sql/pglite'));
const root = path.resolve(__dirname, '..'), mig = (f) => fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8');
const A = '11111111-1111-4111-8111-111111111111', FULL = '22222222-2222-4222-8222-222222222222';
let count = 0; const check = async (name, fn) => { await fn(); count++; console.log('PASS ' + name); };
async function main() { const db = new PGlite(); try {
  await db.exec(`create schema if not exists public; create table public.profiles(id uuid primary key, tier text, bonus_galleries integer not null default 0);
    create table public.galleries(id uuid primary key default gen_random_uuid(), profile_id uuid not null, title text, visibility text default 'PUBLIC');
    insert into public.profiles values('${A}', null, 0), ('${FULL}', 'FULL', 0);`);
  // the original function and trigger, taken from the real migration file (the tier-limit statements only)
  const orig = mig('20260819_server_side_tier_limits.sql'); const fn = orig.slice(orig.indexOf('create or replace function public.enforce_gallery_limit()')); await db.exec(fn);
  const up = (id, pid, vis) => db.query('insert into public.galleries(id,profile_id,title,visibility) values($1,$2,$3,$4) on conflict (id) do update set visibility = excluded.visibility, title = excluded.title returning visibility', [id, pid, 't', vis]);
  const ids = ['a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004'];
  await check('BEFORE fix: a free profile below the limit has Private rewritten to PUBLIC by an upsert of its existing exhibition', async () => { await up(ids[0], A, 'PUBLIC'); const r = await up(ids[0], A, 'LOCKED'); assert.equal(r.rows[0].visibility, 'PUBLIC'); });
  await check('BEFORE fix: at 4 exhibitions an upsert of an existing one fails with FREE_TIER_LIMIT', async () => { for (const id of ids.slice(1)) await up(id, A, 'PUBLIC'); await assert.rejects(up(ids[0], A, 'PUBLIC'), /FREE_TIER_LIMIT/); });
  await db.exec(mig('20261109_gallery_upsert_not_a_new_exhibition.sql')); await db.exec(mig('20261109_gallery_upsert_not_a_new_exhibition.sql'));
  await check('AFTER fix (applied twice): at 4 exhibitions an existing one can be saved', async () => { const r = await up(ids[0], A, 'PUBLIC'); assert.equal(r.rows[0].visibility, 'PUBLIC'); });
  await check('AFTER fix: the visibility chosen for an existing free-profile exhibition is kept (LOCKED, INVITE)', async () => { assert.equal((await up(ids[0], A, 'LOCKED')).rows[0].visibility, 'LOCKED'); assert.equal((await up(ids[1], A, 'INVITE')).rows[0].visibility, 'INVITE'); });
  await check('AFTER fix: a genuinely new fifth free exhibition is still refused', async () => { await assert.rejects(up('a0000000-0000-4000-8000-000000000005', A, 'PUBLIC'), /FREE_TIER_LIMIT/); });
  await check('AFTER fix: a new free exhibition is still created PUBLIC (first save of a new one keeps the existing rule)', async () => { await db.query("delete from public.galleries where profile_id = $1", [A]); const r = await up('b0000000-0000-4000-8000-000000000001', A, 'LOCKED'); assert.equal(r.rows[0].visibility, 'PUBLIC'); });
  await check('AFTER fix: paid profiles are untouched (new Private exhibition stays Private)', async () => { const r = await up('c0000000-0000-4000-8000-000000000001', FULL, 'LOCKED'); assert.equal(r.rows[0].visibility, 'LOCKED'); });
  console.log(count + '/' + count + ' local PostgreSQL checks passed');
} finally { await db.close(); } }
main().catch((e) => { console.error(e); process.exitCode = 1; });
