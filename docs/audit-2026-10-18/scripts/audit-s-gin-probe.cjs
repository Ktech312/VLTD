process.env.AUDIT_MANIFEST = process.env.AUDIT_MANIFEST || __dirname + "/qa_audit_gin.json";
const X = require("./audit-s-vlt-lib.cjs");
(async () => {
  const m = X.man();
  const g = await X.admin.from("collection_goals").select("*").eq("profile_id", m.personalId);
  console.log("goals P", JSON.stringify(g.data, null, 1), g.error);
  const gb = await X.admin.from("collection_goals").select("*").eq("profile_id", m.businessId);
  console.log("goals B", gb.data.length);
  const all = await X.rows(m.personalId);
  console.log("items", all.length);
  const keys = ["id","title","status","universe","category_label","subject","purchase_price","current_value","estimated_value","value_median","sold_price","is_public","image_front_url"];
  for (const r of all) console.log(keys.map((k) => String(r[k] ?? "").slice(0, 28)).join(" | "));
  const wl = await X.admin.from("wishlist_items").select("id").eq("profile_id", m.personalId).then(r=>r, e=>({error:e}));
  console.log("wishlist table", wl.error ? wl.error.message : wl.data.length);
  const bi = await X.rows(m.businessId); console.log("business items", bi.length);
  const sc = require("./schema-cols.json"); console.log(JSON.stringify(sc.collection_goals || Object.keys(sc).filter(k=>/goal|wish/.test(k))));
})().catch((e) => { console.error(e); process.exit(1); });
