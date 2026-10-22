// Runs file 7 (events stay readable until over in every time zone), its validation and its rollback in a real in-process Postgres.
//   PGLITE_DIR=<folder holding node_modules/@electric-sql/pglite> node test-sql7-in-postgres.cjs
const fs = require("fs"); const path = require("path");
const { PGlite } = require(require("path").join(process.env.PGLITE_DIR, "node_modules", "@electric-sql/pglite"));
const D = path.join(__dirname, "..", "sql") + "/";
let pass = 0, fail = 0; const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d)); };
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema if not exists public;
    create table public.collector_events (slug text primary key, enabled boolean not null default true, starts_at timestamptz not null, ends_at timestamptz not null);
    alter table public.collector_events enable row level security; grant select on public.collector_events to anon;`);
  // the migration 20260823 as it stands in production: drop the old rule, create the 'upcoming' rule
  await db.exec(`create policy "Anyone can read enabled upcoming events" on public.collector_events for select using (enabled = true and ends_at >= now());`);
  const now = Date.now(); const iso = (h) => new Date(now + h * 3600000).toISOString();
  await db.query(`insert into public.collector_events values ('ended-1h-ago', true, $1, $2), ('ended-9h-ago', true, $1, $3), ('ended-11h-ago', true, $1, $4), ('ended-13h-ago', true, $1, $5), ('future', true, $1, $6), ('disabled-ended-1h', false, $1, $2)`, [iso(-100), iso(-1), iso(-9), iso(-11), iso(-13), iso(30)]);
  const seen = async () => (await db.query(`set role anon; select slug from public.collector_events order by slug`)).rows.map((r) => r.slug);
  const before = await db.query("set role anon"); void before;
  const asAnon = async () => { await db.exec("set role anon"); const r = (await db.query("select slug from public.collector_events order by slug")).rows.map((x) => x.slug); await db.exec("reset role"); return r; };
  check("before: an event over by 1 hour is already hidden", JSON.stringify(await asAnon()) === JSON.stringify(["future"]), await asAnon());
  await db.exec(fs.readFileSync(D + "7-events-visible-through-local-last-evening.sql", "utf8"));
  check("after: events over by 1, 9 and 11 hours are still readable (their last evening in the Americas), 13 hours is hidden, disabled stays hidden", JSON.stringify(await asAnon()) === JSON.stringify(["ended-11h-ago", "ended-1h-ago", "ended-9h-ago", "future"].sort()), await asAnon());
  await db.exec(fs.readFileSync(D + "7-events-visible-through-local-last-evening.sql", "utf8"));
  check("running it again changes nothing", (await asAnon()).length === 4);
  const v = (await db.query(fs.readFileSync(D + "validation-7.sql", "utf8"))).rows[0].result;
  check("validation reads true", v.read_rule_has_12_hour_margin === true && v.only_one_read_rule === true, v);
  await db.exec(fs.readFileSync(D + "rollback-7.sql", "utf8"));
  check("rollback restores the old rule", JSON.stringify(await asAnon()) === JSON.stringify(["future"]), await asAnon());
  console.log(`${pass} of ${pass + fail} passed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
