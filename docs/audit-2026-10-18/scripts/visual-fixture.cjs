// Synthetic Vault for the visual work: 26 owned items with photos (some valued, some at cost), 6 sales across three months incl. one loss and one with no cost,
// 5 exhibitions with covers. Everything under the journey account's Personal profile (journey-setup.cjs first). Removed by journey-cleanup.cjs.
//   node visual-fixture.cjs [--reset]
const crypto = require("crypto");
const { admin, man } = require("./journey-lib.cjs");
(async () => {
  const m = man(); const P = m.personalId; const st = m.stamp;
  await admin.from("vault_items").delete().eq("profile_id", P);
  for (const g of (await admin.from("galleries").select("id").eq("profile_id", P)).data || []) { await admin.from("gallery_items").delete().eq("gallery_id", g.id); }
  await admin.from("galleries").delete().eq("profile_id", P);
  const img = (n) => ({ image_front_url: `/collectibles/${n}.png`, image_front_storage_path: `/collectibles/${n}.png`, images_json: [{ id: `/collectibles/${n}.png#0`, storageKey: `/collectibles/${n}.png`, url: `/collectibles/${n}.png`, order: 0, localOnly: false, role: "primary", isPrivateStorage: false }] });
  const photos = ["comic-slab", "sports-slab", "vinyl-record", "movie-poster", "guitar"];
  const U = [["POP_CULTURE", "comics", "Comics"], ["SPORTS", "SPORTS_CARDS", "Sports Cards"], ["MUSIC", "AUDIO_FORMATS", "Audio Formats"], ["POP_CULTURE", "MOVIES_TV_FILM", "Movies / TV / Film"], ["MUSIC", "INSTRUMENTS_GEAR", "Instruments & Gear"], ["TCG", "TCG", "Trading Card Games"]];
  const now = Date.now(); const day = 86400e3;
  const rows = [];
  for (let i = 1; i <= 26; i++) {
    const u = U[i % U.length];
    rows.push({ id: `qa_vz_${st}_${i}`, profile_id: P, title: `QA Album ${i} - Original Motion Picture Soundtrack`, universe: u[0], category: u[1], category_label: u[2], status: "COLLECTION", is_public: false, created_at: now - i * 3 * day - (i % 5) * 3600e3, purchase_price: 6 + (i * 7) % 40, ...(i % 3 === 0 ? { current_value: 20 + i * 3 } : {}), ...img(photos[i % photos.length]) });
  }
  // sold: April (profit), May (profit), this month (one loss, one no cost)
  const sold = [
    { n: "QA Sold Spider-Man 300", at: new Date(2026, 3, 12).getTime(), price: 680, cost: 35, plat: "eBay" },
    { n: "QA Sold Batman 1988", at: new Date(2026, 3, 22).getTime(), price: 160, cost: 20, plat: "eBay" },
    { n: "QA Sold Rookie Card", at: new Date(2026, 4, 9).getTime(), price: 420, cost: 60, plat: "Whatnot" },
    { n: "QA Sold Poster", at: new Date().getTime() - 2 * day, price: 40, cost: 90, plat: "In person" },
    { n: "QA Sold Unknown Cost", at: new Date().getTime() - 3 * day, price: 55, cost: null, plat: "In person" },
  ];
  sold.forEach((s, k) => rows.push({ id: `qa_vz_${st}_s${k}`, profile_id: P, title: s.n, universe: "POP_CULTURE", category: "comics", category_label: "Comics", status: "SOLD", is_public: false, created_at: s.at - 30 * day, sold_price: s.price, sold_at: s.at, sold_platform: s.plat, ...(s.cost === null ? {} : { purchase_price: s.cost }), ...img(photos[k % photos.length]) }));
  for (let i = 0; i < rows.length; i += 200) { const r = await admin.from("vault_items").insert(rows.slice(i, i + 200)); if (r.error) throw new Error(r.error.message); }
  const owned = rows.filter((r) => r.status === "COLLECTION").map((r) => r.id);
  const covers = ["comic-slab", "sports-slab", "vinyl-record", "movie-poster", "guitar"];
  const gal = covers.map((c, i) => { const ids = owned.slice(i * 5, i * 5 + 5 + i); const sec = { id: "s" + i, title: "Exhibit 1", description: "", itemIds: ids, slotLayout: [...ids, ...Array(Math.max(0, 6 - ids.length)).fill(null)] }; return { id: crypto.randomUUID(), profile_id: P, title: ["Comics (Misc. & Peach cards)", "Sports Slabs", "Vinyl Wall", "Movie Posters", "Guitars"][i], description: "synthetic", visibility: "LOCKED", state: "ACTIVE", cover_image: `/collectibles/${c}.png`, layout: { itemIds: ids, themePack: "classic", displayMode: "grid", guestViewMode: "public", sections: [sec] }, exhibition_layout: { itemIds: ids, sections: [sec] }, public_token: `qavz${st}${i}`, alias_enabled: false }; });
  const g = await admin.from("galleries").insert(gal); if (g.error) throw new Error(g.error.message);
  await admin.from("gallery_items").insert(gal.flatMap((x) => x.layout.itemIds.map((id, k) => ({ gallery_id: x.id, position: k + 1, artifact_id: id }))));
  await admin.from("profiles").update({ display_name: "QA Visual Collection" }).eq("id", P);
  console.log("fixture ready:", { owned: owned.length, sold: sold.length, galleries: gal.length });
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
