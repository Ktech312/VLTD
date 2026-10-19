// Seeds wishlist / watchlist / favorites rows for the dis fixture (owner Personal profile, viewer user). --drop removes every row it can find for them.
const fs = require("fs"); const path = require("path");
const { admin, man } = require("./journey-lib.cjs");
const OUT = path.join(__dirname, "dis-seed2.json");
(async () => {
  const m = man(); const P = m.personalId; const B = m.businessId; const st = m.stamp;
  if (process.argv.includes("--drop")) {
    const out = {};
    for (const pid of [P, B]) {
      out["wishlist " + pid.slice(0, 6)] = (await admin.from("wishlist").delete().eq("profile_id", pid)).error?.message || "ok";
      out["watchlist " + pid.slice(0, 6)] = (await admin.from("watchlist").delete().eq("owner_profile_id", pid)).error?.message || "ok";
      out["wishlist_shares " + pid.slice(0, 6)] = (await admin.from("wishlist_shares").delete().eq("profile_id", pid)).error?.message || "ok";
    }
    for (const uid of [m.userId, m.k.userId, m.c.userId].filter(Boolean)) out["favorites " + String(uid).slice(0, 6)] = (await admin.from("public_favorites").delete().eq("user_id", uid)).error?.message || "ok";
    // vault items created by the Watchlist 'Add to Vault' test are removed by the fixture drop (they belong to the fixture profile) - recount below
    const left = {};
    left.wishlist = (await admin.from("wishlist").select("id").in("profile_id", [P, B])).data?.length;
    left.watchlist = (await admin.from("watchlist").select("item_id").in("owner_profile_id", [P, B])).data?.length;
    left.shares = (await admin.from("wishlist_shares").select("profile_id").in("profile_id", [P, B])).data?.length;
    console.log("seed2 drop", JSON.stringify(out), "recount", JSON.stringify(left));
    return;
  }
  const now = Date.now(); const iso = (d) => new Date(now - d * 3600 * 1000).toISOString();
  const wl = [
    { id: `qa_dis_w1_${st}`, profile_id: P, title: "QA dis Wish Alpha", target_price: 100, notes: "PRIVATE-NOTE-WISH-ALPHA", universe: "SPORTS", category: "Cards", subject: "Rookie", condition: "graded", priority: "medium", created_at: iso(5), source: "manual", status: "want" },
    { id: `qa_dis_w2_${st}`, profile_id: P, title: "QA dis Wish Bravo", target_price: 2500, notes: "PRIVATE-NOTE-WISH-BRAVO", universe: "TCG", priority: "high", created_at: iso(2), source: "manual", status: "want" },
    { id: `qa_dis_w3_${st}`, profile_id: P, title: "QA dis Wish Charlie", target_price: null, notes: null, universe: "MUSIC", priority: "low", created_at: iso(1), source: "manual", status: "want" },
    { id: `qa_dis_w4_${st}`, profile_id: P, title: "QA dis Comic Delta #5", target_price: null, notes: null, priority: "medium", created_at: iso(3), source: "metron", external_id: "999001", release_date: "2026-11-04", status: "preordered", image_url: null },
  ];
  const a = await admin.from("wishlist").insert(wl); if (a.error) throw new Error("wishlist: " + a.error.message);
  const wt = [
    { owner_profile_id: P, item_id: `qa_vz_${st}_1`, title: "QA Album 1 - watched", subtitle: "Public exhibition save", grade: "PSA 9", current_value: 100, image_front_url: "/collectibles/sports-slab.png", item_profile_id: P, collector_name: "QA dis Collector", saved_at: iso(30) },
    { owner_profile_id: P, item_id: `qa_vz_${st}_13`, title: "QA Album 13 - watched", subtitle: null, grade: null, current_value: 250, image_front_url: "/collectibles/movie-poster.png", item_profile_id: P, collector_name: "QA dis Collector", saved_at: iso(10) },
    { owner_profile_id: P, item_id: `qa_vz_${st}_19`, title: "QA Album 19 - watched no value", subtitle: null, grade: null, current_value: null, image_front_url: "/collectibles/guitar.png", item_profile_id: P, collector_name: null, saved_at: iso(20) },
  ];
  const b = await admin.from("watchlist").insert(wt); if (b.error) throw new Error("watchlist: " + b.error.message);
  const gal = JSON.parse(fs.readFileSync(path.join(__dirname, "dis-seed.json"), "utf8"));
  const fav = [
    { content_type: "gallery", content_id: gal.ids.A, user_id: m.k.userId, metadata: { title: gal.titles.A, itemCount: 5, profile_id: m.k.profileId }, created_at: iso(24) },
    { content_type: "item", content_id: `qa_vz_${st}_1`, user_id: m.k.userId, metadata: { title: "QA Album 1 - Original Motion Picture Soundtrack", image: "/collectibles/sports-slab.png", profile_id: m.k.profileId }, created_at: iso(48) },
  ];
  const c = await admin.from("public_favorites").insert(fav); if (c.error) throw new Error("favorites: " + c.error.message);
  fs.writeFileSync(OUT, JSON.stringify({ wishlist: wl.map((w) => w.id), stamp: st }, null, 1));
  console.log("seed2 ok");
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
