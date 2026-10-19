// enrich a few QA items for the insurance suites (own fixture only); --undo removes the extras
const L = require("./audit-s-gin-lib.cjs"); const { admin, man } = L;
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp;
  const E = `qa_vz_${st}_1`, SUP = `qa_gin_${st}_supply`;
  if (process.argv.includes("--undo")) { await admin.from("vault_items").delete().eq("id", SUP); console.log("supply removed"); return; }
  let r = await admin.from("vault_items").update({ grade: "PSA 9", cert_number: "CERT-1234", serial_number: "SN-77", storage_location: "Safe A / Shelf 2", value_source: "eBay comps", value_updated_at: 1760000000000, value_confidence: 85, notes: "Line1\nLine2 with <b>markup</b>", subtitle: "Rookie 1/1" }).eq("id", E);
  console.log("enrich", r.error ? r.error.message : "ok");
  if (r.error) { r = await admin.from("vault_items").update({ grade: "PSA 9", cert_number: "CERT-1234", serial_number: "SN-77", storage_location: "Safe A / Shelf 2", value_source: "eBay comps", value_confidence: 85, notes: "Line1\nLine2 with <b>markup</b>", subtitle: "Rookie 1/1" }).eq("id", E); console.log("enrich2", r.error ? r.error.message : "ok"); }
  r = await admin.from("vault_items").insert({ id: SUP, profile_id: P, title: "QA Supply Box", universe: "MISC", category: "MISC", category_label: "Supplies & Display", status: "COLLECTION", purchase_price: 12, is_public: false, created_at: Date.now() });
  console.log("supply", r.error ? r.error.message : "ok");
  const g = await admin.from("vault_items").select("id,title,grade,cert_number,value_updated_at,value_confidence").eq("id", E); console.log(JSON.stringify(g.data));
})();
