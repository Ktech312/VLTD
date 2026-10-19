process.env.AUDIT_MANIFEST = __dirname + "/qa_audit_gin.json.done";
const { admin } = require("./journey-lib.cjs"); const fs = require("fs");
(async () => {
  const m = JSON.parse(fs.readFileSync(process.env.AUDIT_MANIFEST, "utf8")); const profs = [m.personalId, m.businessId, m.k.profileId, m.c.profileId];
  const c = async (q) => (await q).count;
  console.log({
    goals_by_profile: await c(admin.from("collection_goals").select("id", { count: "exact", head: true }).in("profile_id", profs)),
    goals_by_prefix: await c(admin.from("collection_goals").select("id", { count: "exact", head: true }).like("id", `qa_goal_${m.stamp}%`)),
    wishlist: await c(admin.from("wishlist").select("id", { count: "exact", head: true }).in("profile_id", profs)),
    items_by_profile: await c(admin.from("vault_items").select("id", { count: "exact", head: true }).in("profile_id", profs)),
    items_by_prefix: await c(admin.from("vault_items").select("id", { count: "exact", head: true }).like("id", `qa_%${m.stamp}%`)),
    galleries: await c(admin.from("galleries").select("id", { count: "exact", head: true }).in("profile_id", profs)),
    profiles: (await admin.from("profiles").select("id").in("id", profs)).data.length,
    users: (await Promise.all([m.userId, m.k.userId, m.c.userId].map(async (u) => (await admin.auth.admin.getUserById(u)).data?.user ? 1 : 0))).reduce((a, b) => a + b, 0),
  });
})();
