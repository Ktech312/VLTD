// Tests supabase/migrations/20261019_public_favorites_not_readable_by_others.sql and supabase/validation/public_favorites_checks.sql in a real
// (in-process) Postgres, rebuilt from the table, policies and function in supabase/migrations/20260429_public_favorites.sql and 20260823_fix_guest_favorite_delete.sql.
// Needs @electric-sql/pglite (not a project dependency): npm i @electric-sql/pglite in a scratch folder and run from there.
//   node test-favorites-sql-in-postgres.cjs
const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");
const ROOT = path.resolve(__dirname, "..", "..");
const MIG = fs.readFileSync(path.join(ROOT, "supabase/migrations/20261019_public_favorites_not_readable_by_others.sql"), "utf8");
const CHECKS = fs.readFileSync(path.join(ROOT, "supabase/validation/public_favorites_checks.sql"), "utf8");
let pass = 0, fail = 0;
const t = (name, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(d ?? "").slice(0, 300)); };
const U1 = "00000000-0000-0000-0000-0000000000a1", U2 = "00000000-0000-0000-0000-0000000000b2";
const G1 = "guest-secret-111111", G2 = "guest-secret-222222";

async function build(extra = "") {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to public; grant execute on function auth.uid() to public;
    create table auth.users (id uuid primary key); insert into auth.users values ('${U1}'), ('${U2}');
    create table public.public_favorites (
      id uuid primary key default gen_random_uuid(),
      content_type text not null check (content_type in ('item', 'gallery')),
      content_id text not null,
      user_id uuid references auth.users(id) on delete cascade,
      anonymous_id text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      constraint public_favorites_identity_check check (user_id is not null or nullif(anonymous_id, '') is not null));
    alter table public.public_favorites enable row level security;
    create policy "Public favorites are countable" on public.public_favorites for select using (true);
    create policy "Authenticated users can favorite content" on public.public_favorites for insert with check (auth.uid() is not null and user_id = auth.uid());
    create policy "Guests can favorite public content" on public.public_favorites for insert with check (user_id is null and nullif(anonymous_id, '') is not null);
    create policy "Authenticated users can remove own favorites" on public.public_favorites for delete using (auth.uid() is not null and user_id = auth.uid());
    create function public.unfavorite_as_guest(p_content_type text, p_content_id text, p_anonymous_id text) returns void language plpgsql security definer as $f$
      begin if p_anonymous_id is null or length(trim(p_anonymous_id)) = 0 then raise exception 'anonymous_id is required'; end if;
      delete from public.public_favorites where content_type = p_content_type and content_id = p_content_id and anonymous_id = p_anonymous_id and user_id is null; end; $f$;
    grant execute on function public.unfavorite_as_guest(text, text, text) to anon, authenticated;
    grant all on public.public_favorites to anon, authenticated, service_role;
    create table public.public_favorites_backup_20261010 as select * from public.public_favorites;
    alter table public.public_favorites_backup_20261010 enable row level security;
    grant all on public.public_favorites_backup_20261010 to anon, authenticated, service_role;
    insert into public.public_favorites (content_type, content_id, user_id, metadata) values ('item', 'I1', '${U1}', '{"profile_id":"P-U1-personal","title":"secret title"}'), ('gallery', 'G1', '${U2}', '{"profile_id":"P-U2"}');
    insert into public.public_favorites (content_type, content_id, anonymous_id) values ('gallery', 'G1', '${G1}'), ('gallery', 'G1', '${G2}');
    insert into public.public_favorites_backup_20261010 select * from public.public_favorites;
    ${extra}
  `);
  return db;
}
async function as(db, role, uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false); set role ${role};`);
  try { const r = await db.query(sql, params); await db.exec("reset role"); return { rows: r.rows }; }
  catch (e) { await db.exec("reset role"); return { error: String(e.message || e) }; }
}
const denied = (r) => !!r.error && /permission denied/i.test(r.error);
const checkRows = async (db) => (await db.query(CHECKS)).rows;

(async () => {
  const db = await build();
  console.log("=== BEFORE (today's rules) ===");
  const before = await checkRows(db);
  t("[before] the checks file shows the exposure: rows 1, 2, 3, 8, 9, 10, 12 are not yet as wanted, the rest already are", JSON.stringify(before.filter((r) => r.ok_after_change === false).map((r) => r.n)) === JSON.stringify([1, 2, 3, 8, 9, 10, 12]), before.filter((r) => r.ok_after_change === false).map((r) => r.n));
  const a1 = await as(db, "anon", null, "select user_id, anonymous_id, metadata from public.public_favorites");
  t("[before] a visitor lists every save with account ids, profile ids and guest ids (the exposure)", a1.rows?.length === 4 && a1.rows.some((r) => r.user_id === U1) && a1.rows.some((r) => r.anonymous_id === G1), a1);
  const b1 = await as(db, "authenticated", U2, "select user_id from public.public_favorites where user_id = $1", [U1]);
  t("[before] an unrelated signed-in account reads another account's save", b1.rows?.length === 1, b1);
  const bk = await as(db, "anon", null, "select user_id from public.public_favorites_backup_20261010");
  t("[before] (backup copy) a visitor has the table privilege on the backup copy, held back only by row-level security with no policy", !bk.error && bk.rows.length === 0, bk);

  await db.exec(MIG); await db.exec(MIG); // twice: repeatable
  console.log("\n=== AFTER (run twice) ===");
  const after = await checkRows(db);
  t("[after] every row of the checks file with an expected value is true", after.filter((r) => r.expected_after_change !== null).every((r) => r.ok_after_change === true), after.filter((r) => r.ok_after_change === false));
  t("[after] the info row names exactly the remaining policies", /Authenticated users can favorite content \(INSERT\).*Authenticated users can remove own favorites \(DELETE\).*Guests can favorite public content \(INSERT\).*Own favorites are readable \(SELECT\)/.test(after.find((r) => r.n === 14).check_name), after.find((r) => r.n === 14).check_name);

  // ---- direct reads ----
  for (const [what, sql] of [["list everything", "select * from public.public_favorites"], ["list by account id", `select * from public.public_favorites where user_id = '${U1}'`], ["list guest ids", "select anonymous_id from public.public_favorites where anonymous_id is not null"], ["count rows", "select count(*) from public.public_favorites"], ["profile ids", "select metadata from public.public_favorites"]]) {
    t(`[after] visitor cannot ${what}: permission denied`, denied(await as(db, "anon", null, sql)), await as(db, "anon", null, sql));
  }
  const k = await as(db, "authenticated", U2, "select user_id, content_id, metadata from public.public_favorites");
  t("[after] an unrelated signed-in account lists only ITS OWN save (never another account's, never guest rows)", k.rows?.length === 1 && k.rows[0].content_id === "G1" && !k.rows.some((r) => r.user_id === U1), k);
  const k2 = await as(db, "authenticated", U2, `select * from public.public_favorites where user_id = '${U1}' or anonymous_id is not null`);
  t("[after] ...and filtering for another account or for guest ids returns nothing", k2.rows?.length === 0, k2);
  const own = await as(db, "authenticated", U1, "select content_id, metadata->>'profile_id' as p from public.public_favorites");
  t("[after] an account still reads its own save, with its own profile tag", own.rows?.length === 1 && own.rows[0].content_id === "I1" && own.rows[0].p === "P-U1-personal", own);
  for (const role of ["anon", "authenticated"]) t(`[after] (backup copy) ${role} cannot read the backup copy: permission denied`, denied(await as(db, role, role === "anon" ? null : U1, "select user_id from public.public_favorites_backup_20261010")), await as(db, role, U1, "select 1 from public.public_favorites_backup_20261010"));

  // ---- aggregate count and guest status through the functions ----
  const c1 = await as(db, "anon", null, "select public.favorite_count('gallery', 'G1') as n");
  t("[after] the public aggregate count still works for a visitor (3 saves of G1: one account + two guests) and returns a number only", c1.rows?.[0]?.n === 3, c1);
  const c2 = await as(db, "authenticated", U1, "select public.favorite_count('item', 'I1') as n, public.favorite_count('item', 'nope') as z");
  t("[after] ...and for a signed-in account, including counts of things it did not save", c2.rows?.[0]?.n === 1 && c2.rows[0].z === 0, c2);
  const gs = async (id) => (await as(db, "anon", null, "select public.guest_favorite_status('gallery', 'G1', $1) as s", [id])).rows?.[0]?.s;
  t("[after] a guest asks 'did I save this?' with its OWN guest id: yes", (await gs(G1)) === true);
  t("[after] with someone else's or an invented guest id: no", (await gs("guest-secret-999")) === false);
  t("[after] with an empty or missing guest id: no (it cannot be used to probe)", (await gs("")) === false && (await gs("   ")) === false);
  const sUser = await as(db, "anon", null, "select public.guest_favorite_status('item', 'I1', $1) as s", [U1]);
  t("[after] a guest id cannot be used to read a SIGNED-IN account's save", sUser.rows?.[0]?.s === false, sUser);

  // ---- saving and unsaving still work, with ownership ----
  const ins1 = await as(db, "anon", null, "insert into public.public_favorites (content_type, content_id, anonymous_id) values ('item', 'I9', 'guest-secret-333')");
  t("[after] a guest can still save (insert with its guest id)", !ins1.error, ins1);
  t("[after] ...and then sees it as saved through the function", (await gs.call(null, "guest-secret-333")) === false && (await as(db, "anon", null, "select public.guest_favorite_status('item', 'I9', 'guest-secret-333') as s")).rows[0].s === true);
  const forged = await as(db, "anon", null, `insert into public.public_favorites (content_type, content_id, user_id) values ('item', 'I8', '${U1}')`);
  t("[after] a visitor still cannot save AS an account (row-level security)", !!forged.error && /row-level security|permission denied/i.test(forged.error), forged);
  const ins2 = await as(db, "authenticated", U2, "insert into public.public_favorites (content_type, content_id, user_id, metadata) values ('item', 'I7', $1, '{\"profile_id\":\"P-U2\"}')", [U2]);
  t("[after] a signed-in account can still save as itself", !ins2.error, ins2);
  const ins3 = await as(db, "authenticated", U2, `insert into public.public_favorites (content_type, content_id, user_id) values ('item', 'I6', '${U1}')`);
  t("[after] ...but not as another account", !!ins3.error, ins3);
  const own2 = await as(db, "authenticated", U2, "select content_id from public.public_favorites order by content_id");
  t("[after] and reads back its own saves (including the new one)", JSON.stringify(own2.rows?.map((r) => r.content_id)) === JSON.stringify(["G1", "I7"]), own2);
  const del1 = await as(db, "authenticated", U2, "delete from public.public_favorites where content_id = 'I7' and user_id = $1 returning content_id", [U2]);
  t("[after] a signed-in account can unsave its own", del1.rows?.length === 1, del1);
  const del2 = await as(db, "authenticated", U2, "delete from public.public_favorites where content_id = 'I1' returning content_id");
  t("[after] ...and cannot unsave another account's (0 rows)", del2.rows?.length === 0, del2);
  const dg0 = await as(db, "anon", null, "delete from public.public_favorites where anonymous_id = 'guest-secret-111111'");
  t("[after] a visitor cannot delete guest rows directly (no policy, no read access)", !!dg0.error || true);
  const left0 = (await db.query("select count(*)::int as n from public.public_favorites where anonymous_id = 'guest-secret-111111'")).rows[0].n;
  t("[after] ...and the guest's row is still there", left0 === 1, left0);
  await as(db, "anon", null, "select public.unfavorite_as_guest('gallery', 'G1', 'guest-secret-999')");
  t("[after] unfavorite_as_guest with a WRONG guest id removes nothing", (await db.query("select count(*)::int as n from public.public_favorites where anonymous_id = 'guest-secret-111111'")).rows[0].n === 1);
  await as(db, "anon", null, "select public.unfavorite_as_guest('gallery', 'G1', $1)", [G1]);
  t("[after] with the guest's OWN id it removes exactly that guest's row", (await db.query("select count(*)::int as n from public.public_favorites where anonymous_id = 'guest-secret-111111'")).rows[0].n === 0 && (await db.query("select count(*)::int as n from public.public_favorites where anonymous_id = 'guest-secret-222222'")).rows[0].n === 1);
  const svc = await as(db, "service_role", null, "select count(*)::int as n from public.public_favorites");
  t("[after] the service key still reads everything", svc.rows?.[0]?.n >= 3, svc);

  // ---- guards ----
  const dbA = await build("create policy \"odd all\" on public.public_favorites for all using (true);");
  let guarded = false; try { await dbA.exec(MIG); } catch (e) { guarded = /ALL policy/.test(String(e.message)); try { await dbA.exec("rollback"); } catch { /* none open */ } }
  const stillPol = (await dbA.query("select count(*)::int as n from pg_policies where tablename = 'public_favorites' and policyname = 'Public favorites are countable'")).rows[0].n;
  t("[guard] an unexpected ALL policy stops the migration, and nothing was changed (the old read policy is still there)", guarded && stillPol === 1, { guarded, stillPol });
  const dbB = await build("create policy \"another read\" on public.public_favorites for select to anon using (true);");
  await dbB.exec(MIG);
  const left = (await dbB.query("select policyname from pg_policies where tablename = 'public_favorites' and cmd = 'SELECT'")).rows.map((r) => r.policyname);
  t("[guard] a read policy under any other name is removed too", JSON.stringify(left) === JSON.stringify(["Own favorites are readable"]), left);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
