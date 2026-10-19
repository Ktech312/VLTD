// Seeds the Discover fixtures for the `dis` audit fixture (galleries owned by the fixture owner's Personal profile), writes dis-seed.json.
//   node audit-s-dis-seed.cjs          -> seed
//   node audit-s-dis-seed.cjs --drop   -> remove the seeded galleries
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { admin, man } = require("./journey-lib.cjs");
const OUT = path.join(__dirname, "dis-seed.json");
(async () => {
  const m = man(); const P = m.personalId; const st = m.stamp;
  if (process.argv.includes("--drop")) {
    const s = JSON.parse(fs.readFileSync(OUT, "utf8"));
    const d = await admin.from("galleries").delete().in("id", Object.values(s.ids));
    console.log("seed galleries removed", d.error ? d.error.message : "ok");
    await admin.from("public_profiles").delete().eq("profile_id", P);
    const left = await admin.from("galleries").select("id").in("id", Object.values(s.ids));
    console.log("recount", left.data.length);
    return;
  }
  const id = (n) => `qa_vz_${st}_${n}`;
  const uuid = () => crypto.randomUUID();
  const G = { A: uuid(), B: uuid(), C: uuid(), D: uuid(), E: uuid(), F: uuid() };
  const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const setItems = async (nums, patch) => { const r = await admin.from("vault_items").update(patch).in("id", nums.map(id)); if (r.error) throw new Error(r.error.message); };
  const PURCHASE = 7777.77;
  // every seeded item: private first, purchase price a recognisable number, no explicit value
  await setItems([1, 2, 3, 4, 5, 7, 8, 9, 10, 13, 19, 20, 21, 22, 23, 24], { is_public: false, current_value: null, purchase_price: PURCHASE, notes: "QA private note ZEBRA-SECRET" });
  await setItems([1], { is_public: true, current_value: 100 });
  await setItems([13], { is_public: true, current_value: 250 });
  await setItems([19], { is_public: true, current_value: null });
  await setItems([20], { is_public: true, current_value: 10 });
  await setItems([21], { is_public: true, current_value: 20 });
  await setItems([22], { is_public: true, current_value: 30 });
  await setItems([23], { is_public: true, current_value: 0 });
  await setItems([24], { is_public: true, current_value: null });
  await admin.from("profiles").update({ is_public: true }).eq("id", P);
  await admin.from("public_profiles").upsert({ profile_id: P, display_name: "QA dis Collector" });
  const snap = (n) => ({ id: id(n), title: `QA disc piece ${n}`, imageFrontUrl: "/universe-thumbnails/music.png" });
  const mk = (gid, title, desc, nums, o) => ({
    id: gid, profile_id: P, title, description: desc, visibility: o.visibility || "PUBLIC", state: "ACTIVE", cover_image: o.cover === undefined ? "/universe-thumbnails/sports.png" : o.cover,
    analytics_views: o.views, created_at: o.created,
    layout: { itemIds: nums.map(id), themePack: o.themePack, shelfBackground: o.bg ?? "", templateId: "CUSTOM", displayMode: "shelf", publicItemSnapshots: (o.snaps || []).map(snap) },
    exhibition_layout: { type: "GRID", itemIds: nums.map(id) },
  });
  const rows = [
    mk(G.A, `QA dis Alpha Sports Room ${st}`, "zebra marker unicorn synthetic exhibition", [1, 13, 19, 3, 4, 5], { themePack: "classic", bg: "/themes/marble-bg.png", views: 9000003, created: ago(0), snaps: [4, 5] }),
    mk(G.B, `QA dis Bravo Midnight Room ${st}`, "synthetic QA exhibition", [7, 8, 9, 10], { themePack: "midnight", views: 9000002, created: ago(2), snaps: [7, 8, 9, 10] }),
    mk(G.C, `QA dis Charlie Walnut Room ${st}`, "synthetic QA exhibition", [20, 21, 22], { themePack: "walnut", views: 9000001, created: ago(10) }),
    mk(G.D, `QA dis Delta Zero Value ${st}`, "synthetic QA exhibition", [23, 24], { themePack: "classic", views: 9000000, created: ago(20), cover: null }),
    mk(G.E, `QA dis Echo Empty Room ${st}`, "synthetic QA exhibition", [], { themePack: "classic", views: 8999999, created: ago(30) }),
    mk(G.F, `QA dis Foxtrot Private ${st}`, "synthetic QA exhibition", [1, 13], { themePack: "classic", views: 9500000, created: ago(1), visibility: "LOCKED" }),
  ];
  const ins = await admin.from("galleries").insert(rows);
  if (ins.error) throw new Error("gallery insert: " + ins.error.message);
  fs.writeFileSync(OUT, JSON.stringify({ ids: G, stamp: st, purchase: PURCHASE, titles: Object.fromEntries(rows.map((r, i) => [Object.keys(G)[i], r.title])), views: Object.fromEntries(rows.map((r, i) => [Object.keys(G)[i], r.analytics_views])) }, null, 1));
  console.log("seeded", Object.values(G).map((x) => x.slice(0, 8)));
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
