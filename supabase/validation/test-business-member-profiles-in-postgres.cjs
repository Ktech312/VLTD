// Runs supabase/migrations/20261103_business_member_profiles.sql in a real in-process Postgres (PGlite, nothing remote)
// and checks every caller: owner, admin, member, removed member, unrelated person, signed-out, a personal profile with a member row.
//   node supabase/validation/test-business-member-profiles-in-postgres.cjs   (needs @electric-sql/pglite resolvable: set PGLITE_DIR to a folder that has it)
const fs = require("fs");
const path = require("path");
const { PGlite } = require(require.resolve("@electric-sql/pglite", { paths: [process.env.PGLITE_DIR || process.cwd()] }));
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 400)); };
const U = { owner: "00000000-0000-0000-0000-0000000000a1", admin: "00000000-0000-0000-0000-0000000000a2", member: "00000000-0000-0000-0000-0000000000a3", stranger: "00000000-0000-0000-0000-0000000000a4", ownerB: "00000000-0000-0000-0000-0000000000a5" };
const BIZ = "00000000-0000-0000-0000-00000000b001", PERS = "00000000-0000-0000-0000-00000000b002", OTHER_BIZ = "00000000-0000-0000-0000-00000000b003";

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles (
      id uuid primary key, user_id uuid not null, username text, display_name text, profile_type text, bio text, avatar_url text, avatar_emoji text,
      primary_focus text, is_public boolean, created_at timestamptz default now(), business_type text, website text, tier text, tier_expires_at timestamptz,
      tier_source text, onboarding_completed boolean,
      -- owner-only columns that must NEVER come back
      full_name text, phone text, address_line1 text, tax_id text, stripe_customer_id text, bulk_scans_used int, date_of_birth text);
    create table public.profile_members (profile_id uuid, user_id uuid, role text, primary key (profile_id, user_id));
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, "../migrations/20261103_business_member_profiles.sql"), "utf8"));
  await db.exec(`
    insert into public.profiles (id, user_id, username, display_name, profile_type, full_name, phone, address_line1, tax_id, stripe_customer_id, bulk_scans_used, date_of_birth, tier)
      values ('${BIZ}', '${U.owner}', 'biz', 'Biz Co', 'business', 'Owner Name', '555-0100', '1 Main St', 'TAX-123', 'cus_secret', 7, '1980-01-01', 'FULL'),
             ('${PERS}', '${U.owner}', 'owner_personal', 'Owner Personal', 'personal', 'Owner Name', '555-0100', '1 Main St', 'TAX-123', 'cus_secret', 7, '1980-01-01', 'FREE'),
             ('${OTHER_BIZ}', '${U.ownerB}', 'other', 'Other Biz', 'business', 'B Name', null, null, null, null, 0, null, 'FREE');
    insert into public.profile_members values ('${BIZ}', '${U.owner}', 'owner'), ('${PERS}', '${U.owner}', 'owner'), ('${OTHER_BIZ}', '${U.ownerB}', 'owner'),
      ('${BIZ}', '${U.admin}', 'admin'), ('${BIZ}', '${U.member}', 'member'),
      ('${PERS}', '${U.member}', 'member');   -- a member row on a PERSONAL profile (made by a direct database call): must not surface
  `);
  const as = async (uid, role = "authenticated") => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
    const r = await db.query("select public.list_member_profiles() as r");
    return r.rows[0].r;
  };
  let r = await as(U.member);
  check("member sees exactly the business they were added to", r.length === 1 && r[0].id === BIZ && r[0].member_role === "member", r);
  check("member does NOT see the personal profile they hold a stray member row on", !r.some((x) => x.id === PERS), r);
  check("member does NOT see someone else's business", !r.some((x) => x.id === OTHER_BIZ), r);
  const leaked = ["full_name", "phone", "address_line1", "tax_id", "stripe_customer_id", "bulk_scans_used", "date_of_birth", "user_id"].filter((k) => k in r[0]);
  check("no owner-only column is returned", leaked.length === 0, leaked);
  r = await as(U.admin);
  check("admin sees the business with role admin", r.length === 1 && r[0].member_role === "admin", r);
  r = await as(U.owner);
  check("owner gets nothing from this function (own profiles come from the normal query)", r.length === 0, r);
  r = await as(U.stranger);
  check("unrelated person gets an empty list", r.length === 0, r);
  r = await as("");
  check("signed-out caller gets an empty list", r.length === 0, r);
  await db.exec(`reset role; delete from public.profile_members where profile_id = '${BIZ}' and user_id = '${U.member}';`);
  r = await as(U.member);
  check("removed member: the business is gone from the list", r.length === 0, r);
  await db.exec(`reset role; insert into public.profile_members values ('${BIZ}', '${U.member}', 'member');`);
  r = await as(U.member);
  check("added again: it is back", r.length === 1, r);
  // privileges
  await db.exec("reset role; set role anon;");
  let anonBlocked = false; try { await db.query("select public.list_member_profiles()"); } catch { anonBlocked = true; }
  check("anon role cannot execute the function", anonBlocked);
  await db.exec("reset role; set role authenticated;");
  let authOk = true; try { await db.query("select public.list_member_profiles()"); } catch { authOk = false; }
  check("authenticated role can execute the function", authOk);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
