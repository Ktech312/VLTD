// READ-ONLY: what an anonymous visitor can retrieve from referral_codes and appreciations. The visitor is the anonymous public client
// (the site's public key, no session). It prints COLUMN NAMES, ROW COUNTS and yes/no classifications only, never a customer's values.
// The service-role client is used only afterwards, read-only, to say whether an id the visitor received is an authentication user id or a
// profile id (a yes/no per row), because the visitor cannot tell that for themselves.
//   node public-data-assessment.cjs
const { admin, env } = require("./ui-lib.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const say = (k, v) => console.log(k.padEnd(78), "=>", typeof v === "string" ? v : JSON.stringify(v));

(async () => {
  const authUserIds = new Set(); let page = 1;
  for (;;) { const r = await admin.auth.admin.listUsers({ page, perPage: 200 }); const us = (r.data && r.data.users) || []; us.forEach((u) => authUserIds.add(u.id)); if (us.length < 200) break; page++; }
  const profiles = (await admin.from("profiles").select("id,user_id,is_public,onboarding_completed")).data || [];
  const profileIds = new Set(profiles.map((p) => p.id)), profileAuthIds = new Set(profiles.map((p) => p.user_id));
  const hiddenProfile = new Set(profiles.filter((p) => p.is_public === false || p.onboarding_completed === false).map((p) => p.id));

  for (const table of ["referral_codes", "appreciations"]) {
    console.log(`\n================ ${table}: what an anonymous visitor gets ================`);
    const head = await anon.from(table).select("id", { count: "exact", head: true });
    say("visitor can count the rows (status / rows)", head.error ? "denied: " + head.error.message : head.count + " rows");
    const all = await anon.from(table).select("*").limit(1000);
    if (all.error) { say("visitor select *", "denied: " + all.error.message); continue; }
    const rows = all.data || [];
    say("columns returned by select *", rows[0] ? Object.keys(rows[0]) : "(no rows visible)");
    // each column on its own: is any column withheld?
    const cols = rows[0] ? Object.keys(rows[0]) : [];
    const perCol = {};
    for (const c of cols) { const r = await anon.from(table).select(c).limit(1); perCol[c] = r.error ? "denied" : "readable"; }
    say("each column asked for alone", perCol);
    // can the visitor search by an id or a code (lookup / enumeration)?
    if (table === "referral_codes" && rows[0]) {
      const byCode = await anon.from(table).select("user_id").eq("code", rows[0].code);
      say("visitor looks up the owner's id from a code (code -> user_id)", (byCode.data || []).length > 0 ? "YES (works)" : "no");
      const byUser = await anon.from(table).select("code").eq("user_id", rows[0].user_id);
      say("visitor looks up a code from an owner id (user_id -> code)", (byUser.data || []).length > 0 ? "YES (works)" : "no");
      const sample = await anon.from(table).select("code").limit(1);
      say("what a code looks like (shape only)", sample.data && sample.data[0] ? String(sample.data[0].code).replace(/[A-Z]/g, "A").replace(/[0-9]/g, "9") + " (" + String(sample.data[0].code).length + " characters)" : "-");
    }
    // classification of the identifier the visitor receives (yes/no per row, via the service client, read-only)
    if (table === "referral_codes") {
      const col = "user_id";
      say("rows whose user_id is an AUTHENTICATION user id (exists in the auth users list)", rows.filter((r) => authUserIds.has(r[col])).length + " of " + rows.length);
      say("rows whose user_id is a PROFILE id (exists as profiles.id)", rows.filter((r) => profileIds.has(r[col])).length + " of " + rows.length);
      say("rows whose user_id matches an account that owns a profile (profiles.user_id)", rows.filter((r) => profileAuthIds.has(r[col])).length + " of " + rows.length);
      const owners = rows.map((r) => profiles.filter((p) => p.user_id === r.user_id));
      say("owners with at least one profile that is public and finished (so a name could be found)", owners.filter((ps) => ps.some((p) => p.is_public !== false && p.onboarding_completed !== false)).length + " of " + rows.length);
    } else {
      say("rows whose profile_id is a PROFILE id (exists as profiles.id)", rows.filter((r) => profileIds.has(r.profile_id)).length + " of " + rows.length);
      say("rows whose profile_id is an AUTHENTICATION user id", rows.filter((r) => authUserIds.has(r.profile_id)).length + " of " + rows.length);
      say("rows whose profile is HIDDEN (private or unfinished) yet its id is shown", rows.filter((r) => hiddenProfile.has(r.profile_id)).length + " of " + rows.length);
      const itemIds = rows.map((r) => r.item_id);
      const pub = (await anon.from("public_vault_items").select("id,profile_id").in("id", itemIds)).data || [];
      say("rows whose item is public (visible to visitors anyway)", pub.length + " of " + rows.length);
      say("rows where the appreciated item belongs to the appreciating profile itself", rows.filter((r) => pub.some((p) => p.id === r.item_id && p.profile_id === r.profile_id)).length + " of " + rows.length);
      const names = rows.length ? (await anon.from("public_profiles").select("profile_id").in("profile_id", rows.map((r) => r.profile_id))).data || [] : [];
      say("rows whose appreciating profile also resolves to a public name (public_profiles)", names.length + " of " + rows.length);
      // what the app itself asks for
    }
  }
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
