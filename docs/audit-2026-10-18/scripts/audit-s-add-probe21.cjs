// what does the signed-in QA owner's own call to bulk_scan_status / consume_bulk_scan return? (read-only status call; consume is NOT called)
const T = require("./audit-s-add-lib.cjs");
const env = require("../qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
(async () => {
  const m = T.man();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: e0 } = await sb.auth.signInWithPassword({ email: m.email, password: m.password }); if (e0) throw e0;
  for (const [label, pid] of [["Personal", m.personalId], ["Business", m.businessId]]) {
    const r = await sb.rpc("bulk_scan_status", { p_profile: pid });
    console.log(label, "->", r.error ? JSON.stringify({ code: r.error.code, message: r.error.message, hint: r.error.hint, details: r.error.details }) : JSON.stringify(r.data));
  }
  // the owner's other quota-related reads
  const q = await sb.from("bulk_scan_quotas").select("tier,monthly_limit"); console.log("bulk_scan_quotas read:", q.error ? q.error.message : JSON.stringify(q.data));
})().catch((e) => { console.error(e); process.exit(2); });
