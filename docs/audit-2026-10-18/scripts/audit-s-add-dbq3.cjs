const T = require("./audit-s-add-lib.cjs");
(async () => {
  for (const p of T.mine()) {
    const r = (await T.admin.from("vault_items").select("id,title,created_at,images_json").eq("profile_id", p).not("id", "like", "qa_%")).data || [];
    console.log(p.slice(0, 8), "non-fixture rows:", r.length, JSON.stringify(r.map((x) => [x.id.slice(0, 18), x.title.slice(0, 30)])));
  }
})();
