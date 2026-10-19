const { admin, man } = require("./journey-lib.cjs"); const m = man();
(async () => {
  const v = await admin.from("vault_items").select("id,title,status,created_at,universe").eq("profile_id", m.personalId).ilike("title", "%QA Dis%");
  console.log(JSON.stringify(v.data));
  if (process.argv[2] === "--del" && v.data.length) { const d = await admin.from("vault_items").delete().in("id", v.data.map((x) => x.id)); console.log("deleted", d.error?.message || "ok"); }
  process.exit(0);
})();
