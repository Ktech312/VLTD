const T = require("./audit-s-add-lib.cjs");
(async () => {
  for (const p of T.mine()) {
    const r = (await T.admin.from("vault_items").select("id,title,profile_id,images_json").eq("profile_id", p).eq("title", "Untitled Item").not("id", "like", "qa_%")).data || [];
    await T.removeItems(r); console.log("removed Untitled Item rows:", r.length);
  }
})();
