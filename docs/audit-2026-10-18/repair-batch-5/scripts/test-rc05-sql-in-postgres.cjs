// Runs the REVISED held RC-05 SQL (steps 1, 2, 4 and the rollbacks) in a real in-process Postgres with synthetic data and checks every case as
// a visitor (anon), an unrelated signed-in account, a member (owner) and a second profile's member, for public / alias / private / guest-only / draft
// exhibitions and a deliberately hostile row. Nothing here touches the account.
//   node test-rc05-sql-in-postgres.cjs   (PGLITE_DIR = folder holding node_modules/@electric-sql/pglite)
const fs = require("fs");
const path = require("path");
const PG_DIR = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(PG_DIR, "node_modules", "@electric-sql/pglite"));
const SQL = path.join(__dirname, "..", "sql");
const MIG = path.join(__dirname, "..", "..", "..", "..", "supabase", "migrations");
const read = (f) => fs.readFileSync(path.join(SQL, f), "utf8");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };

const ALICE = "00000000-0000-0000-0000-0000000000a1", BOB = "00000000-0000-0000-0000-0000000000b2", CAROL = "00000000-0000-0000-0000-0000000000c3";
const PA = "11111111-1111-1111-1111-111111111111", PB = "22222222-2222-2222-2222-222222222222";

async function freshDb() {
  const db = new PGlite();
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
    create policy "galleries_update_member" on public.galleries for update to authenticated using (public.is_profile_member(profile_id)) with check (public.is_profile_member(profile_id));
    grant update on public.galleries to authenticated;
    create table public.gallery_items (id uuid primary key default gen_random_uuid(), gallery_id uuid not null, position integer not null default 0, artifact_id text);
    alter table public.gallery_items enable row level security;
    create policy "gallery_items_read_public" on public.gallery_items for select to anon, authenticated
      using (exists (select 1 from public.galleries g where g.id = gallery_items.gallery_id and g.visibility = 'PUBLIC' and g.state = 'ACTIVE'));
    create policy "gallery_items_read_member" on public.gallery_items for select to authenticated
      using (exists (select 1 from public.galleries g where g.id = gallery_items.gallery_id and public.is_profile_member(g.profile_id)));
    create table public.exhibition_events (
      id uuid primary key default gen_random_uuid(), gallery_id text not null, profile_id uuid not null references public.profiles(id) on delete cascade,
      type text not null check (type in ('published','announced')), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
    alter table public.exhibition_events enable row level security;
    create policy "Public read exhibition_events" on public.exhibition_events for select using (true);
    create policy "Owner insert exhibition_events" on public.exhibition_events for insert with check (auth.uid() = profile_id);
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on public.galleries, public.gallery_items to anon, authenticated;
    grant select, insert, update, delete on public.exhibition_events to anon, authenticated;
  `);
  // the link functions exactly as 20261018 defines them (sections A and B)
  const m = fs.readFileSync(path.join(MIG, "20261018_gallery_links_respect_private.sql"), "utf8");
  await db.exec(m.slice(m.indexOf("create or replace function public.gallery_public_row"), m.indexOf("-- C. Invitation links")));
  await db.query("insert into public.profiles (id, user_id) values ($1,$2), ($3,$4)", [PA, ALICE, PB, BOB]);
  await db.query("insert into public.profile_members values ($1,$2,'owner'), ($3,$4,'owner')", [PA, ALICE, PB, BOB]);
  return db;
}
const make = (db) => {
  const as = async (role, sub, sql, params = []) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub || ""}', false)`);
    await db.exec(`set role ${role}`);
    try { return { rows: (await db.query(sql, params)).rows }; }
    catch (e) { return { error: String(e.message || e), code: e.code }; }
    finally { await db.exec("reset role"); }
  };
  const asAnon = (sql, p) => as("anon", "", sql, p);
  const asUser = (sub, sql, p) => as("authenticated", sub, sql, p);
  return { as, asAnon, asUser };
};
const titles = (r) => (r.rows || []).map((x) => x.title).sort().join("|");

const HOSTILE_LAYOUT = {
  themePack: "walnut", displayMode: "grid", guestViewMode: "public", shelfBackground: "/bg.png", glassShelfOverlay: true, shelfOverlayStyle: "glass", templateId: "CUSTOM", adultOnly: false,
  itemIds: ["i1", "i2", { evil: "object" }, 7],
  ownerProfileId: PA, ownerEmail: "owner@example.com", privateNote: "SECRET-NOTE", "0": "G", "1": "R",
  publicItemSnapshots: [
    { id: "i1", title: "Public card", subtitle: "sub", number: "1", grade: "9.8", year: "1990", description: "public text", categoryLabel: "Comics", subcategoryLabel: "x", imageFrontUrl: "/a.png", imageBackUrl: "/b.png", imageFrontStoragePath: "items/1_x/a.jpg", primaryImageKey: "k1", createdAt: 5,
      purchasePrice: 99, currentValue: 500, ownerEmail: "owner@example.com", notes: "SECRET-NOTE", profileId: PA, nested: { a: 1 } },
    { id: "i2", hidden: true, title: "REAL HIDDEN TITLE", imageFrontUrl: "/real-hidden.png", imageBackUrl: "/real-hidden-b.png", imageFrontStoragePath: "items/2_y/h.jpg", primaryImageKey: "k2", blurThumb: "data:image/png;base64,AAAA", createdAt: 6, description: "SECRET-NOTE" },
    "not an object", { id: { nested: "object id" }, title: { nested: "SECRET-NOTE" } },
  ],
};
const HOSTILE_EX = { ...HOSTILE_LAYOUT, type: "CURATED", sections: [{ id: "s1", title: "Sec", description: "d", featuredItemId: "i1", itemIds: ["i1", "i2"], slotLayout: ["i1", null, "i2"], secret: "SECRET-NOTE" }, "junk"] };

(async () => {
  const db = await freshDb(); const { as, asAnon, asUser } = make(db);
  const mk = async (title, vis, st, alias, profile, extra = {}) => (await db.query(
    `insert into public.galleries (profile_id,title,visibility,state,alias_enabled,alias_name,alias_avatar,layout,exhibition_layout,public_token,item_notes,analytics_unique_view_keys,analytics_last_viewed_at,analytics_views)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),42) returning id`,
    [profile, title, vis, st, alias, alias ? "The Alias" : "Stale Alias Name", alias ? "🗝️" : "stale-avatar", JSON.stringify(extra.layout || { themePack: "classic", itemIds: ["i1"] }),
      JSON.stringify(extra.ex || { themePack: "classic", itemIds: ["i1"], sections: [{ id: "s", title: "S", itemIds: ["i1"] }] }), "tok-" + title.replace(/\W/g, ""),
      JSON.stringify([{ itemId: "i1", note: "SECRET-NOTE", updatedAt: 1 }]), JSON.stringify(["viewer-key-1", "viewer-key-2"])])).rows[0].id;
  const G = {
    plain: await mk("plain public", "PUBLIC", "ACTIVE", false, PA),
    alias: await mk("alias public", "PUBLIC", "ACTIVE", true, PA),
    aliasLocked: await mk("alias private", "LOCKED", "ACTIVE", true, PA),
    locked: await mk("private", "LOCKED", "ACTIVE", false, PA),
    invite: await mk("guest only", "INVITE", "ACTIVE", false, PA),
    draft: await mk("draft", "PUBLIC", "STORAGE", false, PA),
    hostile: await mk("hostile public", "PUBLIC", "ACTIVE", false, PA, { layout: HOSTILE_LAYOUT, ex: HOSTILE_EX }),
    bobs: await mk("bobs public", "PUBLIC", "ACTIVE", false, PB),
  };
  for (const id of Object.values(G)) await db.query("insert into public.gallery_items (gallery_id, position, artifact_id) values ($1,1,'i1'),($1,2,'i2')", [id]);

  // ===================================================== BEFORE (today's behaviour)
  console.log("--- before any file");
  let r = await asAnon("select profile_id, item_notes, analytics_unique_view_keys from public.galleries where id = $1", [G.alias]);
  check("BEFORE: a visitor reads the real profile_id, curator notes and visitor keys of an alias exhibition from the table", r.rows?.[0]?.profile_id === PA && r.rows[0].item_notes && r.rows[0].analytics_unique_view_keys, r);
  r = await asUser(ALICE, "insert into public.exhibition_events (gallery_id, profile_id, type) values ($1,$2,'announced')", [G.plain, PA]);
  check("BEFORE: the owner's own event insert is refused (42501), as on production", r.code === "42501", r);
  r = await asUser(ALICE, "insert into public.exhibition_events (gallery_id, profile_id, type) values ($1,$2,'announced')", [G.plain, ALICE]);
  check("BEFORE: with the auth id as profile id it fails on the foreign key (23503): the old rule is in force, as on production", r.code === "23503", r);

  // ===================================================== STEP 1 (events), one transaction
  // a second database proves the guard: an unknown policy stops the whole step and changes nothing
  {
    const d2 = await freshDb();
    await d2.exec(`create policy "mystery" on public.exhibition_events for select using (true);`);
    let msg; try { await d2.exec(read("1-events-authorization-and-privacy.sql")); msg = "ran"; } catch (e) { msg = String(e.message); await d2.exec("rollback").catch(() => {}); }
    const pol = (await d2.query("select policyname from pg_policies where tablename='exhibition_events' order by 1")).rows.map((x) => x.policyname).join("|");
    const fnLeft = (await d2.query("select count(*)::int n from pg_proc where proname in ('can_record_exhibition_event','exhibition_events_are_public')")).rows[0].n;
    check("S1 guard: with an unknown policy present it stops with a message and changes NOTHING (policies as before, no helper left behind)", /does not know \(mystery\)/.test(msg) && pol === "Owner insert exhibition_events|Public read exhibition_events|mystery" && fnLeft === 0, { msg, pol, fnLeft });
  }
  await db.exec(read("1-events-authorization-and-privacy.sql"));
  console.log("--- after step 1");
  const ins = (sub, profile, gallery, type = "announced") => asUser(sub, "insert into public.exhibition_events (gallery_id, profile_id, type) values ($1,$2,$3)", [gallery, profile, type]);
  r = await ins(ALICE, PA, G.plain); check("S1 insert: a member records an event for THEIR OWN exhibition", !r.error, r);
  r = await ins(ALICE, PA, G.bobs); check("S1 insert: QA user's profile combined with ANOTHER account's exhibition is refused", r.code === "42501", r);
  r = await ins(ALICE, PB, G.bobs); check("S1 insert: a profile the user is not a member of is refused even with its own exhibition id", r.code === "42501", r);
  r = await ins(ALICE, PA, "00000000-0000-0000-0000-00000000dead"); check("S1 insert: an exhibition that does not exist is refused", r.code === "42501", r);
  r = await ins(ALICE, PA, "not-a-uuid"); check("S1 insert: a malformed exhibition id is refused", r.code === "42501", r);
  r = await ins(CAROL, PA, G.plain); check("S1 insert: an unrelated signed-in account is refused", r.code === "42501", r);
  r = await ins(BOB, PB, G.bobs); check("S1 insert: the other profile's member can record for their own exhibition", !r.error, r);
  r = await asAnon("insert into public.exhibition_events (gallery_id, profile_id, type) values ($1,$2,'announced')", [G.plain, PA]);
  check("S1 insert: a signed-out visitor is refused (no privilege)", !!r.error, r);
  for (const [k, id] of Object.entries({ alias: G.alias, aliasLocked: G.aliasLocked, locked: G.locked, invite: G.invite, draft: G.draft })) {
    const x = await ins(ALICE, PA, id, "published"); if (x.error) check("setup: member records an event for " + k, false, x);
  }
  await ins(ALICE, PA, G.hostile, "published");
  const evTitle = async (role, sub) => {
    const rows = (await as(role, sub, "select e.gallery_id from public.exhibition_events e")).rows || [];
    const byId = Object.fromEntries(Object.entries(G).map(([k, v]) => [v, k]));
    return rows.map((x) => byId[x.gallery_id] || "?").sort().join("|");
  };
  const publicOnly = "bobs|hostile|plain";
  check("S1 read (visitor): only events of exhibitions that are public, active and WITHOUT an alias", (await evTitle("anon", "")) === publicOnly, await evTitle("anon", ""));
  check("S1 read (unrelated account): the same, nothing about alias / private / guest-only / draft", (await evTitle("authenticated", CAROL)) === publicOnly, await evTitle("authenticated", CAROL));
  check("S1 read (other profile's member): public ones only, none of the first profile's private events", (await evTitle("authenticated", BOB)) === publicOnly, await evTitle("authenticated", BOB));
  const aliceSees = (await evTitle("authenticated", ALICE)).split("|");
  check("S1 read (owner): all seven of their exhibitions' events are readable", ["alias", "aliasLocked", "draft", "hostile", "invite", "locked", "plain"].every((k) => aliceSees.includes(k)), aliceSees);
  // changing an exhibition's state changes event visibility immediately
  await db.query("update public.galleries set visibility='LOCKED' where id = $1", [G.plain]);
  check("S1 privacy: switching a public exhibition to PRIVATE hides its earlier events from visitors and other accounts at once", !(await evTitle("anon", "")).includes("plain") && !(await evTitle("authenticated", CAROL)).includes("plain"), await evTitle("anon", ""));
  check("S1 privacy: the owner still sees them", (await evTitle("authenticated", ALICE)).includes("plain"));
  await db.query("update public.galleries set visibility='INVITE' where id = $1", [G.plain]);
  check("S1 privacy: switching to Guest View / Registered also hides them", !(await evTitle("anon", "")).includes("plain"));
  await db.query("update public.galleries set visibility='PUBLIC', state='STORAGE' where id = $1", [G.plain]);
  check("S1 privacy: a draft (state STORAGE) is hidden", !(await evTitle("anon", "")).includes("plain"));
  await db.query("update public.galleries set state='ACTIVE', alias_enabled=true where id = $1", [G.plain]);
  check("S1 privacy: turning an alias ON hides them", !(await evTitle("anon", "")).includes("plain"));
  await db.query("update public.galleries set alias_enabled=false where id = $1", [G.plain]);
  check("S1 privacy: back to public without alias they are visible again", (await evTitle("anon", "")).includes("plain"));
  await db.query("delete from public.galleries where id = $1", [G.draft]);
  check("S1 privacy: an event whose exhibition was deleted is hidden from visitors", !(await evTitle("anon", "")).includes("?"), await evTitle("anon", ""));
  await db.query("insert into public.galleries (id, profile_id, title, visibility, state, layout, exhibition_layout) values ($1,$2,'draft','PUBLIC','STORAGE','{}','{}')", [G.draft, PA]);
  r = await asUser(ALICE, "update public.exhibition_events set type='published'"); check("S1 no update: the owner cannot edit an event (no privilege)", !!r.error, r);
  r = await asUser(ALICE, "delete from public.exhibition_events"); check("S1 no delete: the owner cannot delete an event (no privilege)", !!r.error, r);
  r = await asUser(CAROL, "select public.can_record_exhibition_event($1, $2) as ok", [G.alias, PA]);
  check("S1 probe-safe: an unrelated account asking 'does this alias exhibition belong to this profile?' always gets false", r.rows?.[0]?.ok === false, r);
  r = await asAnon("select public.can_record_exhibition_event($1, $2)", [G.alias, PA]); check("S1 probe-safe: a visitor cannot call the ownership helper at all", !!r.error, r);
  r = await asAnon("select public.exhibition_events_are_public($1) as ok", [G.alias]); check("S1: the public-check helper answers false for an alias exhibition (same as for a missing one)", r.rows?.[0]?.ok === false, r);
  await db.exec(read("1-events-authorization-and-privacy.sql")); check("S1: safe to run again", true);

  // ===================================================== STEP 2 (view + link sanitising)
  {
    const d3 = await freshDb(); let m3; try { await d3.exec(read("4-restrict-galleries-table-read.sql")); m3 = "ran"; } catch (e) { m3 = String(e.message); await d3.exec("rollback").catch(() => {}); }
    check("order guard: step 4 before step 2 stops (no view) and changes nothing", /public_galleries does not exist/.test(m3) && (await d3.query("select count(*)::int n from pg_policies where tablename='galleries'")).rows[0].n === 3, m3);
    const d4 = await freshDb(); await d4.exec("drop function public.get_gallery_by_share_token(text); drop function public.gallery_public_row(public.galleries);");
    let m4; try { await d4.exec(read("2-public-galleries-view-and-link-sanitising.sql")); m4 = "ran"; } catch (e) { m4 = String(e.message); await d4.exec("rollback").catch(() => {}); }
    check("order guard: step 2 without the 20261018 link functions stops and creates nothing", /20261018_gallery_links_respect_private/.test(m4) && (await d4.query("select count(*)::int n from pg_views where viewname='public_galleries'")).rows[0].n === 0, m4);
  }
  await db.exec(read("2-public-galleries-view-and-link-sanitising.sql"));
  console.log("--- after step 2");
  const allow = ["alias_avatar", "alias_enabled", "alias_name", "analytics_views", "cover_image", "created_at", "description", "exhibition_layout", "id", "layout", "profile_id", "public_token", "state", "title", "visibility"];
  r = await asAnon("select * from public.public_galleries limit 1");
  check("S2 view: the columns are EXACTLY the allowlist (no visitor keys, notes, last-viewed time, updated_at, or any future column)", JSON.stringify(Object.keys(r.rows?.[0] || {}).sort()) === JSON.stringify(allow), Object.keys(r.rows?.[0] || {}));
  r = await asAnon("select title from public.public_galleries");
  check("S2 view rows: only public + active (no private, guest-only, draft, alias-private)", titles(r) === "alias public|bobs public|hostile public|plain public", titles(r));
  r = await asUser(CAROL, "select title from public.public_galleries");
  check("S2 view rows: an unrelated signed-in account sees the same", titles(r) === "alias public|bobs public|hostile public|plain public", titles(r));
  r = await asAnon("select profile_id, alias_name, alias_enabled from public.public_galleries where id = $1", [G.alias]);
  check("S2 alias: profile_id is NULL, alias name kept (alias display still works)", r.rows?.[0]?.profile_id === null && r.rows[0].alias_name === "The Alias" && r.rows[0].alias_enabled === true, r);
  r = await asAnon("select profile_id, alias_name, alias_avatar from public.public_galleries where id = $1", [G.plain]);
  check("S2 plain: profile_id kept for Discover / profile lookups; a stale alias name stored while the alias is OFF is not exposed", r.rows?.[0]?.profile_id === PA && r.rows[0].alias_name === null && r.rows[0].alias_avatar === null, r);
  const hv = (await asAnon("select layout, exhibition_layout, title, description, cover_image, public_token from public.public_galleries where id = $1", [G.hostile])).rows[0];
  const keysOf = (o) => Object.keys(o || {}).sort();
  const LAY = ["adultOnly", "displayMode", "glassShelfOverlay", "guestViewMode", "itemIds", "publicItemSnapshots", "shelfBackground", "shelfOverlayStyle", "templateId", "themePack"];
  const SNAP = new Set(["id", "title", "subtitle", "number", "grade", "year", "description", "categoryLabel", "subcategoryLabel", "imageFrontUrl", "imageBackUrl", "imageFrontStoragePath", "primaryImageKey", "createdAt", "hidden", "blurThumb"]);
  check("S2 hostile row: layout keeps ONLY allowlisted keys (owner id / email / private note / stray numeric keys are gone)", JSON.stringify(keysOf(hv.layout)) === JSON.stringify(LAY), keysOf(hv.layout));
  check("S2 hostile row: exhibition_layout keeps only allowlisted keys plus sections and type", JSON.stringify(keysOf(hv.exhibition_layout)) === JSON.stringify([...LAY, "sections", "type"].sort()), keysOf(hv.exhibition_layout));
  check("S2 hostile row: itemIds keep only text ids (object and number entries dropped)", JSON.stringify(hv.layout.itemIds) === JSON.stringify(["i1", "i2"]), hv.layout.itemIds);
  const snaps = hv.layout.publicItemSnapshots;
  check("S2 hostile row: only object snapshots with a plain id survive; every snapshot key is on the allowlist", snaps.length === 3 && snaps.every((s) => Object.keys(s).every((k) => SNAP.has(k))), snaps);
  const open = snaps.find((s) => s.id === "i1");
  check("S2 public card: the visible snapshot keeps everything the public card needs (title, numbers, images, categories) and none of purchase price / value / owner fields", open.title === "Public card" && open.imageFrontUrl === "/a.png" && open.imageFrontStoragePath === "items/1_x/a.jpg" && open.grade === "9.8" && open.year === "1990" && !("purchasePrice" in open) && !("currentValue" in open) && !("ownerEmail" in open) && !("notes" in open) && !("profileId" in open) && !("nested" in open), open);
  const hidden = snaps.find((s) => s.id === "i2");
  check("S2 hidden item: only id, hidden, blur thumbnail and created time remain (real title, images, description removed even from an old row)", JSON.stringify(Object.keys(hidden).sort()) === JSON.stringify(["blurThumb", "createdAt", "hidden", "id"]), hidden);
  const sec = hv.exhibition_layout.sections;
  check("S2 sections: only id, title, description, featuredItemId, itemIds, slotLayout (nulls in slots kept; junk and extra keys dropped)", sec.length === 1 && JSON.stringify(Object.keys(sec[0]).sort()) === JSON.stringify(["description", "featuredItemId", "id", "itemIds", "slotLayout", "title"]) && JSON.stringify(sec[0].slotLayout) === JSON.stringify(["i1", null, "i2"]), sec);
  const whole = JSON.stringify((await asAnon("select v::text as t from public.public_galleries v")).rows.map((x) => x.t));
  check("S2 no leaks anywhere in the view: no curator note, owner email, hidden title, hidden image, visitor key, or any profile id on an alias row", !/SECRET-NOTE|owner@example\.com|REAL HIDDEN TITLE|real-hidden|viewer-key/.test(whole), whole.match(/SECRET-NOTE|owner@example\.com|REAL HIDDEN TITLE|real-hidden|viewer-key/));
  const aliasText = (await asAnon("select v::text as t from public.public_galleries v where alias_enabled")).rows[0].t;
  check("S2 alias row text contains no profile or account id at all", !aliasText.includes(PA) && !aliasText.includes(ALICE), aliasText.slice(0, 200));
  const pv = (await asAnon("select layout from public.public_galleries where id = $1", [G.plain])).rows[0];
  check("S2 ordinary row: the layout a normal exhibition needs is unchanged (themePack, itemIds, sections)", pv.layout.themePack === "classic" && JSON.stringify(pv.layout.itemIds) === JSON.stringify(["i1"]), pv);
  // link functions
  const share = (sub, role, tok) => as(role, sub, "select * from public.get_gallery_by_share_token($1)", [tok]);
  r = await share("", "anon", "tok-aliaspublic");
  check("S2 share link (visitor, alias exhibition): profile_id empty, no curator notes, no visitor keys, no last-viewed time, sanitised layout", r.rows?.length === 1 && r.rows[0].profile_id === null && JSON.stringify(r.rows[0].item_notes) === "[]" && r.rows[0].analytics_unique_view_keys === null && r.rows[0].analytics_last_viewed_at === null, r);
  r = await share("", "anon", "tok-hostilepublic");
  check("S2 share link (visitor, hostile row): the layout is the sanitised one", !JSON.stringify(r.rows?.[0]?.layout).includes("SECRET-NOTE") && !JSON.stringify(r.rows?.[0]?.layout).includes("REAL HIDDEN TITLE"), r.rows?.[0]?.layout);
  r = await share(ALICE, "authenticated", "tok-aliaspublic");
  check("S2 share link (owner): still gets the whole row including profile_id and notes", r.rows?.[0]?.profile_id === PA && r.rows[0].item_notes?.length === 1, r);
  r = await share(CAROL, "authenticated", "tok-private"); check("S2 share link: a private exhibition returns nothing to an unrelated account", (r.rows || []).length === 0, r);
  r = await share(ALICE, "authenticated", "tok-private"); check("S2 share link: ...but the owner still reaches it", (r.rows || []).length === 1, r);
  r = await share("", "anon", "tok-draft"); check("S2 share link: a draft returns nothing to a visitor", (r.rows || []).length === 0, r);
  r = await asAnon("select public.gallery_public_row(g) from public.galleries g limit 1"); check("S2: the row helper is not callable by visitors", !!r.error, r);
  r = await asAnon("select title from public.galleries where id = $1", [G.plain]);
  check("S2: the table itself is unchanged by step 2 (public read still works: this is the old path step 4 will close)", (r.rows || []).length === 1, r);
  await db.exec(read("2-public-galleries-view-and-link-sanitising.sql")); check("S2: safe to run again", true);

  // ===================================================== STEP 4 (restrict the old path)
  {
    const d5 = await freshDb(); await d5.exec(read("2-public-galleries-view-and-link-sanitising.sql"));
    await d5.exec(`create policy "second public rule" on public.galleries for select using (visibility = 'PUBLIC' and state = 'ACTIVE');`);
    let m5; try { await d5.exec(read("4-restrict-galleries-table-read.sql")); m5 = "ran"; } catch (e) { m5 = String(e.message); await d5.exec("rollback").catch(() => {}); }
    const polN = (await d5.query("select count(*)::int n from pg_policies where tablename='galleries'")).rows[0].n;
    const itemsPol = (await d5.query("select qual from pg_policies where tablename='gallery_items' and policyname='gallery_items_read_public'")).rows[0].qual;
    check("S4 guard: with two public rules it stops, restores everything (the gallery_items rule is still the old one) and drops nothing", /expected exactly one public read rule/.test(m5) && polN === 4 && /exists/i.test(itemsPol), { m5, polN, itemsPol });
  }
  await db.exec(read("4-restrict-galleries-table-read.sql"));
  console.log("--- after step 4");
  r = await asAnon("select title from public.galleries"); check("S4 visitor: the table returns NOTHING any more (no profile_id, no layout, nothing)", (r.rows || []).length === 0, titles(r));
  r = await asUser(CAROL, "select title from public.galleries"); check("S4 unrelated account: the table returns nothing", (r.rows || []).length === 0, titles(r));
  r = await asUser(ALICE, "select title from public.galleries"); check("S4 member: still reads ALL of their own exhibitions (public, alias, private, guest-only, draft)", titles(r) === "alias private|alias public|draft|guest only|hostile public|plain public|private", titles(r));
  r = await asUser(BOB, "select title from public.galleries"); check("S4 other profile's member: only their own", titles(r) === "bobs public", titles(r));
  r = await asAnon("select title from public.public_galleries"); check("S4 view: public exhibitions (including the alias one) are still listed for visitors", titles(r) === "alias public|bobs public|hostile public|plain public", titles(r));
  r = await asAnon("select count(*)::int n from public.gallery_items where gallery_id = $1", [G.alias]); check("S4 items: a visitor still reads the items of a public exhibition, alias included", r.rows?.[0]?.n === 2, r);
  r = await asAnon("select count(*)::int n from public.gallery_items where gallery_id = $1", [G.locked]); check("S4 items: a visitor reads none of a private exhibition's items", r.rows?.[0]?.n === 0, r);
  r = await asAnon("select count(*)::int n from public.gallery_items where gallery_id = $1", [G.draft]); check("S4 items: ...nor a draft's", r.rows?.[0]?.n === 0, r);
  r = await asUser(ALICE, "select count(*)::int n from public.gallery_items where gallery_id = $1", [G.locked]); check("S4 items: the owner still reads their private exhibition's items", r.rows?.[0]?.n === 2, r);
  r = await share("", "anon", "tok-aliaspublic"); check("S4 share link: still works for a visitor (definer function)", r.rows?.length === 1 && r.rows[0].profile_id === null, r);
  check("S4 events: public events are still readable by a visitor (helper runs with owner rights)", (await evTitle("anon", "")).split("|").includes("plain"), await evTitle("anon", ""));
  r = await asUser(ALICE, "update public.galleries set title = title where id = $1 returning id", [G.plain]); check("S4: the owner can still update their own exhibition", !r.error && (r.rows || []).length === 1, r);
  await db.exec(read("4-restrict-galleries-table-read.sql").replace(/begin;/, "begin;").replace("if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'galleries' and policyname = 'galleries_select_member')", "if false"))
    .then(() => check("S4: a second run finds no public rule and stops (expected)", false), async (e) => { await db.exec("rollback").catch(() => {}); check("S4: a second run stops with 'found 0' (expected, the rule is already gone)", /found 0/.test(String(e.message)), String(e.message)); });

  // ===================================================== ROLLBACKS (reverse order)
  await db.exec(read("rollback-4.sql"));
  r = await asAnon("select title from public.galleries"); check("ROLLBACK 4: visitors read the public exhibitions from the table again", titles(r) === "alias public|bobs public|hostile public|plain public", titles(r));
  r = await asAnon("select count(*)::int n from public.gallery_items where gallery_id = $1", [G.plain]); check("ROLLBACK 4: public items readable the old way", r.rows?.[0]?.n === 2, r);
  await db.exec(read("rollback-2.sql"));
  r = await asAnon("select count(*)::int n from pg_views where viewname='public_galleries'"); check("ROLLBACK 2: the view is gone", true);
  check("ROLLBACK 2: view and sanitising helpers removed, link function back to the 20261018 behaviour", (await db.query("select count(*)::int n from pg_views where viewname='public_galleries'")).rows[0].n === 0 && (await db.query("select count(*)::int n from pg_proc where proname like 'gallery_public_%' and proname <> 'gallery_public_row'")).rows[0].n === 0);
  r = await share("", "anon", "tok-aliaspublic"); check("ROLLBACK 2: share link still hides profile_id for an alias (20261018 behaviour)", r.rows?.[0]?.profile_id === null && r.rows[0].item_notes?.length === 1, r);
  await db.exec(read("rollback-1.sql"));
  r = await asAnon("select count(*)::int n from public.exhibition_events"); check("ROLLBACK 1: events readable by everyone again (the original rule)", r.rows?.[0]?.n >= 8, r);
  r = await asUser(ALICE, "insert into public.exhibition_events (gallery_id, profile_id, type) values ($1,$2,'announced')", [G.plain, PA]); check("ROLLBACK 1: recording is refused again (the original rule)", r.code === "42501", r);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
