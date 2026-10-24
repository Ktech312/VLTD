// Runs file 8 (the event refresh memory), its validation and its rollback in a real in-process Postgres, emulating Supabase's default table grants.
//   PGLITE_DIR=<folder holding node_modules/@electric-sql/pglite> node test-sql8-in-postgres.cjs
const fs = require("fs"); const path = require("path");
const { PGlite } = require(path.join(process.env.PGLITE_DIR, "node_modules", "@electric-sql/pglite"));
const D = path.join(__dirname, "..", "sql") + path.sep;
let pass = 0, fail = 0; const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d)); };
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;`);
  const sql = fs.readFileSync(D + "8-event-refresh-store.sql", "utf8");
  await db.exec(sql);
  let v = (await db.query(fs.readFileSync(D + "validation-8.sql", "utf8"))).rows[0].result;
  check("validation reads true after the file", Object.values(v).every((x) => x === true), v);
  await db.exec(sql);
  v = (await db.query(fs.readFileSync(D + "validation-8.sql", "utf8"))).rows[0].result;
  check("running it again changes nothing", Object.values(v).every((x) => x === true), v);
  // the server's role can use them; the public roles cannot
  await db.exec("set role service_role");
  await db.query(`insert into public.event_refresh_candidates (slug, category, source, row_data, first_seen_day) values ('a-2026-11-14', 'convention', 'serp', '{"name":"A"}', '2026-10-24')`);
  await db.query(`insert into public.event_refresh_steps (step_key, payload) values ('search|2026-10-24|serp|convention', '{"found":10}')`);
  const rows = (await db.query("select verdict, saved_at from public.event_refresh_candidates")).rows;
  check("the server can write and read; a new event starts as pending and unsaved", rows.length === 1 && rows[0].verdict === "pending" && rows[0].saved_at === null, rows);
  let bad = null; try { await db.query(`insert into public.event_refresh_candidates (slug, category, source, row_data, first_seen_day, verdict) values ('b', 'x', 'serp', '{}', '2026-10-24', 'maybe')`); } catch (e) { bad = e.message; }
  check("a verdict other than pending / approved / rejected is refused", !!bad, bad);
  await db.exec("reset role"); await db.exec("set role anon");
  let anonErr = null; try { await db.query("select * from public.event_refresh_candidates"); } catch (e) { anonErr = e.message; }
  check("the public role cannot read the candidates", /permission denied/.test(anonErr || ""), anonErr);
  await db.exec("reset role"); await db.exec("set role authenticated");
  let authErr = null; try { await db.query("select * from public.event_refresh_steps"); } catch (e) { authErr = e.message; }
  check("a signed-in role cannot read the steps either", /permission denied/.test(authErr || ""), authErr);
  await db.exec("reset role");
  await db.exec(fs.readFileSync(D + "rollback-8.sql", "utf8"));
  const left = (await db.query("select to_regclass('public.event_refresh_candidates') as a, to_regclass('public.event_refresh_steps') as b")).rows[0];
  check("the rollback removes both tables", left.a === null && left.b === null, left);
  await db.exec(fs.readFileSync(D + "rollback-8.sql", "utf8"));
  check("the rollback can be run again", true);
  console.log(`${pass} of ${pass + fail} passed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
