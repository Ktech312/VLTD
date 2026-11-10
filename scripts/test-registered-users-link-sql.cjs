// Local PostgreSQL (PGlite) check of supabase/migrations/20261110_registered_users_exhibitions_hide_layout_from_signed_out.sql, its validation file and its rollback.
// What a signed-out / signed-in / member caller of the share-link and invite-link lookups RECEIVES for a Registered Users exhibition, before and after.
//   node scripts/test-registered-users-link-sql.cjs
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const pgDir = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(pgDir, "node_modules/@electric-sql/pglite"));
const root = path.resolve(__dirname, ".."), read = (d, f) => fs.readFileSync(path.join(root, "supabase", d, f), "utf8");
const OWNER_USER = "00000000-0000-0000-0000-0000000000a1", VISITOR = "00000000-0000-0000-0000-0000000000b2", PROFILE = "11111111-1111-1111-1111-111111111111";
let count = 0; const check = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };
async function main() { const db = new PGlite(); try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profile_members (profile_id uuid, user_id uuid, role text);
    create table public.galleries (id uuid primary key default gen_random_uuid(), profile_id uuid not null, title text, description text, visibility text not null default 'PUBLIC', state text not null default 'ACTIVE', cover_image text, layout jsonb, exhibition_layout jsonb,
      public_token text, analytics_views integer not null default 0, analytics_last_viewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      alias_enabled boolean not null default false, alias_name text, alias_avatar text, item_notes jsonb, analytics_unique_view_keys jsonb);
    create table public.gallery_items (id uuid primary key default gen_random_uuid(), gallery_id uuid not null, position integer not null default 0, artifact_id text);
    create table public.gallery_invites (token text, gallery_id uuid not null, label text, created_at timestamptz not null default now(), last_used_at timestamptz, expires_at timestamptz, disabled boolean not null default false, permissions jsonb);
    create table public.vault_items (id text primary key, purchase_price numeric, is_public boolean);
    alter table public.galleries enable row level security; alter table public.gallery_items enable row level security; alter table public.gallery_invites enable row level security;
    create function public.is_profile_member(p_profile uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.profile_members m where m.profile_id = p_profile and m.user_id = auth.uid()); $$;`);
  await db.exec(read("migrations", "20260823_fix_gallery_share_and_invite_tokens.sql")); await db.exec(read("migrations", "20261018_gallery_links_respect_private.sql"));
  await db.query("insert into public.profile_members values ($1,$2,'owner')", [PROFILE, OWNER_USER]);
  const snaps = '{"itemIds":["i1"],"publicItemSnapshots":[{"id":"i1","title":"SECRET TITLE"}]%EXTRA%}';
  const mk = async (tok, vis, guest) => { const lay = snaps.replace("%EXTRA%", guest ? ',"guestViewMode":"guest"' : ""); const g = await db.query("insert into public.galleries(profile_id,title,visibility,state,public_token,layout,exhibition_layout,item_notes,alias_enabled,alias_name) values ($1,$2,$3,'ACTIVE',$4,$5::jsonb,$5::jsonb,'{\"i1\":\"note\"}',false,null) returning id", [PROFILE, "G " + tok, vis, tok, lay]); await db.query("insert into public.gallery_items(gallery_id, position, artifact_id) values ($1,1,'i1')", [g.rows[0].id]); await db.query("insert into public.gallery_invites(token, gallery_id) values ($1,$2)", ["inv-" + tok, g.rows[0].id]); return g.rows[0].id; };
  await mk("tok-reg", "PUBLIC", true); await mk("tok-public", "PUBLIC", false); await mk("tok-guestview", "INVITE", false); await mk("tok-reg-invite", "INVITE", true);
  const as = async (sub, sql, params = []) => { await db.exec(`select set_config('request.jwt.claim.sub', '${sub || ""}', false)`); return (await db.query(sql, params)).rows; };
  const share = (sub, t) => as(sub, "select * from public.get_gallery_by_share_token($1)", [t]), inv = (sub, t) => as(sub, "select * from public.get_gallery_by_invite_token($1)", [t]), items = (sub, t) => as(sub, "select * from public.get_gallery_items_by_share_token($1)", [t]);
  await check("BEFORE: a signed-out caller receives the item titles of a Registered Users exhibition (the finding)", async () => { const r = await share(null, "tok-reg"); assert.equal(r.length, 1); assert.ok(JSON.stringify(r[0].layout).includes("SECRET TITLE")); });
  await db.exec(read("migrations", "20261110_registered_users_exhibitions_hide_layout_from_signed_out.sql")); await db.exec(read("migrations", "20261110_registered_users_exhibitions_hide_layout_from_signed_out.sql"));
  await check("AFTER (applied twice): signed-out share lookup of a Registered Users exhibition gets the gate marker only - no titles, no item notes", async () => { const r = (await share(null, "tok-reg"))[0]; assert.deepEqual(r.layout, { guestViewMode: "guest" }); assert.deepEqual(r.exhibition_layout, { guestViewMode: "guest" }); assert.equal(r.item_notes, null); assert.ok(!JSON.stringify(r).includes("SECRET TITLE")); assert.equal(r.title, "G tok-reg"); });
  await check("AFTER: the same holds for a Registered Users exhibition reached by invite link", async () => { const r = (await inv(null, "inv-tok-reg-invite"))[0]; assert.ok(r && !JSON.stringify(r).includes("SECRET TITLE") && r.layout.guestViewMode === "guest"); });
  await check("AFTER: a signed-out caller gets no gallery_items for it either", async () => { assert.equal((await items(null, "tok-reg")).length, 0); });
  await check("AFTER: a SIGNED-IN visitor still receives the full exhibition (layout, snapshots, items)", async () => { const r = (await share(VISITOR, "tok-reg"))[0]; assert.ok(JSON.stringify(r.layout).includes("SECRET TITLE")); assert.equal((await items(VISITOR, "tok-reg")).length, 1); });
  await check("AFTER: the owner/member still receives everything", async () => { const r = (await share(OWNER_USER, "tok-reg"))[0]; assert.ok(JSON.stringify(r.layout).includes("SECRET TITLE")); });
  await check("AFTER: Public and Guest View exhibitions are unchanged for signed-out callers", async () => { for (const t of ["tok-public", "tok-guestview"]) { const r = (await share(null, t))[0]; assert.ok(JSON.stringify(r.layout).includes("SECRET TITLE"), t); assert.equal((await items(null, t)).length, 1); } });
  await check("validation SQL (read-only) answers as expected", async () => { const v = (await db.query(read("validation", "20261110_registered_users_link_lookup_checks.sql").replace(/^--.*$/gm, ""))).rows[0].validation; assert.equal(v.helper_hides_layout_for_signed_out_registered_users, true); assert.equal(v.items_lookup_gated, true); assert.equal(v.helper_not_callable_by_visitors, true); assert.equal(Number(v.registered_users_exhibitions), 2); });
  await db.exec(read("rollback", "20261110_registered_users_link_lookup_rollback.sql")); await db.exec(read("rollback", "20261110_registered_users_link_lookup_rollback.sql"));
  await check("ROLLBACK (applied twice): behaviour is the 20261018 behaviour again", async () => { assert.ok(JSON.stringify((await share(null, "tok-reg"))[0].layout).includes("SECRET TITLE")); assert.equal((await items(null, "tok-reg")).length, 1); });
  console.log(count + "/" + count + " local PostgreSQL checks passed");
} finally { await db.close(); } }
main().catch((e) => { console.error(e); process.exitCode = 1; });
