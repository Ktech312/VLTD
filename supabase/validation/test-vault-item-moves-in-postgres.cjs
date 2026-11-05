// Runs supabase/migrations/20261105_vault_item_moves_owner_only.sql in a real in-process Postgres (PGlite, nothing remote) with the member/owner row-level rules
// copied from 20260707_team_management.sql, and checks every kind of caller.
//   PGLITE_DIR=<folder with @electric-sql/pglite> node supabase/validation/test-vault-item-moves-in-postgres.cjs
const fs = require("fs");
const path = require("path");
const { PGlite } = require(require.resolve("@electric-sql/pglite", { paths: [process.env.PGLITE_DIR || process.cwd()] }));
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 300)); };
const U = { owner: "00000000-0000-0000-0000-0000000000a1", admin: "00000000-0000-0000-0000-0000000000a2", member: "00000000-0000-0000-0000-0000000000a3", stranger: "00000000-0000-0000-0000-0000000000a4" };
const BIZ = "00000000-0000-0000-0000-00000000b001", OWN_P = "00000000-0000-0000-0000-00000000b002", MEM_P = "00000000-0000-0000-0000-00000000b003", STR_P = "00000000-0000-0000-0000-00000000b004";
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; grant usage on schema auth to authenticated, anon; grant usage on schema public to authenticated, anon;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant execute on function auth.uid() to authenticated, anon;
    create table public.profile_members (profile_id uuid, user_id uuid, role text, primary key (profile_id, user_id));
    create table public.vault_items (id text primary key, profile_id text, title text, is_public boolean default false);
    create function public.is_profile_member_text(p_profile text) returns boolean language sql stable security definer set search_path = public as $$
      select p_profile is not null and p_profile ~ '^[0-9a-fA-F-]{36}$' and exists (select 1 from public.profile_members m where m.profile_id = p_profile::uuid and m.user_id = auth.uid()); $$;
    create function public.is_profile_manager_text(p_profile text) returns boolean language sql stable security definer set search_path = public as $$
      select p_profile ~ '^[0-9a-fA-F-]{36}$' and exists (select 1 from public.profile_members m where m.profile_id = p_profile::uuid and m.user_id = auth.uid() and m.role in ('owner','admin')); $$;
    alter table public.vault_items enable row level security;
    create policy vault_items_read_member on public.vault_items for select to authenticated using (public.is_profile_member_text(profile_id));
    create policy vault_items_insert_member on public.vault_items for insert to authenticated with check (public.is_profile_member_text(profile_id));
    create policy vault_items_update_member on public.vault_items for update to authenticated using (public.is_profile_member_text(profile_id)) with check (public.is_profile_member_text(profile_id));
    create policy vault_items_delete_manager on public.vault_items for delete to authenticated using (public.is_profile_manager_text(profile_id));
    grant select, insert, update, delete on public.vault_items to authenticated;
    grant select on public.profile_members to authenticated;
  `);
  const migration = fs.readFileSync(path.join(__dirname, "../migrations/20261105_vault_item_moves_owner_only.sql"), "utf8");
  const setup = `
    insert into public.profile_members values ('${BIZ}','${U.owner}','owner'), ('${OWN_P}','${U.owner}','owner'), ('${BIZ}','${U.admin}','admin'), ('${BIZ}','${U.member}','member'),
      ('${MEM_P}','${U.member}','owner'), ('${STR_P}','${U.stranger}','owner');
    insert into public.vault_items values ('biz1','${BIZ}','Biz item 1'), ('biz2','${BIZ}','Biz item 2'), ('own1','${OWN_P}','Owner personal'), ('mem1','${MEM_P}','Member personal'), ('str1','${STR_P}','Stranger personal');`;
  const as = async (uid, role = "authenticated") => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`); };
  const move = async (uid, id, to) => { await as(uid); try { const r = await db.query("update public.vault_items set profile_id = $1 where id = $2 returning id", [to, id]); return { moved: r.rows.length > 0, err: null }; } catch (e) { return { moved: false, err: e.code || e.message }; } };
  const where = async (id) => { await db.exec("reset role;"); return (await db.query("select profile_id from public.vault_items where id = $1", [id])).rows[0].profile_id; };
  const reset = async () => { await db.exec("reset role; update public.vault_items set profile_id = '" + BIZ + "' where id in ('biz1','biz2'); update public.vault_items set profile_id = '" + OWN_P + "' where id = 'own1'; update public.vault_items set profile_id = '" + MEM_P + "' where id = 'mem1'; update public.vault_items set profile_id = '" + STR_P + "' where id = 'str1';"); };

  // ---- BEFORE the migration: the gap exists (this is what was found on the live database)
  await db.exec(setup);
  let r = await move(U.member, "biz1", MEM_P);
  check("BEFORE: a member can take a business item into their own personal profile (the gap)", r.moved === true, r); await reset();
  r = await move(U.member, "mem1", BIZ);
  check("BEFORE: a member can push their personal item into the business (the gap)", r.moved === true, r); await reset();

  // ---- apply the migration (twice: safe to re-run)
  await db.exec("reset role;"); await db.exec(migration); await db.exec(migration);
  check("the migration runs twice without error", true);

  r = await move(U.member, "biz1", MEM_P);
  check("AFTER: a member cannot take a business item out into their personal profile", !r.moved && r.err === "42501" && (await where("biz1")) === BIZ, r); await reset();
  r = await move(U.member, "mem1", BIZ);
  check("AFTER: a member cannot push a personal item into the business", !r.moved && r.err === "42501" && (await where("mem1")) === MEM_P, r); await reset();
  r = await move(U.admin, "biz1", OWN_P);
  check("AFTER: an admin cannot move a business item either (owner only)", !r.moved && (await where("biz1")) === BIZ, r); await reset();
  r = await move(U.owner, "own1", BIZ);
  check("AFTER: the owner can move their personal item into their business", r.moved && (await where("own1")) === BIZ, r); await reset();
  r = await move(U.owner, "biz1", OWN_P);
  check("AFTER: the owner can move a business item into their own personal profile", r.moved && (await where("biz1")) === OWN_P, r); await reset();
  r = await move(U.owner, "own1", STR_P);
  check("AFTER: the owner still cannot move an item into someone else's profile", !r.moved && (await where("own1")) === OWN_P, r); await reset();
  r = await move(U.owner, "mem1", BIZ);
  check("AFTER: the owner cannot move another person's item into the business", !r.moved && (await where("mem1")) === MEM_P, r); await reset();
  r = await move(U.stranger, "biz1", STR_P);
  check("AFTER: an unrelated person cannot touch a business item", !r.moved && (await where("biz1")) === BIZ, r); await reset();
  r = await move(U.stranger, "str1", BIZ);
  check("AFTER: an unrelated person cannot push their item into the business", !r.moved && (await where("str1")) === STR_P, r); await reset();
  // editing without changing the profile is untouched
  await as(U.member);
  let e = await db.query("update public.vault_items set title = 'edited by member' where id = 'biz2' returning id");
  check("AFTER: a member can still edit a business item (the trigger fires only when the profile changes)", e.rows.length === 1);
  await as(U.stranger);
  e = await db.query("update public.vault_items set title = 'hacked' where id = 'biz2' returning id");
  check("AFTER: an unrelated person still cannot edit it", e.rows.length === 0);
  // service role / maintenance (no signed-in person) is not blocked
  await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  const sv = await db.query("update public.vault_items set profile_id = $1 where id = 'str1' returning id", [OWN_P]);
  check("AFTER: a maintenance update with no signed-in person is not blocked", sv.rows.length === 1); await reset();
  // privileges
  await db.exec("reset role; set role anon;");
  let anonBlocked = false; try { await db.query("select public.is_profile_owner_text('x')"); } catch { anonBlocked = true; }
  check("anon cannot execute the owner helper", anonBlocked);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
