// Runs 2-public-view-asking-price.sql, its validation and its rollback in a real in-process Postgres against a stand-in for the public items view
// (the 20261008 definition plus the 20261016 hidden-profile filter) with synthetic rows.
//   node test-view-sql-in-postgres.cjs   (PGLITE_DIR = folder holding node_modules/@electric-sql/pglite)
const fs = require("fs");
const path = require("path");
const PG_DIR = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(PG_DIR, "node_modules", "@electric-sql/pglite"));
const SQL = path.join(__dirname, "..", "sql");
const MIG = path.join(__dirname, "..", "..", "..", "..", "supabase", "migrations");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 400)); };

(async () => {
  const build = async (opts = {}) => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create table public.profiles (id uuid primary key, is_public boolean default true, onboarding_completed boolean default true);
    create table public.vault_items (
      id text primary key, profile_id text, title text, subtitle text, number text, grade text, universe text, category text, custom_category_label text,
      category_label text, subcategory_label text, subject text, year text, condition text, brand text, edition text, variant text, tags text[],
      description text, cert_number text, is_first_edition boolean, status text, is_public boolean, is_new boolean, created_at bigint,
      image_front_url text, image_front_storage_path text, image_back_url text, primary_image_key text, images_json jsonb, current_value numeric,
      auction_status text, auction_ends_at timestamptz, auction_starting_bid numeric, auction_current_bid numeric, auction_bid_count int,
      auction_winner_id text, reserve_price numeric, buy_it_now_price numeric, asking_price numeric,
      notes text, purchase_price numeric);
    grant usage on schema public to anon, authenticated;
  `);
  // the helper and the view exactly as the migrations leave them
  const hid = fs.readFileSync(path.join(MIG, "20261016_public_data_respects_hidden_profiles.sql"), "utf8");
  await db.exec(hid.slice(hid.indexOf("create or replace function public.profile_is_hidden"), hid.indexOf("-- B. the public items view")));
  if (opts.skipHelper) await db.exec("drop function public.profile_is_hidden(text) cascade");
  const v1 = fs.readFileSync(path.join(MIG, "20261008_public_vault_items_view.sql"), "utf8");
  await db.exec(v1.slice(v1.indexOf("do $$")));
  if (!opts.plainView && !opts.skipHelper) await db.exec(hid.slice(hid.indexOf("-- B. the public items view"), hid.indexOf("-- C. public_profiles")));
  if (opts.noAnonGrant) await db.exec("revoke select on public.public_vault_items from anon");
  if (opts.viewOptions) await db.exec(`alter view public.public_vault_items set (${opts.viewOptions})`);
  const PA = "11111111-1111-1111-1111-111111111111", PH = "22222222-2222-2222-2222-222222222222";
  await db.query("insert into public.profiles values ($1, true, true), ($2, false, true)", [PA, PH]);
  const ins = (id, prof, status, pub, ask, val) => db.query("insert into public.vault_items (id, profile_id, title, status, is_public, asking_price, current_value, notes, purchase_price) values ($1,$2,$3,$4,$5,$6,$7,'PRIVATE NOTE',5)", [id, prof, id, status, pub, ask, val]);
  await ins("sale1", PA, "FOR_SALE", true, 250, 100);
  await ins("sale2", PA, "FOR_SALE", true, null, 65);
  await ins("owned1", PA, "COLLECTION", true, 999, 10); // stale asking price on an item that is not for sale
  await ins("private1", PA, "FOR_SALE", false, 50, 5);
  await ins("hiddenProfile", PH, "FOR_SALE", true, 77, 7);
  const asAnon = async (sql) => { await db.exec("set role anon"); try { return (await db.query(sql)).rows; } catch (e) { return { error: String(e.message) }; } finally { await db.exec("reset role"); } };

  return { db, asAnon };
  };
  const { db, asAnon } = await build();
  let r = await asAnon("select asking_price from public.public_vault_items limit 1");
  check("BEFORE: the view has no asking_price", !!r.error && /asking_price/.test(r.error), r);

  await db.exec(fs.readFileSync(path.join(SQL, "2-public-view-asking-price.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(SQL, "2-public-view-asking-price.sql"), "utf8")); // idempotent
  check("re-run is harmless", true);

  r = await asAnon("select id, asking_price from public.public_vault_items order by id");
  const m = Object.fromEntries((Array.isArray(r) ? r : []).map((x) => [x.id, x.asking_price === null ? null : Number(x.asking_price)]));
  check("visitor sees the asking price of a public for-sale item", m.sale1 === 250, m);
  check("a for-sale item with no asking price shows none", m.sale2 === null, m);
  check("an item that is not for sale shows no asking price even if one is stored", m.owned1 === null, m);
  check("private item and hidden-profile item are not in the view", !("private1" in m) && !("hiddenProfile" in m), m);
  r = await asAnon("select * from public.public_vault_items limit 1");
  const cols = Object.keys(Array.isArray(r) && r[0] ? r[0] : {});
  check("private columns are still not exposed", !cols.includes("notes") && !cols.includes("purchase_price"), cols);
  check("asking_price is the last column", cols[cols.length - 1] === "asking_price", cols);

  const val = (await db.query(fs.readFileSync(path.join(SQL, "validation-2.sql"), "utf8").replace(/^--.*$/gm, ""))).rows[0].result;
  check("validation query: all true", Object.values(val).every((x) => x === true), val);

  await db.exec(fs.readFileSync(path.join(SQL, "rollback-2.sql"), "utf8"));
  r = await asAnon("select asking_price from public.public_vault_items limit 1");
  check("ROLLBACK: asking_price gone again", !!r.error && /asking_price/.test(r.error), r);
  r = await asAnon("select id from public.public_vault_items order by id");
  check("ROLLBACK: same public rows as before (hidden profile and private item still excluded)", Array.isArray(r) && r.map((x) => x.id).join(",") === "owned1,sale1,sale2", r);

  // ---------- stops safely when production is not what was reviewed
  const sqlText = fs.readFileSync(path.join(SQL, "2-public-view-asking-price.sql"), "utf8");
  const viewState = async (d) => JSON.stringify((await d.query("select column_name from information_schema.columns where table_schema='public' and table_name='public_vault_items' order by ordinal_position")).rows.map((x) => x.column_name));
  for (const [name, opts, re] of [
    ["the privacy helper is missing", { skipHelper: true }, /profile_is_hidden\(text\) is missing/],
    ["the view no longer filters hidden profiles (a less-protected view)", { plainView: true }, /does not filter hidden profiles/],
    ["anon cannot read the view today (the file must not add grants)", { noAnonGrant: true }, /anon or authenticated cannot read the view/],
  ]) {
    const t = await build(opts);
    const before = await viewState(t.db);
    let err = null; try { await t.db.exec(sqlText); } catch (e) { err = String(e.message || e); try { await t.db.exec("rollback"); } catch {} }
    check("STOPS: " + name, !!err && re.test(err), err);
    check("STOPS: " + name + " -- the view is untouched", (await viewState(t.db)) === before && !before.includes("asking_price"), before);
  }
  // options and grants and column order survive; rollback restores everything
  {
    const t = await build({ viewOptions: "security_barrier=true" });
    const before = JSON.parse(await viewState(t.db));
    const g0 = (await t.db.query("select grantee, privilege_type from information_schema.role_table_grants where table_name='public_vault_items' order by 1,2")).rows;
    await t.db.exec(sqlText);
    const after = JSON.parse(await viewState(t.db));
    check("every earlier column keeps its name and position; asking_price is appended", JSON.stringify(after.slice(0, -1)) === JSON.stringify(before) && after[after.length - 1] === "asking_price", { before, after });
    const opts = (await t.db.query("select reloptions from pg_class where oid = 'public.public_vault_items'::regclass")).rows[0].reloptions;
    check("view options (security_barrier) are kept", Array.isArray(opts) && opts.includes("security_barrier=true"), opts);
    const g1 = (await t.db.query("select grantee, privilege_type from information_schema.role_table_grants where table_name='public_vault_items' order by 1,2")).rows;
    check("grants are exactly as before (nothing added or removed)", JSON.stringify(g1) === JSON.stringify(g0), { g0, g1 });
    await t.db.exec(fs.readFileSync(path.join(SQL, "rollback-2.sql"), "utf8"));
    check("ROLLBACK restores the exact previous columns", (await viewState(t.db)) === JSON.stringify(before), await viewState(t.db));
    const opts2 = (await t.db.query("select reloptions from pg_class where oid = 'public.public_vault_items'::regclass")).rows[0].reloptions;
    check("ROLLBACK restores the view options", Array.isArray(opts2) && opts2.includes("security_barrier=true"), opts2);
    const g2 = (await t.db.query("select grantee, privilege_type from information_schema.role_table_grants where table_name='public_vault_items' order by 1,2")).rows;
    check("ROLLBACK restores the grants", JSON.stringify(g2) === JSON.stringify(g0), { g0, g2 });
    const still = (await t.db.query("select pg_get_viewdef('public.public_vault_items'::regclass, true) d")).rows[0].d;
    check("ROLLBACK keeps the hidden-profile filter", /profile_is_hidden/.test(still), still.slice(0, 200));
  }

  console.log("\n" + pass + " pass, " + fail + " fail");
  process.exit(fail ? 1 : 0);
})();
