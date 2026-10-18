const fs = require("fs"); const { admin } = require("./journey-lib.cjs");
const all = async (t, cols) => { let out = []; for (let from = 0; ; from += 1000) { const r = await admin.from(t).select(cols).range(from, from + 999); if (r.error) throw new Error(r.error.message); out = out.concat(r.data); if (r.data.length < 1000) break; } return out; };
const idTs = (id) => { const m = /^(\d{13})_/.exec(id); return m ? Number(m[1]) : null; };
const iso = (ms) => ms ? new Date(ms).toISOString().slice(0, 19) + "Z" : "-";
(async () => {
  const missing = JSON.parse(fs.readFileSync("cnt3.json", "utf8"))["eBay"].missing;
  const items = await all("vault_items", "id,profile_id,item_code,created_at");
  const profs = await all("profiles", "id,account_code,next_item_seq");
  const K = profs.find((p) => p.account_code === "260312-0001");
  const kItems = items.filter((i) => String(i.profile_id) === String(K.id)).map((i) => ({ id: i.id, n: Number(/-(\d{6})$/.exec(i.item_code)[1]), ts: idTs(i.id), created: Number(i.created_at) })).sort((a, b) => a.n - b.n);
  // neighbours in number order whose id timestamp brackets each missing id
  const withTs = kItems.filter((i) => i.ts);
  console.log("Kellogg collection items", kItems.length, "with timestamped ids", withTs.length);
  for (const m of missing) {
    const ts = idTs(m.id);
    const before = withTs.filter((i) => i.ts < ts).sort((a, b) => b.ts - a.ts)[0];
    const after = withTs.filter((i) => i.ts > ts).sort((a, b) => a.ts - b.ts)[0];
    console.log(m.id, iso(ts), "| prev item number", before && before.n, "(" + (before && iso(before.ts)) + ") | next item number", after && after.n, "(" + (after && iso(after.ts)) + ") | gap between:", before && after ? (after.n - before.n - 1) : "?");
  }
  // value history of the two big collections, last 14 snapshots
  const E = profs.find((p) => p.account_code === "260310-0001");
  for (const [name, p] of [["Kellogg 260312-0001", K], ["EK 260310-0001", E]]) {
    const h = await admin.from("portfolio_value_history").select("day,total_value,total_cost,updated_at").eq("profile_id", p.id).order("day", { ascending: false }).limit(14);
    console.log("\nvalue history", name, "(day, total_cost, total_value, updated_at):");
    for (const r of (h.data || []).reverse()) console.log("  ", r.day, r.total_cost, r.total_value, r.updated_at.slice(0, 19));
  }
  // any reference to the missing ids elsewhere (galleries JSON, gallery_items, sales, appreciations)
  const ids = missing.map((m) => m.id);
  const gi = await admin.from("gallery_items").select("gallery_id,artifact_id").in("artifact_id", ids);
  const gs = await all("galleries", "id,profile_id,layout,exhibition_layout,updated_at");
  const refG = gs.filter((g) => ids.some((id) => JSON.stringify(g.layout).includes(id) || JSON.stringify(g.exhibition_layout).includes(id)));
  const sa = await admin.from("sales").select("id,item_id").in("item_id", ids);
  const ap = await admin.from("appreciations").select("id,item_id").in("item_id", ids);
  console.log("\nreferences to the 8 missing ids: gallery_items", (gi.data || []).length, "| galleries whose layout lists them", refG.length, "| sales", (sa.data || []).length, "| appreciations", (ap.data || []).length);
})().catch((e) => { console.error(e.message); process.exit(1); });
