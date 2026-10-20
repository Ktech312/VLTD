// Synthetic Insurance fixture on top of the standard one: every case the documents must get right.
const { admin, man } = require("./audit-lib.cjs");
(async () => {
  const m = man(); const st = m.stamp; const P = m.personalId;
  const base = (id, extra) => ({ id: `qa_ins_${st}_${id}`, profile_id: P, universe: "POP_CULTURE", category: "comics", category_label: "Comics", status: "COLLECTION", is_public: false, created_at: Date.now(), ...extra });
  await admin.from("vault_items").delete().like("id", `qa_ins_${st}_%`);
  const rows = [
    base("allin", { title: "QA INS cost with tax shipping fees", purchase_price: 100, purchase_tax: 8, purchase_shipping: 5, purchase_fees: 2, current_value: 150 }),
    base("zerocost", { title: "QA INS explicit zero cost", purchase_price: 0, current_value: 25 }),
    base("unknowncost", { title: "QA INS unknown cost", current_value: 60 }),
    base("noestimate", { title: "QA INS no estimate cost 40", purchase_price: 40 }),
    base("zerovalue", { title: "QA INS explicit zero value", purchase_price: 10, current_value: 0 }),
    base("supply", { title: "QA INS storage box (supply)", universe: "MISC", category: "Supplies & Display", category_label: "Supplies & Display", purchase_price: 12 }),
    base("wish", { title: "QA INS wishlist item", status: "WISHLIST", purchase_price: 5 }),
  ];
  const r = await admin.from("vault_items").insert(rows);
  if (r.error) throw new Error(r.error.message);
  const all = (await admin.from("vault_items").select("id,status,universe,category_label,purchase_price,purchase_tax,purchase_shipping,purchase_fees,current_value").eq("profile_id", P)).data;
  const sold = all.filter((x) => x.status === "SOLD").length;
  console.log("fixture ready: items", all.length, "| sold", sold, "| added", rows.length);
})().catch((e) => { console.error(e); process.exit(1); });
