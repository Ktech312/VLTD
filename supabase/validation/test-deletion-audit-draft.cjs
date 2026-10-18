// Tests docs/proposals/vault-items-deletion-audit-2026-10-18.sql (a DRAFT, not applied anywhere) in a real in-process Postgres.
// Needs @electric-sql/pglite (scratch folder).   node test-deletion-audit-draft.cjs
const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");
const ROOT = path.resolve(__dirname, "..", "..");
const SQL = fs.readFileSync(path.join(ROOT, "docs/proposals/vault-items-deletion-audit-2026-10-18.sql"), "utf8");
let pass = 0, fail = 0;
const t = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 300)); };
const OWNER = "00000000-0000-0000-0000-0000000000a1", P = "10000000-0000-0000-0000-0000000000a1";
async function as(db, role, uid, sql, cfg = {}) {
  cfg = { "request.method": "", "request.path": "", "request.headers": "", ...cfg }; // a gateway call sets these; a direct call has none
  const sets = Object.entries(cfg).map(([k, v]) => `select set_config('${k}', '${String(v).replace(/'/g, "''")}', false);`).join(" ");
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false), set_config('request.jwt.claim.role', '${role === "postgres" ? "" : role}', false); ${sets} ${role === "postgres" ? "" : "set role " + role};`);
  try { const r = await db.query(sql); await db.exec("reset role"); return { rows: r.rows }; } catch (e) { await db.exec("reset role"); return { error: String(e.message || e) }; }
}
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    grant usage on schema public, auth to public; grant execute on function auth.uid(), auth.role() to public;
    create table public.vault_items (id text primary key, item_code text, profile_id text, created_at bigint, status text, title text);
    alter table public.vault_items enable row level security;
    create policy "read own" on public.vault_items for select to authenticated using (profile_id = '${P}');
    create policy "delete own" on public.vault_items for delete to authenticated using (profile_id = '${P}' and auth.uid() = '${OWNER}');
    grant select, insert, update, delete on public.vault_items to authenticated, anon; grant all on public.vault_items to service_role;
    insert into public.vault_items select 'i' || g, '260312-0001-' || lpad(g::text, 6, '0'), '${P}', 1790000000000 + g, 'COLLECTION', 'Title number ' || g || ' ' || repeat('x', 80) from generate_series(1, 6) g;
  `);
  await db.exec(SQL); await db.exec(SQL); // twice: repeatable
  await db.exec("grant all on public.vault_item_deletions to service_role; grant execute on function public.vault_deletion_chain_first_break() to service_role;"); // what Supabase's default privileges give the service key on a new table
  const rows = async () => (await db.query("select * from public.vault_item_deletions order by id")).rows;

  const d1 = await as(db, "authenticated", OWNER, "delete from public.vault_items where id = 'i1' returning id", { "request.method": "DELETE", "request.path": "/vault_items", "request.headers": '{"user-agent":"Mozilla/5.0 QA"}' });
  let r = await rows();
  t("an owner's delete through the API is recorded with actor account, role, time, item id, item code, collection, context", d1.rows?.length === 1 && r.length === 1 && r[0].item_id === "i1" && r[0].item_code === "260312-0001-000001" && r[0].profile_id === P && r[0].actor_user_id === OWNER && r[0].actor_role === "authenticated" && r[0].via === "api" && r[0].request_method === "DELETE" && r[0].user_agent === "Mozilla/5.0 QA" && r[0].db_user, r);
  t("only the first 60 characters of the title are kept", r[0].title_start.length === 60, r[0].title_start.length);
  const d2 = await as(db, "service_role", null, "delete from public.vault_items where id = 'i2' returning id");
  r = await rows();
  t("a delete with the service key is recorded with no account and the role 'service_role'", r.length === 2 && r[1].item_id === "i2" && r[1].actor_user_id === null && r[1].actor_role === "service_role" && r[1].via === "direct", r[1]);
  await as(db, "postgres", null, "delete from public.vault_items where id = 'i3'");
  r = await rows();
  t("a delete made directly in the SQL editor (database owner) is recorded with the database user and no account", r.length === 3 && r[2].item_id === "i3" && r[2].actor_user_id === null && r[2].actor_role === null && /postgres/.test(r[2].db_user), r[2]);
  await as(db, "service_role", null, "delete from public.vault_items where id in ('i4', 'i5')");
  r = await rows();
  t("a bulk delete writes one note per item", r.length === 5 && r[3].item_id === "i4" && r[4].item_id === "i5", r.map((x) => x.item_id));
  const forbidden = await as(db, "authenticated", "00000000-0000-0000-0000-0000000000b2", "delete from public.vault_items where id = 'i6' returning id");
  t("a delete that row-level security refuses (0 rows) writes no note", (await rows()).length === 5 && (forbidden.rows?.length ?? 0) === 0);
  await as(db, "postgres", null, "truncate public.vault_items");
  r = await rows();
  t("a TRUNCATE of the whole table is recorded", r.length === 6 && r[5].item_id === "*TRUNCATE*", r[5]);

  // restricted access
  for (const role of ["anon", "authenticated"]) {
    t(`${role} cannot read the notes`, /permission denied/i.test((await as(db, role, OWNER, "select * from public.vault_item_deletions")).error || ""));
    t(`${role} cannot write or edit the notes`, /permission denied/i.test((await as(db, role, OWNER, "insert into public.vault_item_deletions (item_id) values ('x')")).error || "") && /permission denied/i.test((await as(db, role, OWNER, "update public.vault_item_deletions set item_id = 'x'")).error || "") && /permission denied/i.test((await as(db, role, OWNER, "delete from public.vault_item_deletions")).error || ""));
  }
  t("the service key can read the notes", (await as(db, "service_role", null, "select count(*)::int as n from public.vault_item_deletions")).rows?.[0]?.n === 6);
  const e1 = await as(db, "service_role", null, "update public.vault_item_deletions set item_id = 'tampered' where id = 1");
  const e2 = await as(db, "service_role", null, "delete from public.vault_item_deletions where id = 1");
  const e3 = await as(db, "service_role", null, "truncate public.vault_item_deletions");
  t("even the service key cannot edit, delete or truncate a note (append-only)", /append-only/.test(e1.error || "") && /append-only/.test(e2.error || "") && /append-only/.test(e3.error || ""), [e1.error, e2.error, e3.error]);

  // chain
  t("the chain checks out (every hash matches its row and the one before)", (await as(db, "service_role", null, "select public.vault_deletion_chain_first_break() as b")).rows?.[0]?.b === null);
  await db.exec("alter table public.vault_item_deletions disable trigger trg_vault_item_deletions_no_edit; update public.vault_item_deletions set item_id = 'tampered' where id = 3; alter table public.vault_item_deletions enable trigger trg_vault_item_deletions_no_edit;");
  t("an edit made by the database owner (by disabling the trigger) is DETECTED: the chain reports the first changed row", (await as(db, "service_role", null, "select public.vault_deletion_chain_first_break() as b")).rows?.[0]?.b === null ? false : true);
  console.log("   (LIMIT shown: the owner can disable the trigger and edit; and could rewrite the whole chain, so the latest hash should be kept outside the database)");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
