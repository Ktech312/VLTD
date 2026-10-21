// Runs 3-exhibition-view-counter.sql in a real in-process Postgres with synthetic exhibitions.
//   node test-views-sql-in-postgres.cjs
const fs = require("fs");
const path = require("path");
const PG_DIR = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(PG_DIR, "node_modules", "@electric-sql/pglite"));
const SQL = path.join(__dirname, "..", "sql");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 300)); };
(async () => {
  const db = new PGlite();
  const OWN = "00000000-0000-0000-0000-0000000000a1";
  const PA = "11111111-1111-1111-1111-111111111111";
  const G1 = "aaaaaaaa-0000-0000-0000-000000000001", G2 = "aaaaaaaa-0000-0000-0000-000000000002", G3 = "aaaaaaaa-0000-0000-0000-000000000003";
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profile_members (profile_id uuid, user_id uuid);
    create function public.is_profile_member(p uuid) returns boolean language sql stable security definer as $$ select exists (select 1 from public.profile_members m where m.profile_id = p and m.user_id = auth.uid()); $$;
    create table public.galleries (id uuid primary key, profile_id uuid, visibility text, state text, analytics_views integer not null default 0, analytics_unique_view_keys jsonb, analytics_last_viewed_at timestamptz);
    insert into public.galleries values ('${G1}', '${PA}', 'PUBLIC', 'ACTIVE', 0, null, null), ('${G2}', '${PA}', 'LOCKED', 'ACTIVE', 0, null, null), ('${G3}', '${PA}', 'PUBLIC', 'STORAGE', 0, null, null);
    insert into public.profile_members values ('${PA}', '${OWN}');
    grant usage on schema public, auth to anon, authenticated;
    alter table public.galleries enable row level security;
  `);
  const sqlText = fs.readFileSync(path.join(SQL, "3-exhibition-view-counter.sql"), "utf8");
  await db.exec(sqlText);
  await db.exec(sqlText);
  check("re-run is harmless", true);
  const call = async (role, sub, g, key) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub}', false)`);
    await db.exec(`set role ${role}`);
    try { await db.query("select public.record_exhibition_view($1,$2)", [g, key]); return { ok: true }; }
    catch (e) { return { error: String(e.message) }; }
    finally { await db.exec("reset role"); }
  };
  const views = async (g) => Number((await db.query("select analytics_views v from public.galleries where id = $1", [g])).rows[0].v);
  const keys = async (g) => (await db.query("select analytics_unique_view_keys k from public.galleries where id = $1", [g])).rows[0].k;
  let r = await call("anon", "", G1, "visitor-key-0001");
  check("a visitor's first visit counts", !r.error && (await views(G1)) === 1, r);
  await call("anon", "", G1, "visitor-key-0001");
  check("the same viewer again does not count twice", (await views(G1)) === 1);
  await call("anon", "", G1, "visitor-key-0002");
  check("a second viewer counts", (await views(G1)) === 2);
  await call("authenticated", "00000000-0000-0000-0000-0000000000b2", G1, "visitor-key-0003");
  check("a signed-in non-member counts", (await views(G1)) === 3);
  await call("authenticated", OWN, G1, "owner-key-000001");
  check("the exhibition's own team is not counted", (await views(G1)) === 3);
  await call("anon", "", G2, "visitor-key-0004");
  check("a private exhibition is not counted", (await views(G2)) === 0);
  await call("anon", "", G3, "visitor-key-0005");
  check("a draft exhibition is not counted", (await views(G3)) === 0);
  await call("anon", "", G1, "x");
  await call("anon", "", G1, "k".repeat(200));
  check("too-short or too-long keys are ignored", (await views(G1)) === 3);
  await db.exec("set role anon");
  let direct;
  try { direct = await db.query("update public.galleries set analytics_views = 999 where id = $1 returning id", [G1]); } catch (e) { direct = { error: String(e.message) }; }
  await db.exec("reset role");
  check("a visitor still cannot write the table directly", !!direct.error || direct.rows.length === 0, direct);
  for (let i = 0; i < 520; i++) await db.query("select public.record_exhibition_view($1,$2)", [G1, `bulk-key-${String(i).padStart(5, "0")}`]);
  const k = await keys(G1);
  check("the key list is trimmed to the latest 500 and views keep counting", k.length === 500 && k[k.length - 1] === "bulk-key-00519" && (await views(G1)) === 3 + 520, { len: k.length, last: k[k.length - 1], v: await views(G1) });
  const v = (await db.query(fs.readFileSync(path.join(SQL, "validation-3.sql"), "utf8").replace(/^--.*$/gm, ""))).rows[0].result;
  check("validation query: all true", Object.values(v).every((x) => x === true), v);
  await db.exec(fs.readFileSync(path.join(SQL, "rollback-3.sql"), "utf8"));
  check("ROLLBACK: function gone", (await db.query("select to_regprocedure('public.record_exhibition_view(text, text)') is null as gone")).rows[0].gone === true);
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
