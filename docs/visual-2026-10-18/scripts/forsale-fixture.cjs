// Adds synthetic FOR_SALE items to the journey account's Personal profile (after visual-fixture.cjs). Exact ids, removed by journey-cleanup (profile delete).
//   node forsale-fixture.cjs [1|3|0]   number of for-sale items (default 3; 0 removes them)
const { admin, man } = require("./journey-lib.cjs");
(async () => {
  const m = man(); const P = m.personalId; const st = m.stamp; const n = Number(process.argv[2] ?? 3);
  await admin.from("vault_items").delete().eq("profile_id", P).like("id", `qa_fs_${st}_%`);
  const img = (f) => ({ image_front_url: `/collectibles/${f}.png`, image_front_storage_path: `/collectibles/${f}.png`, images_json: [{ id: `/collectibles/${f}.png#0`, storageKey: `/collectibles/${f}.png`, url: `/collectibles/${f}.png`, order: 0, localOnly: false, role: "primary", isPrivateStorage: false }] });
  const rows = [
    { t: "QA Michael Jackson Thriller LP", universe: "MUSIC", category: "AUDIO_FORMATS", category_label: "Audio Formats", f: "vinyl-record", price: 25, ask: null, grade: null, notes: null },
    { t: "QA Rookie Card PSA 9", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", f: "sports-slab", price: 60, ask: 140, grade: "PSA 9", notes: "Clean slab, centered." },
    { t: "QA Batman Comic CGC 9.4", universe: "POP_CULTURE", category: "comics", category_label: "Comics", f: "comic-slab", price: 35, ask: 220, grade: "CGC 9.4", notes: "White pages." },
  ].slice(0, n).map((r, i) => ({ id: `qa_fs_${st}_${i + 1}`, profile_id: P, title: r.t, universe: r.universe, category: r.category, category_label: r.category_label, status: "FOR_SALE", is_public: false, created_at: Date.now() - i * 3600e3, purchase_price: r.price, asking_price: r.ask, grade: r.grade, notes: r.notes, ...img(r.f) }));
  if (rows.length) { const r = await admin.from("vault_items").insert(rows); if (r.error) throw new Error(r.error.message); }
  console.log("for-sale items:", rows.length);
})().catch((e) => { console.error("ERR", e.message); process.exit(2); });
