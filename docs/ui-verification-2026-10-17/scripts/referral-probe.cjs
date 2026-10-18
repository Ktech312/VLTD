// Two synthetic accounts (J, K) against the PRODUCTION API with ordinary user keys (the same way the app calls it).
// Prints counts and yes/no only: no real person's code or id is printed. node referral-probe.cjs [label]
const { admin, env, man, createClient, sleep } = require("./journey-lib.cjs");
const LABEL = process.argv[2] || "probe";
const rows = [];
const rec = (n, v, note) => { rows.push({ n, v }); console.log((typeof v === "boolean" ? (v ? "yes" : "no ") : String(v).padEnd(4)) + " " + n + (note ? "   [" + note + "]" : "")); };
(async () => {
  const m = man(); const K = m.k;
  const mk = async (email, password) => { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } }); const r = await c.auth.signInWithPassword({ email, password }); if (r.error) throw r.error; return c; };
  const J = await mk(m.email, m.password), Kc = await mk(K.email, K.password);
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  console.log("=== referral probe:", LABEL, "===");

  // the app's own get-or-create, for each account
  const getOrCreate = async (c, uid) => {
    const ex = await c.from("referral_codes").select("code").eq("user_id", uid).maybeSingle();
    if (ex.data?.code) return { code: ex.data.code, created: false };
    for (let a = 0; a < 3; a++) {
      const code = uid.replace(/-/g, "").slice(0, 5).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
      const ins = await c.from("referral_codes").insert({ user_id: uid, code }).select("code").single();
      if (!ins.error && ins.data?.code) return { code: ins.data.code, created: true };
      if (ins.error?.code !== "23505") return { error: ins.error?.message };
    }
    return { error: "gave up" };
  };
  const jc = await getOrCreate(J, m.userId), kc = await getOrCreate(Kc, K.userId);
  rec("own: signed-in account gets or creates its OWN code (J)", !!jc.code, jc.error);
  rec("own: signed-in account gets or creates its OWN code (K)", !!kc.code, kc.error);
  const kcode = kc.code;
  const own = await J.from("referral_codes").select("code").eq("user_id", m.userId);
  rec("own: J can read its own code row", !own.error && own.data?.length === 1, own.error?.message);

  // cross-account reads
  const all = await J.from("referral_codes").select("*");
  const notMine = (all.data || []).filter((r) => r.user_id !== m.userId).length;
  rec("cross: rows of OTHER accounts that J can list (select * with no filter)", all.error ? "err" : notMine, all.error?.message);
  const byUser = await J.from("referral_codes").select("code,user_id").eq("user_id", K.userId);
  rec("cross: J looks up K's row by K's account id (rows returned)", byUser.error ? "err" : (byUser.data || []).length);
  const byCode = await J.from("referral_codes").select("user_id").eq("code", kcode);
  rec("cross: J looks up the OWNER ID of K's code by the code (rows returned)", byCode.error ? "err" : (byCode.data || []).length);
  const anonR = await anon.from("referral_codes").select("code").limit(1);
  rec("visitor (no sign-in): can read referral_codes", !anonR.error && (anonR.data || []).length > 0, anonR.error?.message?.slice(0, 40));

  // cross-account writes
  const forge = await J.from("referral_codes").insert({ user_id: K.userId, code: "ZQ" + Math.random().toString(36).slice(2, 9).toUpperCase() }).select("code");
  rec("cross: J can insert a code owned by K", !forge.error, forge.error?.message?.slice(0, 50));
  if (!forge.error) await admin.from("referral_codes").delete().eq("code", forge.data?.[0]?.code);
  await J.from("referral_codes").delete().eq("code", kcode);
  const still = await admin.from("referral_codes").select("id").eq("code", kcode);
  rec("cross: J can delete K's code", (still.data || []).length === 0);
  if ((still.data || []).length === 0) await Kc.from("referral_codes").insert({ user_id: K.userId, code: kcode });
  await J.from("referral_codes").update({ code: "HIJACK" + Math.random().toString(36).slice(2, 5).toUpperCase() }).eq("user_id", K.userId);
  const still2 = await admin.from("referral_codes").select("code").eq("user_id", K.userId);
  rec("cross: J can change K's code", !(still2.data || []).some((r) => r.code === kcode) && (still2.data || []).length > 0);
  if (!(still2.data || []).some((r) => r.code === kcode)) await admin.from("referral_codes").update({ code: kcode }).eq("user_id", K.userId);

  // the redemption tables the same workflow touches (reads only, plus the app's own redemption calls)
  const red = await J.from("referral_redemptions").select("*");
  const redOther = (red.data || []).filter((r) => r.referrer_id !== m.userId && r.referred_id !== m.userId).length;
  rec("cross: redemption rows involving OTHER accounts that J can list", red.error ? "err" : redOther, red.error?.message?.slice(0, 40));
  const perks = await J.from("user_perks").select("user_id,bonus_galleries");
  rec("cross: other accounts' perk rows that J can list", perks.error ? "err" : (perks.data || []).filter((r) => r.user_id !== m.userId).length, perks.error?.message?.slice(0, 40));
  // can an ordinary account grant itself bonus galleries through the helper the app calls? (writes only to the synthetic account's own perk row)
  const grant = await J.rpc("increment_user_perk_galleries", { p_user_id: m.userId, p_amount: 1, p_reason: "qa probe", p_granted_by: "qa" });
  rec("perk: J can give ITSELF bonus galleries through the rpc", !grant.error, grant.error?.message?.slice(0, 60));
  const myPerks = await admin.from("user_perks").select("bonus_galleries").eq("user_id", m.userId);
  rec("perk: a perk row for J exists afterwards", (myPerks.data || []).length > 0);

  const redemptionsOf = async () => (await admin.from("referral_redemptions").select("referrer_id,referred_id,code").eq("referred_id", m.userId)).data || [];
  await admin.from("referral_redemptions").delete().eq("referred_id", m.userId);
  const MODE = /after/i.test(LABEL) ? "after" : "before";
  if (MODE === "before") {
    // the app's CURRENT redemption sequence (redeemReferralCode in src/lib/referral.ts), as J redeeming K's code
    const look = await J.from("referral_codes").select("user_id").eq("code", kcode).maybeSingle();
    const ins = look.data ? await J.from("referral_redemptions").insert({ code: kcode, referrer_id: look.data.user_id, referred_id: m.userId }) : { error: { message: "lookup returned nothing" } };
    rec("redeem (today's way): lookup + record a redemption works", !!look.data && !ins.error, ins.error?.message?.slice(0, 50));
    const forge = await J.from("referral_redemptions").insert({ code: "FORGED", referrer_id: K.userId, referred_id: m.userId });
    rec("redeem: a second, forged redemption (arbitrary code) is refused", !!forge.error, forge.error?.message?.slice(0, 50));
    await admin.from("referral_redemptions").delete().eq("referred_id", m.userId);
  } else {
    const r1 = await J.rpc("redeem_referral_code", { p_code: kcode });
    rec("redeem (new way): J redeems K's code through the function", !r1.error && r1.data?.ok === true, r1.error?.message || JSON.stringify(r1.data));
    rec("redeem: the answer carries ONLY ok (no account id, no code owner)", !r1.error && JSON.stringify(Object.keys(r1.data || {}).sort()) === JSON.stringify(["ok"]), JSON.stringify(r1.data));
    const rd = await redemptionsOf();
    rec("redeem: the redemption is recorded with K as referrer and J as referred", rd.length === 1 && rd[0].referrer_id === K.userId && rd[0].referred_id === m.userId);
    const r2 = await J.rpc("redeem_referral_code", { p_code: kcode });
    rec("redeem: redeeming again is refused with a plain message", !r2.error && r2.data?.ok === false && /already/i.test(r2.data?.error || ""), JSON.stringify(r2.data));
    const r3 = await Kc.rpc("redeem_referral_code", { p_code: kcode });
    rec("redeem: redeeming your own code is refused", !r3.error && r3.data?.ok === false && /yourself/i.test(r3.data?.error || ""), JSON.stringify(r3.data));
    const r4 = await Kc.rpc("redeem_referral_code", { p_code: "NOSUCHCODE1" });
    rec("redeem: an unknown code is refused and does not say whether the code exists elsewhere", !r4.error && r4.data?.ok === false && /invalid/i.test(r4.data?.error || ""), JSON.stringify(r4.data));
    const r5 = await anon.rpc("redeem_referral_code", { p_code: kcode });
    rec("redeem: a visitor with no sign-in cannot call it", !!r5.error, r5.error?.message?.slice(0, 50));
    const perksAfter = await admin.from("user_perks").select("user_id").in("user_id", [m.userId, K.userId]);
    rec("redeem: no bonus galleries are granted by the function (unchanged behaviour; EK's decision)", (perksAfter.data || []).length === (myPerks.data || []).length, (perksAfter.data || []).length);
    // admin read, verified with a throwaway admin row for the synthetic address only (removed straight away)
    const roleIns = await admin.from("user_roles").insert({ email: m.email, role: "admin", granted_by: "qa probe" });
    try {
      await sleep(1500);
      const adm = await J.from("referral_codes").select("code,user_id");
      const nAdm = (adm.data || []).length;
      rec("admin: an account in user_roles can still list ALL codes (admin page keeps working)", !roleIns.error && nAdm >= 2, roleIns.error?.message || nAdm);
    } finally { await admin.from("user_roles").delete().eq("email", m.email); }
    const after = await J.from("referral_codes").select("code,user_id");
    rec("admin: once the throwaway admin row is removed J is back to its own row only", (after.data || []).length === 1);
    const stillRole = await admin.from("user_roles").select("email").eq("email", m.email);
    rec("admin: no admin row is left for the synthetic address", (stillRole.data || []).length === 0);
  }
  console.log("RESULT_JSON " + JSON.stringify(rows));
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
