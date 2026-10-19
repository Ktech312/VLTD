process.env.AUDIT_MANIFEST = process.env.AUDIT_MANIFEST || __dirname + "/qa_audit_gin.json";
const L = require("./audit-s-gin-lib.cjs"); const { admin, man } = L;
(async () => {
  const m = man(); const profs = [m.personalId, m.businessId];
  for (const p of profs) { await admin.from("collection_goals").delete().eq("profile_id", p); await admin.from("wishlist").delete().eq("profile_id", p); }
  await admin.from("vault_items").delete().like("id", `qa_gin_${m.stamp}_%`);
  const cnt = async (t, col, v) => (await admin.from(t).select("id", { count: "exact", head: true }).in(col, v)).count;
  console.log("before drop:", { goals: await cnt("collection_goals", "profile_id", profs), wishlist: await cnt("wishlist", "profile_id", profs) });
})();
