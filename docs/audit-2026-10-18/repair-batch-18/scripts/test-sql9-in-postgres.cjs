// Runs 9-wishlist-pull-list.sql, its validation and rollback in a real in-process Postgres on a copy of the CURRENT wishlist and share tables (with rows that must survive).
const fs = require("fs");
const path = require("path");
const PG_DIR = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(PG_DIR, "node_modules", "@electric-sql/pglite"));
const SQL = path.join(__dirname, "..", "sql");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 400)); };
const ALICE = "00000000-0000-0000-0000-0000000000a1", BOB = "00000000-0000-0000-0000-0000000000b2";
const PA = "11111111-1111-1111-1111-111111111111", PB = "22222222-2222-2222-2222-222222222222";
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles (id uuid primary key, user_id uuid, display_name text);
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    grant select on public.profiles to anon, authenticated;
    insert into public.profiles values ('${PA}', '${ALICE}', 'Alice'), ('${PB}', '${BOB}', 'Bob');
    -- the wishlist as it is in production today (20260716 + 20261011)
    create table public.wishlist (id text primary key, profile_id uuid not null references public.profiles(id) on delete cascade, title text not null, target_price numeric, notes text,
      universe text, category text, subject text, condition text, priority text, created_at timestamptz not null default now());
    alter table public.wishlist enable row level security;
    create policy "own select" on public.wishlist for select using (profile_id in (select id from public.profiles where user_id = auth.uid()));
    create policy "own insert" on public.wishlist for insert with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
    create policy "own update" on public.wishlist for update using (profile_id in (select id from public.profiles where user_id = auth.uid()));
    create policy "own delete" on public.wishlist for delete using (profile_id in (select id from public.profiles where user_id = auth.uid()));
    alter table public.wishlist add column image_url text; alter table public.wishlist add column source text not null default 'manual';
    alter table public.wishlist add column external_id text; alter table public.wishlist add column release_date date; alter table public.wishlist add column status text not null default 'want';
    alter table public.wishlist add constraint wishlist_status_check check (status in ('want', 'preordered'));
    create unique index wishlist_profile_external_uidx on public.wishlist(profile_id, source, external_id) where external_id is not null;
    create table public.wishlist_shares (profile_id uuid primary key references public.profiles(id) on delete cascade, token text not null unique, created_at timestamptz not null default now());
    alter table public.wishlist_shares enable row level security;
    create policy "share select" on public.wishlist_shares for select using (profile_id in (select id from public.profiles where user_id = auth.uid()));
    create policy "share insert" on public.wishlist_shares for insert with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
    create policy "share delete" on public.wishlist_shares for delete using (profile_id in (select id from public.profiles where user_id = auth.uid()));
    create function public.get_shared_wishlist(p_token text) returns table (owner_name text, title text, image_url text, universe text, category text, subject text, release_date date, status text, source text, created_at timestamptz)
      language sql stable security definer set search_path = public as $$ select pr.display_name, w.title, w.image_url, w.universe, w.category, w.subject, w.release_date, w.status, w.source, w.created_at
      from public.wishlist_shares s join public.profiles pr on pr.id = s.profile_id join public.wishlist w on w.profile_id = s.profile_id where s.token = p_token $$;
    grant execute on function public.get_shared_wishlist(text) to anon, authenticated;
    insert into public.wishlist (id, profile_id, title, target_price, notes, category, status, source, external_id, release_date) values
      ('old1', '${PA}', 'Typed-in want', 12.5, 'private note', 'Comics', 'want', 'manual', null, null),
      ('old2', '${PA}', 'Night Courier #4', null, null, 'Comics', 'preordered', 'metron', '181794', '2026-11-12'),
      ('old3', '${PB}', 'Bob want', 5, 'bob note', null, 'want', 'manual', null, null);
    insert into public.wishlist_shares (profile_id, token) values ('${PA}', 'tok-alice');
  `);
  const as = async (sub, sql, params = [], role = "authenticated") => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub || ""}', false)`);
    await db.exec(`set role ${role}`);
    try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: String(e.message || e) }; } finally { await db.exec("reset role"); }
  };
  const before = (await db.query("select id, title, target_price, notes, status, release_date from public.wishlist order by id")).rows;
  const sql = fs.readFileSync(path.join(SQL, "9-wishlist-pull-list.sql"), "utf8");
  await db.exec(sql); await db.exec(sql);
  check("applies and re-runs", true);
  const after = (await db.query("select id, title, target_price, notes, status, release_date from public.wishlist order by id")).rows;
  check("existing rows are unchanged (every old column identical)", JSON.stringify(before) === JSON.stringify(after), { before, after });
  const defaults = (await db.query("select id, quantity, quantity_acquired, edited, acquired_item_ids, source_identity from public.wishlist order by id")).rows;
  check("old rows get quantity 1, none acquired, nothing edited", defaults.every((r) => r.quantity === 1 && r.quantity_acquired === 0 && r.edited.length === 0 && r.acquired_item_ids.length === 0), defaults);
  check("the existing catalog pick got its source identity; typed-in wants have none", defaults.find((r) => r.id === "old2").source_identity === "metron:issue:181794" && defaults.find((r) => r.id === "old1").source_identity === null, defaults);
  let r = await as(ALICE, "update public.wishlist set status = 'acquired', quantity = 2, quantity_acquired = 2 where id = 'old1' returning status");
  check("Acquired is now a valid status", !r.error && r.rows[0].status === "acquired", r);
  r = await as(ALICE, "update public.wishlist set status = 'skipped', skipped_at = now() where id = 'old2' returning status");
  check("Skipped is a valid status and keeps the row", !r.error && r.rows[0].status === "skipped", r);
  r = await as(ALICE, "update public.wishlist set status = 'banana' where id = 'old1'");
  check("an invalid status is still refused", !!r.error, r);
  r = await as(ALICE, "update public.wishlist set quantity_acquired = 5 where id = 'old1'");
  check("more copies received than wanted is refused", !!r.error, r);
  r = await as(ALICE, "update public.wishlist set expected_price = -1 where id = 'old1'");
  check("a negative price is refused", !!r.error, r);
  r = await as(ALICE, "insert into public.wishlist (id, profile_id, title, source, source_identity) values ('new1', $1, 'Dup', 'metron', 'metron:issue:181794')", [PA]);
  check("the same source identity twice in one profile is refused (no copies)", !!r.error, r);
  r = await as(BOB, "insert into public.wishlist (id, profile_id, title, source, source_identity) values ('new2', $1, 'Other profile same release', 'metron', 'metron:issue:181794') returning id", [PB]);
  check("a different profile may follow the same release", !r.error && r.rows.length === 1, r);
  r = await as(ALICE, "insert into public.wishlist (id, profile_id, title, source_identity) values ('new3', $1, 'Blank date and price', null) returning release_date, expected_price, release_window", [PA]);
  check("an unknown date and price stay null (not today, not 0)", !r.error && r.rows[0].release_date === null && r.rows[0].expected_price === null && r.rows[0].release_window === null, r);
  // following rules
  r = await as(ALICE, "insert into public.pull_rules (id, profile_id, kind, name, source, source_key) values ('r1', $1, 'comic_series', 'Night Courier', 'metron', 'metron:series:77') returning state, quantity", [PA]);
  check("the owner creates a Following rule (default: following, 1 copy)", !r.error && r.rows[0].state === "following" && r.rows[0].quantity === 1, r);
  r = await as(ALICE, "insert into public.pull_rules (id, profile_id, kind, name) values ('r2', $1, 'comic_series', 'Not mine')", [PB]);
  check("a rule cannot be created in someone else's profile", !!r.error, r);
  r = await as(BOB, "select * from public.pull_rules");
  check("another account sees no rules", !r.error && r.rows.length === 0, r);
  r = await as(BOB, "update public.pull_rules set state = 'stopped' where id = 'r1' returning id");
  check("another account cannot change a rule", !r.error && r.rows.length === 0, r);
  r = await as("", "select * from public.pull_rules", [], "anon");
  check("a visitor cannot read rules", !!r.error && /permission denied/.test(r.error), r);
  r = await as(ALICE, "update public.pull_rules set state = 'paused' where id = 'r1' returning state");
  check("pause works", !r.error && r.rows[0].state === "paused", r);
  r = await as(ALICE, "update public.pull_rules set state = 'resumed' where id = 'r1'");
  check("an unknown state is refused", !!r.error, r);
  // sharing
  r = await as("", "select * from public.get_shared_wishlist('tok-alice')", [], "anon");
  check("a visitor with the link sees only open wants (the acquired and skipped ones are not returned)", !r.error && r.rows.length === 1 && r.rows[0].title === "Blank date and price", r);
  await as(ALICE, "update public.wishlist set status = 'want', quantity = 3, quantity_acquired = 1, expected_price = 9.99, shop = 'Corner Comics', notes = 'secret', release_date = '2026-12-01', release_window = 'Q1', edition = 'Cover B' where id = 'old1'");
  r = await as("", "select * from public.get_shared_wishlist('tok-alice') where title = 'Typed-in want'", [], "anon");
  const row = r.rows && r.rows[0];
  check("by default a shared want shows title and edition but NO quantity, date, price, shop or note", !r.error && row && row.edition === "Cover B" && row.quantity === null && row.release_date === null && row.release_window === null && row.price === null && row.shop === null && row.notes === null, r);
  r = await as(ALICE, "update public.wishlist_shares set fields = '{\"titles\": true, \"quantities\": true, \"dates\": true}'::jsonb where profile_id = $1 returning fields", [PA]);
  check("the owner switches fields on", !r.error && r.rows.length === 1, r);
  r = await as("", "select * from public.get_shared_wishlist('tok-alice') where title = 'Typed-in want'", [], "anon");
  const row2 = r.rows && r.rows[0];
  check("switched-on fields appear (copies still to get = 2, dates), the rest stay hidden", !r.error && row2 && row2.quantity === 2 && new Date(row2.release_date).toISOString().startsWith("2026-12-01") && row2.price === null && row2.shop === null && row2.notes === null, r);
  r = await as(BOB, "update public.wishlist_shares set fields = '{\"notes\": true}'::jsonb where profile_id = $1 returning profile_id", [PA]);
  check("another account cannot change someone else's share switches", !r.error && r.rows.length === 0, r);
  r = await as("", "select * from public.get_shared_wishlist('no-such-token')", [], "anon");
  check("a wrong or revoked link returns nothing", !r.error && r.rows.length === 0, r);
  const v = (await db.query(fs.readFileSync(path.join(SQL, "validation-9.sql"), "utf8").replace(/^--.*$/gm, ""))).rows[0].result;
  check("validation: every flag true", Object.values(v).every((x) => x === true), v);
  await db.exec(fs.readFileSync(path.join(SQL, "rollback-9.sql"), "utf8"));
  check("ROLLBACK removes the rules table and restores the old status rule", (await db.query("select to_regclass('public.pull_rules') t")).rows[0].t === null && !(await as(ALICE, "update public.wishlist set status = 'acquired' where id = 'old1'")).rows);
  check("ROLLBACK keeps the people's rows", (await db.query("select count(*)::int c from public.wishlist")).rows[0].c >= 3);
  const old = await as("", "select * from public.get_shared_wishlist('tok-alice')", [], "anon");
  check("ROLLBACK restores the old public read", !old.error && old.rows.length >= 1 && !("quantity" in old.rows[0]), old);
  await db.exec(sql);
  check("the package applies again after a rollback", true);
  console.log("\n" + pass + " pass, " + fail + " fail");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
