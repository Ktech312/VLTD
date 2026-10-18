// READ-ONLY reconciliation by item id: current vault_items vs every table that holds item ids.
const fs = require("fs");
const { admin } = require("./journey-lib.cjs");
async function all(table, cols, filter) {
  const out = []; for (let from = 0; ; from += 1000) { let q = admin.from(table).select(cols).range(from, from + 999); if (filter) q = filter(q); const { data, error } = await q; if (error) throw new Error(table + ": " + error.message); out.push(...data); if (data.length < 1000) break; }
  return out;
}
(async () => {
  const cur = await all("vault_items", "id,profile_id,item_code,created_at,title,status,purchase_price,current_value");
  const curIds = new Set(cur.map((x) => x.id));
  const profs = await all("profiles", "id,account_code,display_name,created_at");
  const pName = Object.fromEntries(profs.map((p) => [p.id, (p.account_code || "") + " " + p.display_name]));
  console.log("current vault_items:", cur.length);
  const byProf = {}; for (const x of cur) byProf[x.profile_id] = (byProf[x.profile_id] || 0) + 1;
  const big = Object.entries(byProf).filter(([, n]) => n > 100).map(([p, n]) => [pName[p], p, n]); console.log("collections >100:", JSON.stringify(big));
  const KELL = big.find((b) => /260312-0001/.test(b[0]))[1]; const EKP = big.find((b) => /260310-0001/.test(b[0]))[1];
  const result = { kell: KELL, ek: EKP, tables: {} };

  // 1. the 2026-10-08 value backup
  const bk = await all("vault_value_backup_20261008", "id,profile_id,purchase_price,old_current_value,saved_at");
  const bkIds = new Set(bk.map((x) => x.id));
  const missingFromBackup = bk.filter((x) => !curIds.has(x.id));
  const bkByProf = {}; for (const x of bk) bkByProf[x.profile_id] = (bkByProf[x.profile_id] || 0) + 1;
  console.log("\nvalue backup 2026-10-08: rows", bk.length, "saved_at range", bk.map((x) => x.saved_at).sort()[0], "to", bk.map((x) => x.saved_at).sort().slice(-1)[0]);
  console.log("backup rows per big profile:", JSON.stringify(big.map(([n, p]) => [n, bkByProf[p] || 0])));
  console.log("backup ids NOT in current vault_items:", missingFromBackup.length);
  result.backupMissing = missingFromBackup.map((x) => ({ id: x.id, profile: pName[x.profile_id], purchase_price: x.purchase_price, old_current_value: x.old_current_value }));
  // current items not in backup, by profile (added after 10-08 or not part of backup scope)
  const notInBackup = cur.filter((x) => !bkIds.has(x.id));
  const nibByProf = {}; for (const x of notInBackup) nibByProf[x.profile_id] = (nibByProf[x.profile_id] || 0) + 1;
  console.log("current items not in backup, per big profile:", JSON.stringify(big.map(([n, p]) => [n, nibByProf[p] || 0])));

  // 2. references to item ids in other tables
  const refs = [
    ["sales", "item_id"], ["appreciations", "item_id"], ["gallery_items", "artifact_id"], ["museum_room_items", "vault_item_id"], ["watchlist", "item_id"],
    ["public_favorites_backup_20261010", null],
  ];
  for (const [t, col] of refs) {
    if (!col) { const c = await admin.from(t).select("*").limit(1); console.log("\n" + t, "columns:", c.data && c.data[0] ? Object.keys(c.data[0]).join(",") : "(empty)"); continue; }
    const rows = await all(t, "*"); const ids = rows.map((r) => r[col]).filter(Boolean);
    const dangling = rows.filter((r) => r[col] && !curIds.has(String(r[col])));
    console.log("\n" + t + ":", rows.length, "rows,", ids.length, "with an item id,", dangling.length, "dangling");
    result.tables[t] = dangling.map((r) => ({ [col]: r[col], title: r.title, created_at: r.created_at || r.saved_at || r.added_at, profile: pName[r.profile_id] || pName[r.owner_profile_id] }));
    if (dangling.length) console.log(JSON.stringify(result.tables[t].slice(0, 20)));
  }
  // 3. galleries' own item lists (layout JSON)
  const gal = await all("galleries", "id,profile_id,title,layout,exhibition_layout,created_at,updated_at");
  let galRefs = 0; const galDangling = [];
  for (const g of gal) {
    const ids = new Set();
    for (const L of [g.layout, g.exhibition_layout]) { if (!L) continue; (L.itemIds || []).forEach((i) => i && ids.add(String(i))); (L.sections || []).forEach((s) => { (s.itemIds || []).forEach((i) => i && ids.add(String(i))); (s.slotLayout || []).forEach((i) => i && ids.add(String(i))); }); }
    for (const i of ids) { galRefs++; if (!curIds.has(i)) galDangling.push({ gallery: g.title, profile: pName[g.profile_id], id: i, gallery_updated_at: g.updated_at }); }
  }
  console.log("\ngalleries:", gal.length, "item references", galRefs, "dangling", galDangling.length);
  if (galDangling.length) console.log(JSON.stringify(galDangling.slice(0, 20)));
  result.galleryDangling = galDangling;
  // 4. the eight absent eBay ids
  const eight = ["1791239191253_c8d06e", "1791239191294_8512f0", "1791239191519_c8ad74", "1791239191554_01d5b6", "1791239191559_deefe3", "1791239191686_d49872", "1791239194569_e66d78", "1791239194651_e1e294"];
  console.log("\nthe eight absent eBay ids in the 10-08 backup:", eight.filter((i) => bkIds.has(i)).length, "of 8");
  result.eightInBackup = eight.filter((i) => bkIds.has(i));
  fs.writeFileSync(__dirname + "/recon1.json", JSON.stringify(result, null, 1));
})().catch((e) => { console.error("ERR", e.message); process.exit(2); });
