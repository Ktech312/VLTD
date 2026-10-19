const { createClient, env, man, admin } = require("./journey-lib.cjs");
(async () => {
  const m = man();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: e0 } = await sb.auth.signInWithPassword({ email: m.email, password: m.password }); if (e0) throw e0;
  const before = (await admin.from("watchlist").select("item_id").eq("owner_profile_id", m.personalId)).data.length;
  const del = await sb.from("watchlist").delete({ count: "exact" }).eq("owner_profile_id", m.personalId).eq("item_id", `qa_vz_${m.stamp}_19`);
  const after = (await admin.from("watchlist").select("item_id").eq("owner_profile_id", m.personalId)).data.length;
  console.log("watchlist delete as owner:", JSON.stringify({ error: del.error?.message, count: del.count, status: del.status, before, after }));
  const w = await sb.from("wishlist").delete({ count: "exact" }).eq("profile_id", m.personalId).eq("id", `qa_dis_w2_${m.stamp}`);
  console.log("wishlist delete as owner:", JSON.stringify({ error: w.error?.message, count: w.count, status: w.status }));
  const rows = await sb.from("watchlist").select("item_id").eq("owner_profile_id", m.personalId);
  console.log("owner can read own rows:", rows.data?.length, rows.error?.message);
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(1); });
