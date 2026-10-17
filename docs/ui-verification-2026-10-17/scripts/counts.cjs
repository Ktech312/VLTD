// READ-ONLY row counts (service role, head-only selects). Writes nothing.
const { admin } = require("./ui-lib.cjs");
(async () => {
  const c = async (t, f) => { let q = admin.from(t).select("id", { count: "exact", head: true }); if (f) q = f(q); const r = await q; return r.error ? "err:" + r.error.message : r.count; };
  const total = { profiles: await c("profiles"), vault_items: await c("vault_items"), galleries: await c("galleries") };
  const qaProf = (await admin.from("profiles").select("id,username").like("username", "qa%")).data || [];
  const qaIds = qaProf.map((p) => p.id);
  const qaItems = qaIds.length ? (await admin.from("vault_items").select("id", { count: "exact", head: true }).in("profile_id", qaIds)).count : 0;
  const qaGal = qaIds.length ? (await admin.from("galleries").select("id", { count: "exact", head: true }).in("profile_id", qaIds)).count : 0;
  console.log("totals now:", JSON.stringify(total));
  console.log("QA profiles (username starts with qa):", qaProf.map((p) => p.username).join(", ") || "none", "| their items:", qaItems, "| their exhibitions:", qaGal);
  console.log("non-QA (real) vault_items now:", total.vault_items - qaItems, "| non-QA profiles:", total.profiles - qaProf.length, "| non-QA exhibitions:", total.galleries - qaGal);
  // newest/oldest real rows by profile owner count (no names): how many real profiles have items, biggest collections
  const real = (await admin.from("profiles").select("id,username,created_at").not("username", "like", "qa%")).data || [];
  const per = [];
  for (const p of real) { const n = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", p.id)).count; if (n) per.push(n); }
  per.sort((a, b) => b - a);
  console.log("real profiles with items:", per.length, "| item counts, largest first:", per.slice(0, 6).join(", "));
  const orphan = (await admin.from("vault_items").select("id", { count: "exact", head: true }).is("profile_id", null)).count;
  console.log("items with no profile (orphans):", orphan);
})().catch((e) => { console.error("ERR", e.message); process.exit(2); });
