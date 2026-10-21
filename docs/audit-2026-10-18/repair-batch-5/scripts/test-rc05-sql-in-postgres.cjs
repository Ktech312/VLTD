// Runs the held RC-05 SQL files in a real (in-process) Postgres with synthetic data and checks before/after as anon, a non-member and a member.
//   node test-rc05-sql-in-postgres.cjs   (needs @electric-sql/pglite; set PGLITE_DIR to the folder holding node_modules/@electric-sql)
const fs = require("fs");
const path = require("path");
const PG_DIR = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(PG_DIR, "node_modules", "@electric-sql", "pglite"));
const SQL = path.join(__dirname, "..", "sql");
const read = (f) => fs.readFileSync(path.join(SQL, f), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 400)); };

(async () => {
  const db = new PGlite();
  // ---- the schema as the repo's migrations define it, with the rules as they are today (old events insert rule)
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles (id uuid primary key, user_id uuid, is_public boolean default true, onboarding_completed boolean default true);
    create table public.profile_members (profile_id uuid, user_id uuid, role text);
    create function public.is_profile_member(p_profile uuid) returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from public.profile_members m where m.profile_id = p_profile and m.user_id = auth.uid()); $$;
    create table public.galleries (
      id uuid primary key default gen_random_uuid(), profile_id uuid not null, title text, description text,
      visibility text not null default 'PUBLIC', state text not null default 'ACTIVE', cover_image text, layout jsonb, exhibition_layout jsonb,
      public_token text, analytics_views integer not null default 0, analytics_last_viewed_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      alias_enabled boolean not null default false, alias_name text, alias_avatar text, item_notes jsonb, analytics_unique_view_keys jsonb);
    alter table public.galleries enable row level security;
    create policy "Public galleries are readable" on public.galleries for select using (visibility = 'PUBLIC' AND state = 'ACTIVE');
    create policy "galleries_select_member" on public.galleries for select to authenticated using (public.is_profile_member(profile_id));
    create table public.exhibition_events (
      id uuid primary key default gen_random_uuid(), gallery_id text not null, profile_id uuid not null references public.profiles(id) on delete cascade,
      type text not null check (type in ('published','announced')), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
    alter table public.exhibition_events enable row level security;
    create policy "Public read exhibition_events" on public.exhibition_events for select using (true);
    create policy "Owner insert exhibition_events" on public.exhibition_events for insert with check (auth.uid() = profile_id);
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on public.galleries, public.exhibition_events to anon, authenticated;
    grant insert on public.exhibition_events to authenticated;
  `);
  const OWNER = "00000000-0000-0000-0000-0000000000a1", OTHER = "00000000-0000-0000-0000-0000000000b2";
  const PROFILE = "11111111-1111-1111-1111-111111111111", PROFILE2 = "22222222-2222-2222-2222-222222222222";
  await db.query("insert into public.profiles (id, user_id) values ($1,$2), ($3,$4)", [PROFILE, OWNER, PROFILE2, OTHER]);
  await db.query("insert into public.profile_members values ($1,$2,'owner'), ($3,$4,'owner')", [PROFILE, OWNER, PROFILE2, OTHER]);
  const g = async (title, vis, st, alias, profile = PROFILE) => (await db.query(`insert into public.galleries (profile_id,title,visibility,state,alias_enabled,alias_name,layout) values ($1,$2,$3,$4,$5,$6,'{"x":1}') returning id`, [profile, title, vis, st, alias, alias ? "The Alias" : null])).rows[0].id;
  const ids = {
    plain: await g("plain public", "PUBLIC", "ACTIVE", false),
    alias: await g("alias public", "PUBLIC", "ACTIVE", true),
    aliasPrivate: await g("alias locked", "LOCKED", "ACTIVE", true),
    invite: await g("invite", "INVITE", "ACTIVE", false),
    storage: await g("stored", "PUBLIC", "STORAGE", false),
    other: await g("other profile public", "PUBLIC", "ACTIVE", false, PROFILE2),
  };
  // run as a role + user (what the API does)
  const as = async (role, sub, sql, params = []) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub || ""}', false)`);
    await db.exec(`set role ${role}`);
    try { return { rows: (await db.query(sql, params)).rows }; }
    catch (e) { return { error: String(e.message || e), code: e.code }; }
    finally { await db.exec("reset role"); }
  };
  const insEvent = (role, sub, profile, gallery, type = "published") => as(role, sub, "insert into public.exhibition_events (gallery_id, profile_id, type) values ($1,$2,$3)", [gallery, profile, type]);
  const baseRows = (role, sub, where = "") => as(role, sub, `select id, profile_id, alias_enabled, title from public.galleries ${where} order by title`);
  const viewRows = (role, sub) => as(role, sub, "select id, profile_id, alias_enabled, title from public.public_galleries order by title");
  const titles = (r) => (r.rows || []).map((x) => x.title).join("|");

  // ================= BEFORE
  console.log("--- before any file");
  let r = await baseRows("anon", "", "where alias_enabled");
  check("BEFORE: anon reads the alias exhibition and gets the real profile_id (the defect)", r.rows?.length === 1 && r.rows[0].profile_id === PROFILE, r);
  r = await insEvent("authenticated", OWNER, PROFILE, ids.plain);
  check("BEFORE: a member's insert of a follower notice is refused by row-level security (42501), as on production", r.code === "42501", r);
  r = await insEvent("authenticated", OWNER, OWNER, ids.plain);
  check("BEFORE: using the auth uid as profile id fails on the foreign key (23503): the old rule is the one in force, as on production", r.code === "23503", r);

  // ================= FILE 1
  await db.exec(read("1-exhibition-events-members-insert.sql"));
  console.log("--- after file 1");
  r = await insEvent("authenticated", OWNER, PROFILE, ids.plain, "announced");
  check("F1: the profile's member can record an announcement", !r.error, r);
  r = await insEvent("authenticated", OWNER, PROFILE, ids.plain, "published");
  check("F1: the profile's member can record a published notice", !r.error, r);
  r = await insEvent("authenticated", OTHER, PROFILE, ids.plain);
  check("F1: someone who is not a member of that profile is refused", r.code === "42501", r);
  r = await insEvent("anon", "", PROFILE, ids.plain);
  check("F1: a signed-out visitor is refused", !!r.error, r);
  r = await as("anon", "", "select count(*)::int as n from public.exhibition_events");
  check("F1: events are still publicly readable (nothing else changed)", r.rows?.[0]?.n === 2, r);
  await db.exec(read("1-exhibition-events-members-insert.sql"));
  check("F1: safe to run twice", true);

  // ================= FILE 2 (view), before step 2
  await db.exec(read("2-public-galleries-view-step1.sql"));
  console.log("--- after file 2 (view), before file 3");
  r = await viewRows("anon", "");
  check("F2: the view lists exactly the public + active exhibitions (no locked / invite / stored)", titles(r) === "alias public|other profile public|plain public", titles(r));
  check("F2: in the view the alias exhibition's profile_id is NULL", r.rows?.find((x) => x.title === "alias public")?.profile_id === null, r);
  check("F2: in the view a non-alias exhibition keeps its profile_id (discovery and profile pages keep working)", r.rows?.find((x) => x.title === "plain public")?.profile_id === PROFILE, r);
  r = await as("anon", "", "select id, profile_id from public.public_galleries where profile_id = $1", [PROFILE]);
  check("F2: a profile page query (by profile_id) on the view returns only that profile's non-alias public exhibitions", (r.rows || []).length === 1 && r.rows[0].id === ids.plain, r);
  r = await as("authenticated", OTHER, "select profile_id from public.public_galleries where id = $1", [ids.alias]);
  check("F2: a signed-in non-member also gets NULL for the alias exhibition", r.rows?.[0]?.profile_id === null, r);
  r = await baseRows("anon", "", "where alias_enabled");
  check("F2: the table itself is unchanged until file 3 (the leak remains open: expected)", r.rows?.length === 1 && r.rows[0].profile_id === PROFILE, r);
  r = await as("anon", "", "select * from public.public_galleries limit 1");
  const viewCols = Object.keys(r.rows?.[0] || {}).sort();
  const baseCols = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='galleries' order by column_name")).rows.map((x) => x.column_name).sort();
  check("F2: the view has every column of the table (no consumer loses a field)", JSON.stringify(viewCols) === JSON.stringify(baseCols), { viewCols, baseCols });

  // ================= FILE 3 (step 2)
  await db.exec(read("3-galleries-public-read-non-alias-step2.sql"));
  console.log("--- after file 3");
  r = await baseRows("anon", "");
  check("F3: anon reading the table no longer gets alias exhibitions at all", titles(r) === "other profile public|plain public", titles(r));
  r = await baseRows("authenticated", OTHER, "where alias_enabled");
  check("F3: a signed-in non-member gets no alias row from the table either", (r.rows || []).length === 0, r);
  r = await viewRows("anon", "");
  check("F3: the alias exhibition is still publicly reachable through the view, profile_id hidden", titles(r) === "alias public|other profile public|plain public" && r.rows.find((x) => x.title === "alias public").profile_id === null, r);
  r = await baseRows("authenticated", OWNER, "");
  check("F3: the profile's own member still sees all of their exhibitions (including the locked alias one) with profile_id", (r.rows || []).filter((x) => x.profile_id === PROFILE).length === 5 && titles(r).includes("alias locked") && titles(r).includes("alias public"), titles(r));
  r = await as("anon", "", "select id from public.galleries where id = $1", [ids.plain]);
  check("F3: a public exhibition without an alias is still readable from the table (existing consumers unchanged)", (r.rows || []).length === 1, r);
  let again;
  try { await db.exec(read("3-galleries-public-read-non-alias-step2.sql")); again = "ok"; } catch (e) { again = String(e.message); }
  check("F3: running it a second time still finds exactly one public rule and succeeds", again === "ok", again);

  // ================= FILE 3 guard: refuses when it cannot identify exactly one public rule
  const db2 = new PGlite();
  await db2.exec(`create role anon nologin; create role authenticated nologin;
    create table public.galleries (id uuid primary key, profile_id uuid, visibility text, state text, alias_enabled boolean default false);
    alter table public.galleries enable row level security;
    create policy a on public.galleries for select using (visibility = 'PUBLIC' AND state = 'ACTIVE');
    create policy b on public.galleries for select using (visibility = 'PUBLIC' AND state = 'ACTIVE');`);
  let guard;
  try { await db2.exec(read("3-galleries-public-read-non-alias-step2.sql")); guard = "ran"; } catch (e) { guard = String(e.message); }
  const left = (await db2.query("select count(*)::int as n from pg_policies where tablename='galleries'")).rows[0].n;
  check("F3 guard: with two public rules it stops with a message and changes nothing", /expected exactly one public read rule/.test(guard) && left === 2, { guard, left });

  // ================= FILE 1b (optional)
  await db.exec(read("1b-exhibition-events-hide-alias-optional.sql"));
  console.log("--- after optional file 1b");
  await insEvent("authenticated", OWNER, PROFILE, ids.alias, "announced");
  r = await as("anon", "", "select gallery_id from public.exhibition_events");
  check("F1b: anon no longer sees events of the alias exhibition, still sees the others", (r.rows || []).every((x) => x.gallery_id !== ids.alias) && (r.rows || []).length === 2, r);
  r = await as("authenticated", OWNER, "select gallery_id from public.exhibition_events where gallery_id = $1", [ids.alias]);
  check("F1b: the profile's own member can still read the alias exhibition's events", (r.rows || []).length === 1, r);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
