const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
(async () => {
  const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const r = await a.from("public_vault_items").select("*").limit(1);
  console.log(r.error ? JSON.stringify(r.error) : Object.keys((r.data && r.data[0]) || {}).join(","));
  const r2 = await a.from("public_vault_items").select("id,asking_price").limit(1);
  console.log("asking_price select:", r2.error ? JSON.stringify(r2.error) : "ok");
  process.exit(0);
})();
