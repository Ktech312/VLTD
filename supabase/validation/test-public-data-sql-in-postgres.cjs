// Tests supabase/migrations/20261018_restrict_visitor_reads_referral_codes_appreciations.sql and supabase/validation/public_data_before_after_checks.sql in a real
// (in-process) Postgres, for the three ways visitors can hold access today: a grant made to them directly (Supabase's default), a grant to PUBLIC
// that they inherit, and both. Needs @electric-sql/pglite (not a project dependency): npm i @electric-sql/pglite in a scratch folder and run from there.
//   node test-public-data-sql-in-postgres.cjs
const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");
const ROOT = path.resolve(__dirname, "..", "..");
const FINAL = fs.readFileSync(path.join(ROOT, "supabase/migrations/20261018_restrict_visitor_reads_referral_codes_appreciations.sql"), "utf8");
const CHECKS = fs.readFileSync(path.join(ROOT, "supabase/validation/public_data_before_after_checks.sql"), "utf8");
let pass = 0, fail = 0;
const t = (name, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(d ?? "").slice(0, 300)); };

const U1 = "00000000-0000-0000-0000-0000000000a1", U2 = "00000000-0000-0000-0000-0000000000b2";
const P1 = "10000000-0000-0000-0000-0000000000a1", P2 = "10000000-0000-0000-0000-0000000000b2";

async function build(scenario) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to public;
    grant execute on function auth.uid() to public;
    create table public.profiles (id uuid primary key, user_id uuid not null);
    create table public.vault_items (id text primary key);
    create table public.referral_codes (id uuid primary key default gen_random_uuid(), user_id uuid not null, code text not null unique, created_at timestamptz not null default now());
    create table public.appreciations (id uuid primary key default gen_random_uuid(), item_id text not null references public.vault_items(id) on delete cascade, profile_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(), unique (item_id, profile_id));
    alter table public.referral_codes enable row level security;
    create policy "codes readable" on public.referral_codes for select using (true);
    create policy "own code insert" on public.referral_codes for insert with check (user_id = auth.uid());
    alter table public.appreciations enable row level security;
    create policy "Appreciations are publicly readable" on public.appreciations for select using (true);
    create policy "Users can appreciate as their own profile" on public.appreciations for insert with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
    create policy "Users can remove their own appreciation" on public.appreciations for delete using (profile_id in (select id from public.profiles where user_id = auth.uid()));
    insert into public.profiles values ('${P1}', '${U1}'), ('${P2}', '${U2}');
    insert into public.vault_items values ('I1'), ('I2');
    insert into public.referral_codes (user_id, code) values ('${U1}', 'ABCDE1234');
    insert into public.appreciations (item_id, profile_id) values ('I1', '${P1}');
    grant select on public.profiles, public.vault_items to public;
  `);
  const tables = "public.referral_codes, public.appreciations";
  if (scenario === "direct" || scenario === "both") await db.exec(`grant all on ${tables} to anon, authenticated, service_role;`);
  if (scenario === "inherited" || scenario === "both") await db.exec(`grant select, insert, delete on ${tables} to public;`);
  if (scenario === "inherited") await db.exec(`grant all on ${tables} to service_role;`); // the service key keeps working on its own in every real setup
  return db;
}
async function as(db, role, uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false); set role ${role};`);
  try { const r = await db.query(sql, params); await db.exec("reset role"); return { rows: r.rows }; }
  catch (e) { await db.exec("reset role"); return { error: String(e.message || e) }; }
}
const denied = (r) => !!r.error && /permission denied/i.test(r.error);

(async () => {
  for (const scenario of ["direct", "inherited", "both"]) {
    console.log(`\n=== visitors hold access: ${scenario} ===`);
    const db = await build(scenario);
    const rowsOf = async () => (await db.query(CHECKS)).rows;
    const before = await rowsOf();
    const exposed = (n) => before.find((r) => r.n === n);
    t(`[${scenario}] BEFORE: the check query shows the exposure (visitor reads referral_codes; visitor reads profile_id and created_at)`, exposed(1).state_now === true && exposed(3).state_now === true && exposed(4).state_now === true && exposed(1).ok_after_change === false, before.filter((r) => [1, 3, 4].includes(r.n)));
    if (scenario !== "direct") t(`[${scenario}] BEFORE: the check query shows the inherited PUBLIC grant (rows 2 and 5)`, exposed(2).state_now === true && exposed(5).state_now === true, before.filter((r) => [2, 5].includes(r.n)));
    t(`[${scenario}] BEFORE: a visitor can really read the codes and who vibed what`, (await as(db, "anon", null, "select code, user_id from public.referral_codes")).rows?.length === 1 && (await as(db, "anon", null, "select profile_id from public.appreciations")).rows?.length === 1);

    await db.exec(FINAL); await db.exec(FINAL); // twice: repeatable
    const after = await rowsOf();
    t(`[${scenario}] AFTER: every row with an expected value is true`, after.filter((r) => r.expected_after_change !== null).every((r) => r.ok_after_change === true), after.filter((r) => r.ok_after_change === false));
    t(`[${scenario}] AFTER: no PUBLIC SELECT left on either table (rows 2 and 5)`, after.find((r) => r.n === 2).state_now === false && after.find((r) => r.n === 5).state_now === false);

    // visitors
    t(`[${scenario}] visitor cannot read referral_codes (codes or authentication ids): permission denied`, denied(await as(db, "anon", null, "select * from public.referral_codes")) && denied(await as(db, "anon", null, "select code from public.referral_codes")) && denied(await as(db, "anon", null, "select user_id from public.referral_codes where code = 'ABCDE1234'")));
    t(`[${scenario}] visitor cannot read Vibe profile ids, times or select *: permission denied`, denied(await as(db, "anon", null, "select profile_id from public.appreciations")) && denied(await as(db, "anon", null, "select created_at from public.appreciations")) && denied(await as(db, "anon", null, "select * from public.appreciations")) && denied(await as(db, "anon", null, "select item_id from public.appreciations where profile_id = $1", [P1])));
    const cnt = await as(db, "anon", null, "select count(id) as n from public.appreciations where item_id = 'I1'");
    t(`[${scenario}] visitor's public Vibe count still works (count of id for an item)`, !cnt.error && Number(cnt.rows[0].n) === 1, cnt);
    const items = await as(db, "anon", null, "select item_id from public.appreciations where item_id in ('I1', 'I2')");
    t(`[${scenario}] visitor's batch counts still work (item_id for a list of items)`, !items.error && items.rows.length === 1, items);
    // signed-in follow-up actions
    const own = await as(db, "authenticated", U1, "select code from public.referral_codes where user_id = $1", [U1]);
    t(`[${scenario}] signed-in: reads their own referral code`, !own.error && own.rows.length === 1, own);
    const mk = await as(db, "authenticated", U2, "insert into public.referral_codes (user_id, code) values ($1, 'ZZZZZ9999')", [U2]);
    t(`[${scenario}] signed-in: creates their own referral code`, !mk.error, mk);
    const other = await as(db, "authenticated", U2, "insert into public.referral_codes (user_id, code) values ($1, 'HHHHH0000')", [U1]);
    t(`[${scenario}] signed-in: still cannot create a code as somebody else (row-level security unchanged)`, !!other.error && /row-level security/i.test(other.error), other);
    const has = await as(db, "authenticated", U1, "select id from public.appreciations where item_id = 'I1' and profile_id = $1", [P1]);
    t(`[${scenario}] signed-in: 'has this viewer vibed it' works (id where item and own profile)`, !has.error && has.rows.length === 1, has);
    const set = await as(db, "authenticated", U1, "select item_id from public.appreciations where profile_id = $1 and item_id in ('I1', 'I2')", [P1]);
    t(`[${scenario}] signed-in: 'which of these has the viewer vibed' works (item_id where own profile)`, !set.error && set.rows.length === 1, set);
    const vibe = await as(db, "authenticated", U1, "insert into public.appreciations (item_id, profile_id) values ('I2', $1)", [P1]);
    t(`[${scenario}] signed-in: Vibe (insert as own profile) works`, !vibe.error, vibe);
    const bad = await as(db, "authenticated", U1, "insert into public.appreciations (item_id, profile_id) values ('I2', $1)", [P2]);
    t(`[${scenario}] signed-in: cannot Vibe as someone else's profile (row-level security unchanged)`, !!bad.error, bad);
    const unv = await as(db, "authenticated", U1, "delete from public.appreciations where item_id = 'I2' and profile_id = $1", [P1]);
    t(`[${scenario}] signed-in: un-Vibe (delete own) works`, !unv.error, unv);
    const cnt2 = await as(db, "authenticated", U1, "select count(id) as n from public.appreciations where item_id = 'I1'");
    t(`[${scenario}] signed-in: counts work too`, !cnt2.error && Number(cnt2.rows[0].n) === 1, cnt2);
    const svc = await as(db, "service_role", null, "select (select count(*) from public.referral_codes) as c, (select count(*) from public.appreciations) as a");
    t(`[${scenario}] service key still reads both tables`, !svc.error && Number(svc.rows[0].c) >= 1, svc);
    // nothing else changed
    const rls = (await db.query("select relname, relrowsecurity from pg_class where oid in ('public.referral_codes'::regclass, 'public.appreciations'::regclass)")).rows;
    const pol = (await db.query("select count(*)::int as n from pg_policies where schemaname = 'public' and tablename in ('referral_codes', 'appreciations')")).rows[0].n;
    t(`[${scenario}] row-level security still on, all 5 policies still there`, rls.every((r) => r.relrowsecurity) && pol === 5, { rls, pol });
  }
  // negative control: the FIRST draft of the SQL (revoke from visitors only) is NOT enough when the access is inherited from PUBLIC
  {
    console.log("\n=== negative control: first draft (revoke from anon only), access inherited from PUBLIC ===");
    const db = await build("inherited");
    await db.exec("revoke select on public.referral_codes from anon; revoke select on public.appreciations from anon; grant select (id, item_id) on public.appreciations to anon;");
    const leakCodes = await as(db, "anon", null, "select code, user_id from public.referral_codes");
    const leakProfiles = await as(db, "anon", null, "select profile_id from public.appreciations");
    t("[first draft, inherited] it would still leave visitors able to read the codes and the Vibe profile ids (this is why the final SQL also removes the PUBLIC grant)", !leakCodes.error && leakCodes.rows.length === 1 && !leakProfiles.error && leakProfiles.rows.length === 1, { leakCodes, leakProfiles });
    await db.exec(FINAL);
    t("[final SQL, same situation] closes both", denied(await as(db, "anon", null, "select code from public.referral_codes")) && denied(await as(db, "anon", null, "select profile_id from public.appreciations")));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
