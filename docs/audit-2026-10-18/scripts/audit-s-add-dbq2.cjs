const T = require("./audit-s-add-lib.cjs");
(async () => {
  for (const p of T.mine()) {
    const r = (await T.admin.from("vault_items").select("id,title,profile_id,added_via,purchase_price,current_value,created_at,universe,category_label").eq("profile_id", p).like("id", "ai_%")).data || [];
    console.log(p.slice(0, 8), "ai_ rows:", JSON.stringify(r));
    const r2 = (await T.admin.from("vault_items").select("id,title").eq("profile_id", p).like("title", "AUD ADD%")).data || [];
    console.log(p.slice(0, 8), "AUD ADD rows:", JSON.stringify(r2));
    const c = (await T.admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", p)).count; console.log("count", c);
  }
})();
