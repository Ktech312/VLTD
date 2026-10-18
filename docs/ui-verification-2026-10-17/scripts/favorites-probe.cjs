// Direct API reads and writes on public_favorites with ordinary keys (visitor, unrelated signed-in account, owner, guests), on PRODUCTION.
// Counts and yes/no only: no account, profile or guest id is printed.   node favorites-probe.cjs before|after
//   needs journey-setup.cjs (J) and referral-setup-k.cjs (K) first. Everything it creates is removed at the end.
const crypto = require("crypto");
const { admin, env, man, createClient, sleep } = require("./journey-lib.cjs");
const MODE = /after/i.test(process.argv[2] || "") ? "after" : "before";
let pass = 0, fail = 0;
const line = (n, v, note) => console.log((typeof v === "boolean" ? (v ? "yes" : "no ") : String(v).padEnd(4)) + " " + n + (note ? "   [" + note + "]" : ""));
const expect = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 300)); };
const mkAnon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
(async () => {
  const m = man(); const K = m.k; const stamp = m.stamp;
  const signed = async (email, password) => { const c = mkAnon(); const r = await c.auth.signInWithPassword({ email, password }); if (r.error) throw r.error; return c; };
  const J = await signed(m.email, m.password), Kc = await signed(K.email, K.password), anon = mkAnon();
  const IT = "qa_fp_" + stamp + "_item", GA = "qa_fp_" + stamp + "_gal";
  const G1 = "qa-guest-" + crypto.randomUUID(), G2 = "qa-guest-" + crypto.randomUUID();
  await admin.from("public_favorites").delete().in("content_id", [IT, GA]);
  console.log("=== public_favorites probe:", MODE.toUpperCase(), "===");
  // ---- setup through the normal doors ----
  const sJ = await J.from("public_favorites").insert({ content_type: "item", content_id: IT, user_id: m.userId, metadata: { profile_id: m.personalId, title: "QA probe item" } });
  const sJ2 = await J.from("public_favorites").insert({ content_type: "gallery", content_id: GA, user_id: m.userId, metadata: { profile_id: m.businessId } });
  const sK = await Kc.from("public_favorites").insert({ content_type: "item", content_id: IT, user_id: K.userId, metadata: { profile_id: K.profileId } });
  const sG1 = await anon.from("public_favorites").insert({ content_type: "gallery", content_id: GA, anonymous_id: G1, metadata: {} });
  const sG2 = await anon.from("public_favorites").insert({ content_type: "gallery", content_id: GA, anonymous_id: G2, metadata: {} });
  const setupOk = [sJ, sJ2, sK, sG1, sG2].every((r) => !r.error);
  line("setup: both accounts and two guests can still SAVE through the normal doors", setupOk, [sJ, sJ2, sK, sG1, sG2].map((r) => r.error?.message?.slice(0, 40)).filter(Boolean).join("; "));
  if (MODE === "after") expect("[write] accounts and guests can save", setupOk);
  const dbRows = (await admin.from("public_favorites").select("id,user_id,anonymous_id,content_id").in("content_id", [IT, GA])).data || [];
  // ---- reads ----
  const rd = async (label, q) => { const r = await q; return { label, n: (r.data || []).length, err: r.error?.message || null, count: r.count }; };
  const aAll = await rd("visitor: list everything", anon.from("public_favorites").select("*"));
  const aJ = await rd("visitor: rows of account J", anon.from("public_favorites").select("user_id,content_id,metadata").eq("user_id", m.userId));
  const aGuest = await rd("visitor: guest ids", anon.from("public_favorites").select("anonymous_id").not("anonymous_id", "is", null));
  const aProf = await rd("visitor: profile ids (metadata)", anon.from("public_favorites").select("metadata").eq("content_id", IT));
  const aCnt = await rd("visitor: head count of rows", anon.from("public_favorites").select("id", { count: "exact", head: true }).eq("content_id", IT));
  const kAll = await rd("unrelated signed-in K: list everything", Kc.from("public_favorites").select("*"));
  const kJ = await rd("unrelated signed-in K: rows of account J", Kc.from("public_favorites").select("user_id,metadata").eq("user_id", m.userId));
  const kGuest = await rd("unrelated signed-in K: guest rows", Kc.from("public_favorites").select("anonymous_id").not("anonymous_id", "is", null));
  const kOwn = await rd("K: own rows", Kc.from("public_favorites").select("content_id,metadata").eq("user_id", K.userId));
  const jOwn = await rd("J: own rows", J.from("public_favorites").select("content_id,metadata").eq("user_id", m.userId));
  const jAll = await rd("J: list everything", J.from("public_favorites").select("user_id"));
  const bkA = await rd("visitor: the 2026-10-10 backup copy", anon.from("public_favorites_backup_20261010").select("user_id").limit(5));
  const bkK = await rd("signed-in K: the 2026-10-10 backup copy", Kc.from("public_favorites_backup_20261010").select("user_id").limit(5));
  const show = (r, bad) => line(r.label, r.err ? "denied" : r.n, r.err ? r.err.slice(0, 45) : (bad ? "rows returned" : ""));
  [aAll, aJ, aGuest, aProf, aCnt, kAll, kJ, kGuest, kOwn, jOwn, jAll, bkA, bkK].forEach((r) => show(r, true));
  const exposedToVisitor = (aAll.n + aJ.n + aGuest.n + aProf.n) > 0;
  const exposedToOthers = kJ.n + kGuest.n + kAll.filter?.length > 0 || (kAll.n > kOwn.n) || kJ.n > 0 || kGuest.n > 0;
  line("EXPOSURE: a visitor can read other people's saves (accounts, profiles, guest ids)", exposedToVisitor);
  line("EXPOSURE: an unrelated signed-in account can read other people's saves", kJ.n > 0 || kGuest.n > 0 || kAll.n > kOwn.n);
  line("EXPOSURE: the backup copy is readable by a visitor or a signed-in account", bkA.n > 0 || bkK.n > 0);
  // ---- aggregate count and guest status through the functions ----
  const cA = await anon.rpc("favorite_count", { p_content_type: "item", p_content_id: IT });
  const cK = await Kc.rpc("favorite_count", { p_content_type: "item", p_content_id: IT });
  const gsOk = await anon.rpc("guest_favorite_status", { p_content_type: "gallery", p_content_id: GA, p_anonymous_id: G1 });
  const gsBad = await anon.rpc("guest_favorite_status", { p_content_type: "gallery", p_content_id: GA, p_anonymous_id: "qa-guest-not-a-real-id" });
  const gsEmpty = await anon.rpc("guest_favorite_status", { p_content_type: "gallery", p_content_id: GA, p_anonymous_id: "" });
  const gsUser = await anon.rpc("guest_favorite_status", { p_content_type: "item", p_content_id: IT, p_anonymous_id: m.userId });
  line("functions: favorite_count for a visitor", cA.error ? "absent" : cA.data, cA.error?.message?.slice(0, 40));
  line("functions: guest_favorite_status with the guest's own id", gsOk.error ? "absent" : gsOk.data, gsOk.error?.message?.slice(0, 40));
  // ---- writes and ownership ----
  const forgeAnon = await anon.from("public_favorites").insert({ content_type: "item", content_id: IT + "_x", user_id: m.userId });
  const forgeK = await Kc.from("public_favorites").insert({ content_type: "item", content_id: IT + "_y", user_id: m.userId });
  line("write: a visitor can save AS account J", !forgeAnon.error);
  line("write: unrelated account K can save AS account J", !forgeK.error);
  await admin.from("public_favorites").delete().in("content_id", [IT + "_x", IT + "_y"]);
  const delK = await Kc.from("public_favorites").delete().eq("user_id", m.userId).eq("content_id", IT);
  const stillJ = (await admin.from("public_favorites").select("id").eq("user_id", m.userId).eq("content_id", IT)).data || [];
  line("write: unrelated account K can delete J's save", stillJ.length === 0);
  const delAnon = await anon.from("public_favorites").delete().eq("anonymous_id", G2);
  const stillG2 = (await admin.from("public_favorites").select("id").eq("anonymous_id", G2)).data || [];
  line("write: a visitor can delete a guest's save directly (without the guest-only function)", stillG2.length === 0, delAnon.error?.message?.slice(0, 40));
  await anon.rpc("unfavorite_as_guest", { p_content_type: "gallery", p_content_id: GA, p_anonymous_id: "qa-guest-wrong-id" });
  const g1After = (await admin.from("public_favorites").select("id").eq("anonymous_id", G1)).data || [];
  line("guest ownership: unfavorite_as_guest with a WRONG guest id removed the guest's save", g1After.length === 0);
  await anon.rpc("unfavorite_as_guest", { p_content_type: "gallery", p_content_id: GA, p_anonymous_id: G1 });
  const g1Gone = ((await admin.from("public_favorites").select("id").eq("anonymous_id", G1)).data || []).length === 0;
  line("guest ownership: unfavorite_as_guest with the guest's OWN id removed it", g1Gone);
  const delJ = await J.from("public_favorites").delete().eq("user_id", m.userId).eq("content_id", GA);
  const jGone = ((await admin.from("public_favorites").select("id").eq("user_id", m.userId).eq("content_id", GA)).data || []).length === 0;
  line("write: J can unsave its own", jGone, delJ.error?.message?.slice(0, 40));

  if (MODE === "after") {
    expect("[read] a visitor can list nothing: everything, J's rows, guest ids, profile ids and counts are all refused or empty", [aAll, aJ, aGuest, aProf, aCnt].every((r) => r.err || r.n === 0), [aAll, aJ, aGuest, aProf].map((r) => [r.n, r.err]));
    expect("[read] an unrelated signed-in account sees only its own rows (none of J's, no guest rows, no one else's profile ids)", kJ.n === 0 && kGuest.n === 0 && kAll.n === kOwn.n && kAll.n === 1, { kAll: kAll.n, kOwn: kOwn.n, kJ: kJ.n, kGuest: kGuest.n });
    expect("[read] the owner still reads its own saves (2) and nothing else", jOwn.n === 2 && jAll.n === 2, { jOwn: jOwn.n, jAll: jAll.n });
    expect("[read] the backup copy is not readable by a visitor or a signed-in account", (bkA.err || bkA.n === 0) && (bkK.err || bkK.n === 0), [bkA, bkK].map((r) => [r.n, r.err]));
    expect("[count] the public aggregate count works for a visitor and a signed-in account and counts ALL saves of the item (account J + K = 2)", !cA.error && cA.data === 2 && !cK.error && cK.data === 2, [cA.data, cK.data, cA.error?.message]);
    expect("[guest] a guest's own id says yes; a wrong, empty or account id says no", gsOk.data === true && gsBad.data === false && gsEmpty.data === false && gsUser.data === false, [gsOk.data, gsBad.data, gsEmpty.data, gsUser.data]);
    expect("[write] nobody can save as another account (visitor, unrelated account)", !!forgeAnon.error && !!forgeK.error, [forgeAnon.error?.message, forgeK.error?.message]);
    expect("[write] an unrelated account cannot unsave J's save", stillJ.length === 1);
    expect("[write] a visitor cannot delete a guest's save directly", stillG2.length === 1);
    expect("[guest ownership] a wrong guest id removes nothing; the guest's own id removes exactly its save; J can unsave its own", g1After.length === 1 && g1Gone && jGone, { g1After: g1After.length, g1Gone, jGone });
  }
  // cleanup of everything this probe made
  await admin.from("public_favorites").delete().in("content_id", [IT, GA, IT + "_x", IT + "_y"]);
  const left = (await admin.from("public_favorites").select("id", { count: "exact", head: true }).in("content_id", [IT, GA, IT + "_x", IT + "_y"])).count;
  console.log("probe rows left:", left);
  if (MODE === "after") console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
