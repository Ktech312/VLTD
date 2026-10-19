const { env, man } = require("./journey-lib.cjs"); const m = man();
(async () => {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/public_vault_items?select=*&id=eq.qa_vz_${m.stamp}_14`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: "Bearer " + env.NEXT_PUBLIC_SUPABASE_ANON_KEY } });
  const j = await res.json(); const row = j[0] || {};
  console.log(Object.keys(row).join(","));
  console.log("asking_price" in row, row.asking_price, row.current_value, row.status);
  process.exit(0);
})();
