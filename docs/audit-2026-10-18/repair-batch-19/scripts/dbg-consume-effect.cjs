// Does consume_bulk_scan really move profiles.bulk_scans_used when a normal signed-in member calls it? (read/write on a QA profile only; no provider call)
const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const J = require(path.join(SD, "journey-lib.cjs"));
const { admin, man } = T;
const m = man(); const P = m.personalId;
(async () => {
  const c = J.createClient(J.env.NEXT_PUBLIC_SUPABASE_URL, J.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: m.email, password: m.password });
  if (error) throw error;
  const read = async () => (await admin.from("profiles").select("bulk_scans_used,bulk_scans_cycle_start,tier,bulk_scan_limit_override").eq("id", P).single()).data;
  console.log("before", JSON.stringify(await read()));
  for (let i = 0; i < 3; i++) {
    const r = await c.rpc("consume_bulk_scan", { p_profile: P, p_count: 1 });
    console.log("rpc", JSON.stringify(r.data || r.error));
  }
  console.log("after 3 consumes", JSON.stringify(await read()));
  const s = await c.rpc("bulk_scan_status", { p_profile: P });
  console.log("status", JSON.stringify(s.data || s.error));
  process.exit(0);
})();
