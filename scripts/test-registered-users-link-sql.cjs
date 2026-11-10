// Local PostgreSQL (PGlite) check of supabase/migrations/20261110_registered_users_exhibitions_hide_layout_from_signed_out.sql, its validation file and its rollback,
// run as the ORDINARY database roles (anon / authenticated, row-level security on, the repository's own policies and the repository's own 20260823 + 20261018 functions).
// Run twice: variant A = the live functions only; variant B = the held RC-05 stage-2 sanitising SQL installed first (the migration must not undo it, nor the rollback).
//   node scripts/test-registered-users-link-sql.cjs
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const pgDir = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(pgDir, "node_modules/@electric-sql/pglite"));
const root = path.resolve(__dirname, ".."), read = (d, f) => fs.readFileSync(path.join(root, "supabase", d, f), "utf8");
const stage2 = fs.readFileSync(path.join(root, "docs/audit-2026-10-18/repair-batch-5/sql/2-public-galleries-view-and-link-sanitising.sql"), "utf8");
const MIG = "20261110_registered_users_exhibitions_hide_layout_from_signed_out.sql", ROLL = "20261110_registered_users_link_lookup_rollback.sql", VAL = "20261110_registered_users_link_lookup_checks.sql";
const OWNER = "00000000-0000-0000-0000-0000000000a1", VISITOR = "00000000-0000-0000-0000-0000000000b2", PROFILE = "11111111-1111-1111-1111-111111111111", VISITOR_PROFILE = "22222222-2222-2222-2222-222222222222";
let total = 0;
async function run(variant) {
  const withStage2 = variant === "B"; let count = 0; const db = new PGlite();
  const check = async (name, fn) => { await fn(); count++; total++; console.log("PASS [" + variant + "] " + name); };
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table public.profile_members (profile_id uuid, user_id uuid, role text);
      create table public.galleries (id uuid primary key default gen_random_uuid(), profile_id uuid not null, title text, description text, visibility text not null default 'PUBLIC', state text not null default 'ACTIVE', cover_image text, layout jsonb, exhibition_layout jsonb,
        public_token text, analytics_views integer not null default 0, analytics_last_viewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
        alias_enabled boolean not null default false, alias_name text, alias_avatar text, item_notes jsonb, analytics_unique_view_keys jsonb);
      create table public.gallery_items (id uuid primary key default gen_random_uuid(), gallery_id uuid not null, position integer not null default 0, artifact_id text);
      create table public.gallery_invites (token text, gallery_id uuid not null, label text, created_at timestamptz not null default now(), last_used_at timestamptz, expires_at timestamptz, disabled boolean not null default false, permissions jsonb);
      create table public.vault_items (id text primary key, purchase_price numeric, is_public boolean);
      create function public.is_profile_member(p_profile uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.profile_members m where m.profile_id = p_profile and m.user_id = auth.uid()); $$;
      alter table public.galleries enable row level security; alter table public.gallery_items enable row level security; alter table public.gallery_invites enable row level security;
      -- the repository's own table rules: 20260601 (public read), 20260823 (gallery_items public read; invites have no anon policy), 20260927 (member read), 20260707 (member manage)
      create policy "Public galleries are readable" on public.galleries for select using (visibility = 'PUBLIC' AND state = 'ACTIVE');
      create policy galleries_select_member on public.galleries for select to authenticated using (public.is_profile_member(profile_id));
      create policy "gallery_items_read_member" on public.gallery_items for select to authenticated using (exists (select 1 from public.galleries g where g.id = gallery_items.gallery_id and public.is_profile_member(g.profile_id)));
      grant usage on schema public, auth to anon, authenticated; grant all on all tables in schema public to anon, authenticated;`);
    await db.exec(read("migrations", "20260823_fix_gallery_share_and_invite_tokens.sql")); await db.exec(read("migrations", "20261018_gallery_links_respect_private.sql"));
    if (withStage2) await db.exec(stage2);
    await db.query("insert into public.profile_members values ($1,$2,'owner'),($3,$4,'owner')", [PROFILE, OWNER, VISITOR_PROFILE, VISITOR]);
    const snaps = (extra) => `{"itemIds":["i1"],"publicItemSnapshots":[{"id":"i1","title":"SECRET TITLE","imageFrontUrl":"https://img.example/secret.jpg"}]${extra}}`;
    // mk(token, visibility, guestMarker, {state, alias, hostile})
    const mk = async (tok, vis, guest, o = {}) => { const lay = snaps((guest ? ',"guestViewMode":"guest"' : "") + (o.hostile ? ',"ownerSecret":"OWNER ONLY"' : ""));
      const g = await db.query("insert into public.galleries(profile_id,title,visibility,state,public_token,layout,exhibition_layout,item_notes,alias_enabled,alias_name,cover_image) values ($1,$2,$3,$4,$5,$6::jsonb,$6::jsonb,'{\"i1\":\"note\"}',$7,$8,'https://img.example/cover-' || $5 || '.jpg') returning id",
        [PROFILE, "G " + tok, vis, o.state || "ACTIVE", tok, lay, !!o.alias, o.alias ? "Alias" : null]);
      await db.query("insert into public.gallery_items(gallery_id, position, artifact_id) values ($1,1,'i1')", [g.rows[0].id]);
      await db.query("insert into public.gallery_invites(token, gallery_id, permissions) values ($1,$2,'{\"financialHistory\":true}')", ["inv-" + tok, g.rows[0].id]);
      if (o.revoked) await db.query("update public.gallery_invites set disabled = true where token = $1", ["inv-" + tok]);
      if (o.expired) await db.query("update public.gallery_invites set expires_at = now() - interval '1 day' where token = $1", ["inv-" + tok]);
      return g.rows[0].id; };
    await db.query("insert into public.vault_items values ('i1', 123, true)");
    await mk("reg", "INVITE", true, { hostile: true }); await mk("pub", "PUBLIC", false, { hostile: true }); await mk("guestview", "INVITE", false);
    await mk("locked-reg", "LOCKED", true); await mk("draft-reg", "INVITE", true, { state: "STORAGE" }); await mk("reg-revoked", "INVITE", true, { revoked: true }); await mk("reg-expired", "INVITE", true, { expired: true });
    await mk("reg-alias", "INVITE", true, { alias: true }); await mk("leftover", "PUBLIC", true);
    // role = anon (signed out) / authenticated + sub (signed in)
    const as = async (who, sql, params = []) => { const role = who === "anon" ? "anon" : "authenticated"; await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${who === "anon" ? "" : who}', false); set role ${role}`);
      try { return (await db.query(sql, params)).rows; } finally { await db.exec("reset role"); } };
    const share = (w, t) => as(w, "select * from public.get_gallery_by_share_token($1)", [t]), inv = (w, t) => as(w, "select * from public.get_gallery_by_invite_token($1)", ["inv-" + t]);
    const sitems = (w, t) => as(w, "select * from public.get_gallery_items_by_share_token($1)", [t]), iitems = (w, t) => as(w, "select * from public.get_gallery_items_by_invite_token($1)", ["inv-" + t]), fin = (w, t) => as(w, "select * from public.get_invite_item_financials($1)", ["inv-" + t]);
    const secret = (rows) => JSON.stringify(rows).includes("SECRET TITLE") || JSON.stringify(rows).includes("secret.jpg");
    const gated = (r) => { assert.deepEqual(r.layout, { guestViewMode: "guest" }); assert.deepEqual(r.exhibition_layout, { guestViewMode: "guest" }); assert.equal(r.item_notes, null); assert.equal(r.cover_image, null); assert.ok(!secret([r])); assert.ok(r.title); };
    await check("BEFORE (live 20261018 functions, signed-out role): a Registered Users exhibition's titles, photos, notes, cover, items and prices are returned", async () => {
      assert.ok(secret(await share("anon", "reg"))); assert.ok(secret(await inv("anon", "reg"))); assert.equal((await sitems("anon", "reg")).length, 1); assert.equal((await iitems("anon", "reg")).length, 1); assert.equal((await fin("anon", "reg")).length, 1); assert.ok((await share("anon", "reg"))[0].cover_image); });
    await db.exec(read("migrations", MIG)); await db.exec(read("migrations", MIG));
    await check("AFTER (applied twice): signed-out SHARE lookup gets the gate marker only - no titles, photos, notes or cover; title kept for the sign-in screen", async () => gated((await share("anon", "reg"))[0]));
    await check("AFTER: signed-out INVITE lookup: same", async () => gated((await inv("anon", "reg"))[0]));
    await check("AFTER: signed-out item lookups (share and invite) and the invite price lookup return nothing", async () => { assert.equal((await sitems("anon", "reg")).length, 0); assert.equal((await iitems("anon", "reg")).length, 0); assert.equal((await fin("anon", "reg")).length, 0); });
    await check("AFTER: a SIGNED-IN visitor (not a member) still receives everything on every path", async () => { for (const r of [(await share(VISITOR, "reg"))[0], (await inv(VISITOR, "reg"))[0]]) { assert.ok(secret([r])); assert.ok(r.cover_image); assert.ok(r.item_notes); }
      assert.equal((await sitems(VISITOR, "reg")).length, 1); assert.equal((await iitems(VISITOR, "reg")).length, 1); assert.equal((await fin(VISITOR, "reg")).length, 1); });
    await check("AFTER: the owner/member receives everything, including analytics fields", async () => { const r = (await share(OWNER, "reg"))[0]; assert.ok(secret([r])); assert.ok(r.cover_image); assert.equal((await iitems(OWNER, "reg")).length, 1); });
    await check("AFTER: Public and Guest View exhibitions are unchanged for signed-out callers (full on every path)", async () => { for (const t of ["pub", "guestview"]) { const r = (await share("anon", t))[0]; assert.ok(secret([r]), t); assert.ok(r.cover_image); assert.equal((await sitems("anon", t)).length, 1); assert.equal((await iitems("anon", t)).length, 1); assert.equal((await fin("anon", t)).length, 1); assert.ok(secret(await inv("anon", t))); } });
    await check("AFTER: protections that existed stay: Private (LOCKED), draft, revoked and expired links return nothing to signed-out AND signed-in callers (non-members)", async () => {
      for (const who of ["anon", VISITOR]) { for (const t of ["locked-reg", "draft-reg"]) { assert.equal((await share(who, t)).length, 0, who + t); assert.equal((await inv(who, t)).length, 0); assert.equal((await sitems(who, t)).length, 0); assert.equal((await iitems(who, t)).length, 0); assert.equal((await fin(who, t)).length, 0); }
        for (const t of ["reg-revoked", "reg-expired"]) { assert.equal((await inv(who, t)).length, 0, who + t); assert.equal((await iitems(who, t)).length, 0); assert.equal((await fin(who, t)).length, 0); } } });
    await check("AFTER: an alias exhibition keeps hiding the real profile AND is gated for a signed-out caller; a signed-in visitor still sees the alias rules (profile_id empty)", async () => { const a = (await share("anon", "reg-alias"))[0]; gated(a); assert.equal(a.profile_id, null); const s = (await share(VISITOR, "reg-alias"))[0]; assert.equal(s.profile_id, null); assert.ok(secret([s])); assert.equal(s.analytics_unique_view_keys, null); });
    await check("AFTER: the lookups still refuse unknown tokens", async () => { assert.equal((await share("anon", "no-such")).length, 0); assert.equal((await as("anon", "select * from public.get_gallery_by_invite_token('nope')")).length, 0); });
    await check("AFTER: the table itself (row-level security) shows signed-out callers no Registered Users exhibition and no items of one (they are Invite, not Public)", async () => {
      const g = await as("anon", "select public_token from public.galleries order by 1"); assert.ok(!g.some((r) => r.public_token === "reg" || r.public_token === "reg-alias")); assert.ok(g.some((r) => r.public_token === "pub"));
      const it = await as("anon", "select gi.id from public.gallery_items gi join public.galleries g on g.id = gi.gallery_id where g.public_token in ('reg','reg-alias')"); assert.equal(it.length, 0); const inviteRows = await as("anon", "select * from public.gallery_invites"); assert.equal(inviteRows.length, 0); });
    await check("AFTER: ordinary roles cannot call the internal helpers directly", async () => { for (const who of ["anon", VISITOR]) { await assert.rejects(() => as(who, "select * from public.gallery_blocks_signed_out((select g from public.galleries g where public_token='reg' limit 1))")); await assert.rejects(() => as(who, "select * from public.gallery_for_link((select g from public.galleries g limit 1))")); } });
    await check("DOCUMENTED RESIDUAL: an exhibition that is both Public and carries a leftover Registered marker is readable through the ordinary public read rule (the app never produces it; validation counts it)", async () => { const rows = await as("anon", "select layout from public.galleries where public_token = 'leftover'"); assert.equal(rows.length, 1); assert.ok(secret(rows));
      const v = (await db.query(read("validation", VAL).replace(/^--.*$/gm, ""))).rows[0].validation; assert.equal(Number(v.public_exhibitions_with_leftover_registered_marker), 1); });
    if (withStage2) await check("COMPATIBILITY with the held RC-05 SQL: the sanitising it installed still applies on top (an unknown owner key is not returned to a signed-out caller of a Public exhibition) and the gate holds", async () => { const r = (await share("anon", "pub"))[0]; assert.ok(!JSON.stringify(r.layout).includes("OWNER ONLY")); assert.ok(secret([r])); assert.equal((await as("anon", "select layout from public.public_galleries where public_token = 'reg'")).length, 0); gated((await share("anon", "reg"))[0]); });
    await check("validation SQL (read-only) answers as expected", async () => { const v = (await db.query(read("validation", VAL).replace(/^--.*$/gm, ""))).rows[0].validation;
      for (const k of ["rule_helper_installed", "link_row_helper_installed", "share_lookup_uses_gate", "invite_lookup_uses_gate", "share_items_gated", "invite_items_gated", "invite_financials_gated", "helpers_not_callable_by_visitors", "lookups_still_callable_by_visitors"]) assert.equal(v[k], true, k);
      assert.equal(Number(v.registered_users_exhibitions), 7); });
    await db.exec(read("rollback", ROLL)); await db.exec(read("rollback", ROLL));
    await check("ROLLBACK (applied twice): behaviour is the 20261018 behaviour again on every path, and the two helpers are gone", async () => { assert.ok(secret(await share("anon", "reg"))); assert.equal((await sitems("anon", "reg")).length, 1); assert.equal((await iitems("anon", "reg")).length, 1); assert.equal((await fin("anon", "reg")).length, 1);
      assert.equal((await db.query("select to_regprocedure('public.gallery_blocks_signed_out(public.galleries)') as p")).rows[0].p, null); assert.equal((await db.query("select to_regprocedure('public.gallery_for_link(public.galleries)') as p")).rows[0].p, null); });
    if (withStage2) await check("ROLLBACK leaves the RC-05 sanitising in place (gallery_public_row is not touched)", async () => { const r = (await share("anon", "pub"))[0]; assert.ok(!JSON.stringify(r.layout).includes("OWNER ONLY")); });
    await check("REINSTALL after rollback works (idempotent)", async () => { await db.exec(read("migrations", MIG)); gated((await share("anon", "reg"))[0]); });
    console.log("[" + variant + "] " + count + "/" + count + " local PostgreSQL checks passed");
  } finally { await db.close(); }
}
(async () => { await run("A"); await run("B"); console.log(total + " checks passed in total (variant A: live functions only; variant B: with the held RC-05 sanitising SQL installed first)"); })().catch((e) => { console.error(e); process.exitCode = 1; });
