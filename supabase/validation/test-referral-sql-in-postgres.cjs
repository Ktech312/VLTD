// Tests supabase/migrations/20261019_referral_codes_own_rows_only.sql and supabase/validation/referral_codes_own_only_checks.sql in a real
// (in-process) Postgres, rebuilt from the policies, grants, constraints and function bodies EK pasted from production on 2026-10-17.
// Needs @electric-sql/pglite (not a project dependency): npm i @electric-sql/pglite in a scratch folder and run from there.
//   node test-referral-sql-in-postgres.cjs
const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");
const ROOT = path.resolve(__dirname, "..", "..");
const MIG = fs.readFileSync(path.join(ROOT, "supabase/migrations/20261019_referral_codes_own_rows_only.sql"), "utf8");
const CHECKS = fs.readFileSync(path.join(ROOT, "supabase/validation/referral_codes_own_only_checks.sql"), "utf8");
let pass = 0, fail = 0;
const t = (name, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(d ?? "").slice(0, 300)); };
const J = "00000000-0000-0000-0000-0000000000a1", K = "00000000-0000-0000-0000-0000000000b2", R = "00000000-0000-0000-0000-0000000000c3"; // R = a real third person
const ADMIN = "00000000-0000-0000-0000-0000000000d4";
const E = { J: "j@example.test", K: "k@example.test", ADMIN: "admin@example.test", OWNER: "eck1679@gmail.com" };

async function build() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.email() returns text language sql stable as $$ select auth.jwt() ->> 'email' $$;
    grant usage on schema public, auth to public;
    grant execute on function auth.uid(), auth.jwt(), auth.email() to public;
    create table public.user_roles (id uuid primary key default gen_random_uuid(), email text not null unique, role text not null default 'admin');
    insert into public.user_roles (email) values ('${E.ADMIN}');
    create function public.is_vltd_admin() returns boolean language sql stable security definer set search_path to 'public' as $f$
      select (auth.jwt() ->> 'email') = 'eck1679@gmail.com' or exists (select 1 from public.user_roles r where r.email = (auth.jwt() ->> 'email')); $f$;
    create table public.referral_codes (id uuid primary key default gen_random_uuid(), user_id uuid not null unique, code text not null unique, created_at timestamptz not null default now());
    create table public.referral_redemptions (id uuid primary key default gen_random_uuid(), code text not null, referrer_id uuid not null, referred_id uuid not null unique, created_at timestamptz not null default now());
    create table public.user_perks (id uuid primary key default gen_random_uuid(), user_id uuid not null unique, bonus_galleries integer not null default 0, reason text, granted_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    alter table public.referral_codes enable row level security; alter table public.referral_redemptions enable row level security; alter table public.user_perks enable row level security;
    create policy "Own referral code" on public.referral_codes for all to public using (auth.uid() = user_id);
    create policy "Read any code" on public.referral_codes for select to public using (true);
    create policy "Insert redemption" on public.referral_redemptions for insert to public with check (auth.uid() = referred_id);
    create policy "Own redemptions" on public.referral_redemptions for select to public using (auth.uid() = referrer_id or auth.uid() = referred_id);
    create policy "Own perks" on public.user_perks for select to public using (auth.uid() = user_id);
    create function public.increment_user_perk_galleries(p_user_id uuid, p_amount integer, p_reason text, p_granted_by text) returns void language plpgsql as $f$
      begin insert into user_perks (user_id, bonus_galleries, reason, granted_by) values (p_user_id, p_amount, p_reason, p_granted_by) on conflict (user_id) do update set bonus_galleries = user_perks.bonus_galleries + p_amount, updated_at = now(); end; $f$;
    grant execute on function public.increment_user_perk_galleries(uuid, integer, text, text) to public, anon, authenticated, service_role;
    grant all on public.referral_codes to authenticated, service_role; grant delete, insert, update, references, trigger, truncate on public.referral_codes to anon;
    grant all on public.referral_redemptions, public.user_perks to anon, authenticated, service_role;
    insert into public.referral_codes (user_id, code) values ('${J}', 'JJJJJ0001'), ('${K}', 'KKKKK0002'), ('${R}', 'RRRRR0003');
  `);
  return db;
}
async function as(db, role, uid, email, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false), set_config('request.jwt.claims', '${email ? JSON.stringify({ email, sub: uid }) : ""}', false); set role ${role};`);
  try { const r = await db.query(sql, params); await db.exec("reset role"); return { rows: r.rows }; }
  catch (e) { await db.exec("reset role"); return { error: String(e.message || e) }; }
}
const checkRows = async (db) => (await db.query(CHECKS)).rows;

(async () => {
  const db = await build();
  console.log("=== BEFORE the migration (today's production rules) ===");
  const before = await checkRows(db);
  t("[before] the checks file shows today's exposure: rows 1, 2, 4, 5, 6, 7, 10 are not yet as wanted, the rest already are", JSON.stringify(before.filter((r) => r.ok_after_change === false).map((r) => r.n)) === JSON.stringify([1, 2, 4, 5, 6, 7, 10]), before.filter((r) => r.ok_after_change === false).map((r) => r.n));
  const listBefore = await as(db, "authenticated", J, E.J, "select user_id, code from public.referral_codes");
  t("[before] a signed-in account lists everyone's codes and account ids (the exposure)", listBefore.rows?.length === 3, listBefore);
  const lookBefore = await as(db, "authenticated", J, E.J, "select user_id from public.referral_codes where code = 'KKKKK0002'");
  t("[before] ...and finds a code owner's id from the code alone", lookBefore.rows?.length === 1, lookBefore);

  await db.exec(MIG); await db.exec(MIG); // twice: repeatable
  console.log("\n=== AFTER the migration (run twice) ===");
  const after = await checkRows(db);
  t("[after] every row of the checks file with an expected value is true", after.filter((r) => r.expected_after_change !== null).every((r) => r.ok_after_change === true), after.filter((r) => r.ok_after_change === false));
  t("[after] the info row names exactly the two policies that remain", /Admins read all referral codes \(SELECT\), Own referral code \(ALL\)/.test(after.find((r) => r.n === 16).check_name), after.find((r) => r.n === 16).check_name);

  // own access
  const own = await as(db, "authenticated", J, E.J, "select code from public.referral_codes where user_id = $1", [J]);
  t("[after] own: an account reads its own code", own.rows?.length === 1 && own.rows[0].code === "JJJJJ0001", own);
  const listAfter = await as(db, "authenticated", J, E.J, "select user_id, code from public.referral_codes");
  t("[after] cross: listing with no filter returns only the account's own row", listAfter.rows?.length === 1 && listAfter.rows[0].user_id === J, listAfter);
  const byUser = await as(db, "authenticated", J, E.J, "select code from public.referral_codes where user_id = $1", [K]);
  t("[after] cross: looking up another account by its id returns nothing", byUser.rows?.length === 0, byUser);
  const byCode = await as(db, "authenticated", J, E.J, "select user_id from public.referral_codes where code = 'KKKKK0002'");
  t("[after] cross: looking up a code owner's id from the code returns nothing", byCode.rows?.length === 0, byCode);
  const mk = await as(db, "authenticated", ADMIN + "", "newuser@example.test", "insert into public.referral_codes (user_id, code) values ($1, 'NEWNEW0009') returning code", [ADMIN]);
  t("[after] own: a new account still creates its own code (insert, then reads it back)", mk.rows?.length === 1 && mk.rows[0].code === "NEWNEW0009", mk);
  const forge = await as(db, "authenticated", J, E.J, "insert into public.referral_codes (user_id, code) values ($1, 'FORGED0001')", [K]);
  t("[after] cross: still cannot create a code for someone else", !!forge.error && /row-level security/i.test(forge.error), forge);
  const del = await as(db, "authenticated", J, E.J, "delete from public.referral_codes where code = 'KKKKK0002' returning code");
  t("[after] cross: still cannot delete someone else's code (0 rows)", del.rows?.length === 0, del);
  const upd = await as(db, "authenticated", J, E.J, "update public.referral_codes set code = 'HIJACK0001' where user_id = $1 returning code", [K]);
  t("[after] cross: still cannot change someone else's code (0 rows)", upd.rows?.length === 0, upd);
  const anonR = await as(db, "anon", null, null, "select code from public.referral_codes");
  t("[after] a visitor still cannot read referral_codes", !!anonR.error && /permission denied/i.test(anonR.error), anonR);

  // admin
  const adm = await as(db, "authenticated", "00000000-0000-0000-0000-0000000000d4", E.ADMIN, "select user_id, code from public.referral_codes order by code");
  t("[after] admin (a user_roles address) still lists every code", adm.rows?.length >= 3, adm);
  const own2 = await as(db, "authenticated", "00000000-0000-0000-0000-0000000000e5", E.OWNER, "select code from public.referral_codes");
  t("[after] the owner address still lists every code", own2.rows?.length >= 3, own2);
  const notAdm = await as(db, "authenticated", K, E.K, "select code from public.referral_codes");
  t("[after] a non-admin account that is not in user_roles sees only its own row", notAdm.rows?.length === 1 && notAdm.rows[0].code === "KKKKK0002", notAdm);

  // redemption through the function
  const r1 = await as(db, "authenticated", J, E.J, "select public.redeem_referral_code($1) as r", ["kkkkk0002 "]);
  t("[after] redeem: J redeems K's code (typed in lower case with a trailing space) through the function", r1.rows?.[0]?.r?.ok === true, r1);
  t("[after] redeem: the answer carries only ok (no id, no owner)", JSON.stringify(Object.keys(r1.rows?.[0]?.r || {})) === JSON.stringify(["ok"]), r1);
  const rec = (await db.query("select referrer_id, referred_id, code from public.referral_redemptions")).rows;
  t("[after] redeem: the redemption is recorded with K as referrer, J as referred, the normalised code", rec.length === 1 && rec[0].referrer_id === K && rec[0].referred_id === J && rec[0].code === "KKKKK0002", rec);
  const own3 = await as(db, "authenticated", J, E.J, "select referrer_id from public.referral_redemptions");
  t("[after] redeem: J can see its own redemption, nobody else's", own3.rows?.length === 1, own3);
  const r2 = await as(db, "authenticated", J, E.J, "select public.redeem_referral_code('KKKKK0002') as r");
  t("[after] redeem: redeeming again is refused in plain words", r2.rows?.[0]?.r?.ok === false && /already/i.test(r2.rows[0].r.error), r2);
  const r3 = await as(db, "authenticated", K, E.K, "select public.redeem_referral_code('KKKKK0002') as r");
  t("[after] redeem: your own code is refused", r3.rows?.[0]?.r?.ok === false && /yourself/i.test(r3.rows[0].r.error), r3);
  const r4 = await as(db, "authenticated", K, E.K, "select public.redeem_referral_code('NOSUCH') as r");
  t("[after] redeem: an unknown code is refused as invalid", r4.rows?.[0]?.r?.ok === false && /invalid/i.test(r4.rows[0].r.error), r4);
  const r5 = await as(db, "authenticated", K, E.K, "select public.redeem_referral_code(null) as r");
  t("[after] redeem: an empty code is refused as invalid, not an error", r5.rows?.[0]?.r?.ok === false && /invalid/i.test(r5.rows[0].r.error), r5);
  const r6 = await as(db, "anon", null, null, "select public.redeem_referral_code('KKKKK0002') as r");
  t("[after] redeem: a visitor cannot call the function", !!r6.error && /permission denied/i.test(r6.error), r6);
  const perks = (await db.query("select count(*)::int as n from public.user_perks")).rows[0].n;
  t("[after] redeem: no bonus galleries were granted (unchanged behaviour)", perks === 0, perks);
  const grant = await as(db, "authenticated", J, E.J, "select public.increment_user_perk_galleries($1, 1, 'x', 'x')", [J]);
  t("[after] unchanged: a signed-in account still cannot grant itself galleries through the helper", !!grant.error && /row-level security/i.test(grant.error), grant);
  const svc = await as(db, "service_role", null, null, "select (select count(*) from public.referral_codes)::int as c");
  t("[after] the service key still reads everything", svc.rows?.[0]?.c === 4, svc);
  const pol = (await db.query("select policyname from pg_policies where tablename = 'referral_redemptions' order by 1")).rows.map((r) => r.policyname);
  t("[after] referral_redemptions policies untouched", JSON.stringify(pol) === JSON.stringify(["Insert redemption", "Own redemptions"]), pol);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
