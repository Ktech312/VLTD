// Production check for the public-data restriction (docs/proposals/public-data-minimum-restrictions-2026-10-17.sql), through the real API:
// what an anonymous visitor can and cannot retrieve, that the public Vibe counts still work, and that a signed-in user's follow-up actions still work.
// Run it BEFORE the SQL (the "visitor cannot ..." rows fail: that is today's exposure) and AFTER (every row must pass).
//   node public-data-after-checks.cjs <label>
// Anonymous = the site's public key with no session. Signed-in = the synthetic QA user. Writes only QA-owned rows (one Vibe, one referral code) and removes them.
const { qa, admin, env } = require("./ui-lib.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const LABEL = process.argv[2] || "run";
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 400)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 400));
const mk = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const blocked = (r) => !!r.error && /permission denied|42501/i.test(r.error.message + " " + (r.error.code || ""));
const ITEM = `qa_ui_${qa.stamp}_2`, ITEM2 = `qa_ui_${qa.stamp}_3`;

(async () => {
  const anon = mk();
  const me = mk(); const si = await me.auth.signInWithPassword({ email: qa.email, password: qa.password });
  if (si.error) throw si.error;
  await admin.from("appreciations").delete().eq("profile_id", qa.profileId);
  await admin.from("referral_codes").delete().eq("user_id", qa.userId);
  try {
    // a known QA code and a known QA Vibe, so that "a visitor can read them" is a real test and not an empty table
    const seed = await admin.from("referral_codes").insert({ user_id: qa.userId, code: "QA" + qa.stamp.toUpperCase().slice(0, 7) }).select("code").single();
    await admin.from("appreciations").insert({ item_id: ITEM, profile_id: qa.profileId });

    console.log("\n--- an anonymous visitor ---");
    const codes = await anon.from("referral_codes").select("*").limit(5);
    check("[visitor] cannot read referral codes or the authentication ids next to them (select *)", blocked(codes) || (!codes.error && (codes.data || []).length === 0), codes.error ? codes.error.message : { rowsSeen: (codes.data || []).length, columns: codes.data && codes.data[0] ? Object.keys(codes.data[0]) : [] });
    const byCode = await anon.from("referral_codes").select("user_id").eq("code", seed.data.code);
    check("[visitor] cannot look up an owner from a code, nor a code from an owner id", (blocked(byCode) || (byCode.data || []).length === 0) && (blocked(await anon.from("referral_codes").select("code").eq("user_id", qa.userId)) || ((await anon.from("referral_codes").select("code").eq("user_id", qa.userId)).data || []).length === 0), byCode.data);
    const prof = await anon.from("appreciations").select("profile_id").eq("item_id", ITEM);
    check("[visitor] cannot read which profile vibed an item (profile_id)", blocked(prof) || (prof.data || []).length === 0, prof.error ? prof.error.message : { rowsSeen: (prof.data || []).length });
    const star = await anon.from("appreciations").select("*").eq("item_id", ITEM);
    check("[visitor] cannot read appreciations with select * (profile_id and created_at are withheld)", blocked(star) || (star.data || []).length === 0, star.error ? star.error.message : { rowsSeen: (star.data || []).length, columns: star.data && star.data[0] ? Object.keys(star.data[0]) : [] });
    const when = await anon.from("appreciations").select("created_at").eq("item_id", ITEM);
    check("[visitor] cannot read when it was vibed (created_at)", blocked(when) || (when.data || []).length === 0);
    const head = await anon.from("appreciations").select("id", { count: "exact", head: true }).eq("item_id", ITEM);
    check("[visitor] the public Vibe COUNT for an item still works (count of id)", !head.error && head.count === 1, head.error ? head.error.message : head.count);
    const batch = await anon.from("appreciations").select("item_id").in("item_id", [ITEM, ITEM2]);
    check("[visitor] the batch counts used by exhibitions and Discover still work (item_id for a list of items)", !batch.error && (batch.data || []).length === 1 && batch.data[0].item_id === ITEM, batch.error ? batch.error.message : batch.data);

    console.log("\n--- a signed-in user (the synthetic QA user) ---");
    const own = await me.from("referral_codes").select("code").eq("user_id", qa.userId).maybeSingle();
    check("[signed-in] reads their own referral code (invite page)", !own.error && own.data && own.data.code === seed.data.code, own.error ? own.error.message : own.data);
    await admin.from("referral_codes").delete().eq("user_id", qa.userId);
    const made = await me.from("referral_codes").insert({ user_id: qa.userId, code: "QB" + qa.stamp.toUpperCase().slice(0, 7) }).select("code").single();
    check("[signed-in] creates their own referral code when they have none (invite page)", !made.error && !!(made.data && made.data.code), made.error ? made.error.message : made.data);
    const seen = await me.from("referral_codes").select("id", { count: "exact", head: true });
    info("[signed-in] referral codes a signed-in user can see in total (not changed by this SQL; 1 = only their own)", seen.error ? seen.error.message : seen.count);
    const vibes = await me.from("appreciations").select("item_id").eq("profile_id", qa.profileId).in("item_id", [ITEM, ITEM2]);
    check("[signed-in] 'which of these items have I vibed' works (item_id where my profile)", !vibes.error && (vibes.data || []).length === 1 && vibes.data[0].item_id === ITEM, vibes.error ? vibes.error.message : vibes.data);
    const has = await me.from("appreciations").select("id").eq("item_id", ITEM).eq("profile_id", qa.profileId).maybeSingle();
    check("[signed-in] 'have I vibed this one' works (id where item and my profile)", !has.error && !!has.data, has.error ? has.error.message : has.data);
    const add = await me.from("appreciations").insert({ item_id: ITEM2, profile_id: qa.profileId });
    check("[signed-in] Vibe works (insert as my own profile)", !add.error, add.error && add.error.message);
    const cntMe = await me.from("appreciations").select("id", { count: "exact", head: true }).eq("item_id", ITEM2);
    const cntAnon = await anon.from("appreciations").select("id", { count: "exact", head: true }).eq("item_id", ITEM2);
    check("[signed-in] the count they see and the count a visitor sees agree (1 and 1)", !cntMe.error && !cntAnon.error && cntMe.count === 1 && cntAnon.count === 1, { me: cntMe.count, visitor: cntAnon.count });
    const del = await me.from("appreciations").delete().eq("item_id", ITEM2).eq("profile_id", qa.profileId);
    const after = await admin.from("appreciations").select("id", { count: "exact", head: true }).eq("item_id", ITEM2);
    check("[signed-in] un-Vibe works (delete my own)", !del.error && after.count === 0, del.error ? del.error.message : after.count);
    const someoneElse = await me.from("appreciations").insert({ item_id: ITEM2, profile_id: "11111111-1111-1111-1111-111111111111" });
    check("[signed-in] still cannot Vibe as somebody else's profile (row-level security unchanged)", !!someoneElse.error, someoneElse.data);
    await admin.from("appreciations").delete().eq("item_id", ITEM2);
  } finally {
    await admin.from("appreciations").delete().eq("profile_id", qa.profileId);
    await admin.from("referral_codes").delete().eq("user_id", qa.userId);
  }
  console.log(`\n[${LABEL}] ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
