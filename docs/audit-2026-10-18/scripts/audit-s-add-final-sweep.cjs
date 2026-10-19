// Final sweep before dropping the fixture: remove every row in MY two profiles that is not a seeded fixture item (qa_ ids) together with its stored files; report counts.
const T = require("./audit-s-add-lib.cjs");
(async () => {
  for (const p of T.mine()) {
    const r = (await T.admin.from("vault_items").select("id,title,profile_id,images_json").eq("profile_id", p).not("id", "like", "qa_%")).data || [];
    console.log(p.slice(0, 8), "non-fixture rows to remove:", r.length, r.map((x) => x.title.slice(0, 24)).join(" ; "));
    await T.removeItems(r);
    const c = (await T.admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", p)).count; console.log(p.slice(0, 8), "rows now:", c);
  }
  // storage folders under items/ created during this audit window that have no row any more (report only)
  const top = (await T.admin.storage.from("vault-images").list("items", { limit: 1000, sortBy: { column: "created_at", name: "desc" } })).data || [];
  const recent = top.filter((x) => /^\d{13}_/.test(x.name) && Number(x.name.slice(0, 13)) > 1792380000000);
  const ids = recent.map((x) => x.name);
  const have = new Set(((await T.admin.from("vault_items").select("id").in("id", ids)).data || []).map((x) => x.id));
  const orphans = recent.filter((x) => !have.has(x.name));
  console.log("items/ folders created in the audit window:", recent.length, "| without a vault row:", orphans.length);
  // which of them belong to MY runs? my files were uploaded by sessions of the fixture user: check the owner via file metadata is not available; list names only
  console.log("orphan folder names:", orphans.map((x) => x.name).slice(0, 40).join(", "));
})();
