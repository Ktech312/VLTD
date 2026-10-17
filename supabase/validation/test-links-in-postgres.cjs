// Runs the OLD link functions and the NEW migration in a real (in-process) Postgres and checks every visibility/state x caller.
const fs = require("fs");
const { PGlite } = require("@electric-sql/pglite");
const REPO = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/supabase/migrations/";
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 400)); };

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profile_members (profile_id uuid, user_id uuid, role text);
    create table public.galleries (
      id uuid primary key default gen_random_uuid(), profile_id uuid not null, title text, description text,
      visibility text not null default 'PUBLIC', state text not null default 'ACTIVE', cover_image text, layout jsonb, exhibition_layout jsonb,
      public_token text, analytics_views integer not null default 0, analytics_last_viewed_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      alias_enabled boolean not null default false, alias_name text, alias_avatar text, item_notes jsonb, analytics_unique_view_keys jsonb);
    create table public.gallery_items (id uuid primary key default gen_random_uuid(), gallery_id uuid not null, position integer not null default 0, artifact_id text);
    create table public.gallery_invites (token text, gallery_id uuid not null, label text, created_at timestamptz not null default now(), last_used_at timestamptz, expires_at timestamptz, disabled boolean not null default false, permissions jsonb);
    create table public.vault_items (id text primary key, purchase_price numeric, is_public boolean);
    alter table public.galleries enable row level security; alter table public.gallery_items enable row level security; alter table public.gallery_invites enable row level security;
    create function public.is_profile_member(p_profile uuid) returns boolean language sql stable security definer set search_path = public as $$
      select exists (select 1 from public.profile_members m where m.profile_id = p_profile and m.user_id = auth.uid()); $$;
  `);
  // OLD behaviour: the shipped migrations
  await db.exec(fs.readFileSync(REPO + "20260823_fix_gallery_share_and_invite_tokens.sql", "utf8"));
  const fin = fs.readFileSync(REPO + "20261007_public_item_columns.sql", "utf8");
  await db.exec(fin.slice(fin.indexOf("create or replace function public.get_invite_item_financials"), fin.indexOf("-- 2) Signed-out visitors")));

  const OWNER_USER = "00000000-0000-0000-0000-0000000000a1", OTHER_USER = "00000000-0000-0000-0000-0000000000b2";
  const PROFILE = "11111111-1111-1111-1111-111111111111";
  await db.query("insert into public.profile_members values ($1,$2,'owner')", [PROFILE, OWNER_USER]);
  const combos = [];
  for (const vis of ["PUBLIC", "INVITE", "LOCKED", "WEIRD"]) for (const st of ["ACTIVE", "STORAGE"]) combos.push([vis, st]);
  const ids = {};
  for (const [vis, st] of combos) {
    const tok = `tok-${vis}-${st}`;
    const g = await db.query(`insert into public.galleries (profile_id,title,visibility,state,public_token,item_notes,analytics_unique_view_keys,alias_enabled,alias_name)
      values ($1,$2,$3,$4,$5,'{"i1":"note"}','["visitor-1","visitor-2"]',$6,$7) returning id`, [PROFILE, `G ${vis}/${st}`, vis, st, tok, vis === "PUBLIC" && st === "ACTIVE", "The Alias"]);
    ids[`${vis}/${st}`] = g.rows[0].id;
    await db.query("insert into public.gallery_items (gallery_id, position, artifact_id) values ($1,1,'i1'),($1,2,'i2')", [g.rows[0].id]);
    await db.query("insert into public.gallery_invites (token, gallery_id, permissions) values ($1,$2,'{\"financialHistory\": true}')", [`inv-${vis}-${st}`, g.rows[0].id]);
  }
  await db.query("insert into public.vault_items values ('i1', 123.45, true), ('i2', 50, false)");
  // extra invites on the shareable gallery: disabled, expired
  const pubId = ids["PUBLIC/ACTIVE"];
  await db.query("insert into public.gallery_invites (token, gallery_id, disabled) values ('inv-disabled', $1, true)", [pubId]);
  await db.query("insert into public.gallery_invites (token, gallery_id, expires_at) values ('inv-expired', $1, now() - interval '1 day')", [pubId]);

  const as = async (sub, sql, params = []) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub || ""}', false)`);
    return (await db.query(sql, params)).rows;
  };
  const share = (sub, t) => as(sub, "select * from public.get_gallery_by_share_token($1)", [t]);
  const shareItems = (sub, t) => as(sub, "select * from public.get_gallery_items_by_share_token($1)", [t]);
  const inv = (sub, t) => as(sub, "select * from public.get_gallery_by_invite_token($1)", [t]);
  const invItems = (sub, t) => as(sub, "select * from public.get_gallery_items_by_invite_token($1)", [t]);
  const money = (sub, t) => as(sub, "select * from public.get_invite_item_financials($1)", [t]);

  // ---- BEFORE (old functions): prove the defect in the engine ----
  const oldLocked = await share(null, "tok-LOCKED-ACTIVE");
  check("[before] OLD share function returns a LOCKED exhibition to a signed-out caller (the defect)", oldLocked.length === 1, oldLocked.length);
  check("[before] OLD invite financials return prices for a LOCKED exhibition", (await money(null, "inv-LOCKED-ACTIVE")).length === 1);

  const valSql = fs.readFileSync(REPO.replace("migrations/", "validation/") + "20261018_gallery_links_respect_private_checks.sql", "utf8");
  let beforeFails;
  try { beforeFails = (await db.query(valSql)).rows.some((r) => r.ok !== true); } catch (e) { beforeFails = true; }
  check("[validation sql] negative control: before the migration it fails or reports failures (it cannot pass by accident)", beforeFails === true);
  // ---- apply the new migration, twice (must be repeatable) ----
  const mig = fs.readFileSync(REPO + "20261018_gallery_links_respect_private.sql", "utf8");
  await db.exec(mig); await db.exec(mig);
  console.log("migration applied twice without error");

  // ---- AFTER: visibility x state x caller ----
  const SHAREABLE = new Set(["PUBLIC/ACTIVE", "INVITE/ACTIVE"]);
  for (const [vis, st] of combos) {
    const key = `${vis}/${st}`, tok = `tok-${vis}-${st}`, it = `inv-${vis}-${st}`, want = SHAREABLE.has(key);
    for (const [who, sub] of [["signed-out", null], ["unrelated account", OTHER_USER]]) {
      check(`[${key}] share link, ${who}: ${want ? "returned" : "nothing"}`, (await share(sub, tok)).length === (want ? 1 : 0));
      check(`[${key}] share items, ${who}: ${want ? "2 rows" : "nothing"}`, (await shareItems(sub, tok)).length === (want ? 2 : 0));
      check(`[${key}] invite link, ${who}: ${want ? "returned" : "nothing"}`, (await inv(sub, it)).length === (want ? 1 : 0));
      check(`[${key}] invite items, ${who}: ${want ? "2 rows" : "nothing"}`, (await invItems(sub, it)).length === (want ? 2 : 0));
      const m = await money(sub, it);
      check(`[${key}] invite financials, ${who}: ${want ? "only the public item's price" : "nothing"}`, want ? (m.length === 1 && m[0].id === "i1" && Number(m[0].purchase_price) === 123.45) : m.length === 0, m);
    }
    check(`[${key}] owner keeps the link working in every state (share, items, invite)`, (await share(OWNER_USER, tok)).length === 1 && (await shareItems(OWNER_USER, tok)).length === 2 && (await inv(OWNER_USER, it)).length === 1);
  }
  // ---- invitation restrictions preserved ----
  check("[invite] unknown token returns nothing", (await inv(null, "nope")).length === 0 && (await invItems(null, "nope")).length === 0);
  check("[invite] disabled invite returns nothing (even for the owner)", (await inv(OWNER_USER, "inv-disabled")).length === 0 && (await invItems(null, "inv-disabled")).length === 0);
  check("[invite] expired invite returns nothing", (await inv(null, "inv-expired")).length === 0 && (await money(null, "inv-expired")).length === 0);
  await db.query("update public.gallery_invites set permissions = '{\"financialHistory\": false}' where token = 'inv-PUBLIC-ACTIVE'");
  check("[invite] financials still need the invite's own permission", (await money(null, "inv-PUBLIC-ACTIVE")).length === 0);
  await db.query("update public.gallery_invites set permissions = '{\"financialHistory\": true}' where token = 'inv-PUBLIC-ACTIVE'");
  // ---- what the row carries ----
  const anonRow = (await share(null, "tok-PUBLIC-ACTIVE"))[0];
  check("[row] visitors do not receive analytics_unique_view_keys", anonRow.analytics_unique_view_keys === null, anonRow.analytics_unique_view_keys);
  check("[row] an aliased exhibition returns no profile_id to visitors, and still returns the alias", anonRow.profile_id === null && anonRow.alias_enabled === true && anonRow.alias_name === "The Alias", anonRow);
  const otherRow = (await share(OTHER_USER, "tok-PUBLIC-ACTIVE"))[0];
  check("[row] an unrelated signed-in account gets the same restricted row", otherRow.profile_id === null && otherRow.analytics_unique_view_keys === null);
  const invRow = (await inv(null, "inv-PUBLIC-ACTIVE"))[0];
  check("[row] invite link rows are restricted the same way", invRow.profile_id === null && invRow.analytics_unique_view_keys === null);
  const ownRow = (await share(OWNER_USER, "tok-PUBLIC-ACTIVE"))[0];
  check("[row] the owner gets the full row (profile_id and analytics keys)", ownRow.profile_id === PROFILE && Array.isArray(ownRow.analytics_unique_view_keys) && ownRow.analytics_unique_view_keys.length === 2, ownRow);
  const plain = (await share(null, "tok-INVITE-ACTIVE"))[0];
  check("[row] a non-aliased exhibition keeps its profile_id (the page needs it) and public content", plain.profile_id === PROFILE && plain.title === "G INVITE/ACTIVE" && plain.item_notes && plain.analytics_unique_view_keys === null, plain);
  check("[row] same columns as the table (no column dropped or renamed)", Object.keys(plain).sort().join() === Object.keys(ownRow).sort().join());
  check("[helper] the internal helper is not executable by visitors", (await db.query("select has_function_privilege('anon','public.gallery_public_row(public.galleries)','execute') a, has_function_privilege('authenticated','public.gallery_public_row(public.galleries)','execute') b")).rows[0].a === false);
  check("[grants] the five link functions are executable by anon and authenticated", (await db.query(`select bool_and(has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('authenticated', p.oid, 'execute')) ok from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('get_gallery_by_share_token','get_gallery_items_by_share_token','get_gallery_by_invite_token','get_gallery_items_by_invite_token','get_invite_item_financials')`)).rows[0].ok === true);
  const val = fs.readFileSync(REPO.replace("migrations/", "validation/") + "20261018_gallery_links_respect_private_checks.sql", "utf8");
  const vr = (await db.query(val)).rows;
  console.log(vr.map((r) => r.check_name + " => " + r.ok).join("\n"));
  check("[validation sql] all 8 rows ok on the test data (which includes LOCKED, STORAGE and odd values)", vr.length === 8 && vr.every((r) => r.ok === true), vr);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
