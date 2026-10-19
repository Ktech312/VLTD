// Extra Vault rows for the VLT audit (YOUR fixture's Personal profile only). node audit-s-vlt-seed.cjs [--remove]
const V = require("./audit-s-vlt-lib.cjs");
const { admin, man } = V;
(async () => {
  const m = man(); const P = m.personalId; const st = m.stamp; const day = 86400e3; const now = Date.now();
  const id = (k) => `qa_vlt_${st}_${k}`;
  const ids = ["zebra", "paint", "zerov", "novalue", "supply", "wish", "uncat", "soldz", "psa", "quote", "complete", "novcost", "ghostfee", "del1", "mv1", "mvb1"].map(id);
  await admin.from("vault_items").delete().in("id", ids);
  if (process.argv.includes("--remove")) { console.log("removed", ids.length); return; }
  const base = { profile_id: P, status: "COLLECTION", is_public: false };
  const rows = [
    { ...base, id: id("zebra"), title: "QA VLT Zebra Comic", subtitle: "Variant cover", number: "#42", universe: "POP_CULTURE", category: "comics", category_label: "Comics", grade: "CGC 9.8", notes: "needle42 searchable note", storage_location: "Shelf Q", purchase_source: "Zebra Mart", created_at: now - 60 * day, purchase_price: 10, current_value: 50 },
    { ...base, id: id("paint"), title: "QA VLT Quartz Painting", universe: "ART", category: "Paintings", category_label: "Paintings", created_at: now - 61 * day, purchase_price: 200, current_value: 450 },
    { ...base, id: id("zerov"), title: "QA VLT Explicit Zero Value", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", created_at: now - 62 * day, purchase_price: 30, current_value: 0 },
    { ...base, id: id("novalue"), title: "QA VLT No Value No Cost", universe: "MUSIC", category: "AUDIO_FORMATS", category_label: "Audio Formats", created_at: now - 63 * day },
    { ...base, id: id("supply"), title: "QA VLT Storage Box Supply", universe: "MISC", category: "Supplies & Display", category_label: "Supplies & Display", created_at: now - 64 * day, purchase_price: 12 },
    { ...base, id: id("wish"), title: "QA VLT Wishlist Item", status: "WISHLIST", universe: "TCG", category: "TCG", category_label: "Trading Card Games", created_at: now - 65 * day },
    { ...base, id: id("soldz"), title: "QA VLT Sold Zebra Print", status: "SOLD", universe: "ART", category: "Prints", category_label: "Prints", created_at: now - 90 * day, purchase_price: 20, sold_price: 80, sold_at: now - 5 * day, sold_platform: "eBay" },
    { ...base, id: id("psa"), title: "QA VLT PSA Rookie", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", grade: "PSA 10", cert_number: "CERT-VLT-777", created_at: now - 66 * day, purchase_price: 100, current_value: 400 },
    { ...base, id: id("quote"), title: `QA VLT O'Brien "Quote" (50%) [x] \\ Item`, universe: "GAMES", category: "Video Games", category_label: "Video Games", created_at: now - 67 * day, purchase_price: 5, current_value: 9 },
    { ...base, id: id("complete"), title: "QA VLT Complete Record", number: "#7", universe: "TCG", category: "TCG", category_label: "Trading Card Games", created_at: now - 68 * day, purchase_price: 25, current_value: 90, image_front_url: "/collectibles/guitar.png", image_front_storage_path: "/collectibles/guitar.png", images_json: [{ id: "/collectibles/guitar.png#0", storageKey: "/collectibles/guitar.png", url: "/collectibles/guitar.png", order: 0, localOnly: false, role: "primary", isPrivateStorage: false }] },
    { ...base, id: id("novcost"), title: "QA VLT Value Without Cost", universe: "MUSIC", category: "AUDIO_FORMATS", category_label: "Audio Formats", created_at: now - 69 * day, current_value: 5000 },
    { ...base, id: id("ghostfee"), title: "QA VLT Ghost With Fees", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", created_at: now - 70 * day, purchase_price: 50, purchase_tax: 5, purchase_shipping: 5, purchase_fees: 0 },
    { ...base, id: id("del1"), title: "QA VLT Throwaway Delete", universe: "POP_CULTURE", category: "comics", category_label: "Comics", created_at: now - 71 * day, purchase_price: 1 },
    { ...base, id: id("mv1"), title: "QA VLT Throwaway Move", universe: "POP_CULTURE", category: "comics", category_label: "Comics", created_at: now - 72 * day, purchase_price: 1 },
    { ...base, id: id("mvb1"), title: "QA VLT Throwaway ToBusiness", universe: "POP_CULTURE", category: "comics", category_label: "Comics", created_at: now - 73 * day, purchase_price: 1 },
  ];
  const r = await admin.from("vault_items").insert(rows);
  if (r.error) throw new Error(r.error.message);
  console.log("seeded", rows.length, "rows for", st);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
