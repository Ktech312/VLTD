// Read-only look at what the clean RB68 run left in the QA account (wsh3).
const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { admin, man } = T;
(async () => {
  const m = man(); const P = m.personalId;
  const w = await admin.from("wishlist").select("id,title,status,rule_id,source_identity,edition,quantity,quantity_acquired,acquired_item_ids,created_at").eq("profile_id", P);
  console.log("wishlist", JSON.stringify(w.data || w.error, null, 1));
  const r = await admin.from("pull_rules").select("id,name,state,source,source_key,created_at").eq("profile_id", P);
  console.log("rules", JSON.stringify(r.data || r.error, null, 1));
  const v = await admin.from("vault_items").select("id,title,purchase_price,created_at").eq("profile_id", P);
  console.log("vault", JSON.stringify(v.data || v.error, null, 1));
  const v2 = await admin.from("vault_items").select("id").like("id", "vault_acq_qa_retry%");
  console.log("vault any profile", JSON.stringify(v2.data || v2.error));
  process.exit(0);
})();
