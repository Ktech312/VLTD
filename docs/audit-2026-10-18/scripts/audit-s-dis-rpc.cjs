const { createClient, env, man } = require("./journey-lib.cjs"); const m = man();
(async () => {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const a = await sb.rpc("get_subject_leaderboard", { p_subject: "comics", p_limit: 25 }); console.log("get_subject_leaderboard(anon):", a.status, JSON.stringify(a.error));
  const b = await sb.rpc("get_top_subjects", { p_limit: 12 }); console.log("get_top_subjects(anon):", b.status, JSON.stringify(b.error), JSON.stringify(b.data).slice(0, 200));
  const c = await sb.rpc("get_collector_signals"); console.log("get_collector_signals:", c.status, JSON.stringify(c.error), JSON.stringify(c.data).slice(0, 200));
  await sb.auth.signInWithPassword({ email: m.email, password: m.password });
  const d = await sb.rpc("bulk_scan_status", { p_profile: m.personalId }); console.log("bulk_scan_status(owner):", d.status, JSON.stringify(d.error), JSON.stringify(d.data));
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(1); });
