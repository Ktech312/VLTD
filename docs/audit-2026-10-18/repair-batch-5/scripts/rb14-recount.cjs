// Leftover check and baseline recount after the batch-4 fixture was dropped (read-only).
const path = require("path");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(__dirname, "..", "..", "qa", "env.cjs"));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const cnt = async (t, f) => { let q = admin.from(t).select("*", { count: "exact", head: true }); if (f) q = f(q); const r = await q; return r.error ? "err:" + r.error.message : r.count; };
(async () => {
  await new Promise((r) => setTimeout(r, 20000));
  const out = {
    vault_items: await cnt("vault_items"),
    profiles: await cnt("profiles"),
    exhibitions: await cnt("galleries"),
    sales: await cnt("sales"),
    items_titled_QA_RB9: await cnt("vault_items", (q) => q.like("title", "QA RB9%")),
    items_titled_QA_RB10_11: await cnt("vault_items", (q) => q.or("title.like.QA RB10%,title.like.QA RB11%")),
    galleries_titled_QA_RB12_13: await cnt("galleries", (q) => q.or("title.like.QA RB12%,title.like.QA RB13%")),
    events_left: await cnt("exhibition_events"),
    public_profile_rows_named_QA_Real: await cnt("public_profiles", (q) => q.like("display_name", "QA Real%")),
    items_with_qa_vz_id: await cnt("vault_items", (q) => q.like("id", "qa_vz_%")),
    exhibitions_titled_QA: await cnt("galleries", (q) => q.like("title", "QA %")),
    qa_sales_ledger_rows: await cnt("sales", (q) => q.like("id", "qa_sale_%")),
    profiles_named_QA: await cnt("profiles", (q) => q.ilike("display_name", "%qa%")),
  };
  let users = 0; for (let p = 1; p < 10; p++) { const r = await admin.auth.admin.listUsers({ page: p, perPage: 200 }); const l = r.data?.users || []; users += l.filter((u) => /qa-jr|vltdadmin\+qa/.test(u.email || "")).length; if (l.length < 200) break; }
  out.qa_auth_users = users;
  console.log(JSON.stringify(out, null, 1));
})();
