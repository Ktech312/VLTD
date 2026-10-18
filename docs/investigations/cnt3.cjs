const fs = require("fs"); const { admin } = require("./journey-lib.cjs");
const all = async (t, cols) => { let out = []; for (let from = 0; ; from += 1000) { const r = await admin.from(t).select(cols).range(from, from + 999); if (r.error) throw new Error(r.error.message); out = out.concat(r.data); if (r.data.length < 1000) break; } return out; };
(async () => {
  const items = await all("vault_items", "id,profile_id,item_code,title,created_at,updated_at,status");
  const byId = new Map(items.map((i) => [i.id, i]));
  const profs = await all("profiles", "id,account_code,display_name");
  const acct = (pid) => (profs.find((p) => String(p.id) === String(pid)) || {}).account_code;
  const P = "C:/Users/EK/Pictures/";
  const out = {};
  for (const [name, d, f] of [["Celebrity Authentics", "VLTD-CelebrityAuthentics-Images", "ca-import-manifest.json"], ["Whatnot", "VLTD-Whatnot-Images", "whatnot-import-manifest.json"], ["eBay", "VLTD-eBay-Images", "ebay-import-manifest.json"]]) {
    const j = JSON.parse(fs.readFileSync(P + d + "/" + f, "utf8"));
    const ids = [...new Set(j.map((e) => e.vltdItemId))];
    const missing = ids.filter((id) => !byId.has(id));
    const present = ids.length - missing.length;
    const where = {}; for (const id of ids) { const it = byId.get(id); if (it) { const a = acct(it.profile_id); where[a] = (where[a] || 0) + 1; } }
    console.log(`\n${name}: manifest entries ${j.length}, distinct item ids ${ids.length}, present now ${present}, MISSING ${missing.length}; present by collection: ${JSON.stringify(where)}`);
    out[name] = { ids: ids.length, missing: missing.map((id) => { const e = j.find((x) => x.vltdItemId === id); return { id, title: e.title, order: e.whatnotOrder || e.order }; }) };
    for (const m of out[name].missing) console.log("   MISSING id", m.id, "| order", m.order, "|", String(m.title).slice(0, 90));
  }
  // are manifests the only things? items by source collection counts
  fs.writeFileSync("cnt3.json", JSON.stringify(out));
})().catch((e) => { console.error(e.message); process.exit(1); });
