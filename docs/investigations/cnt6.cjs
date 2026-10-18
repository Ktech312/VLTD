const { admin } = require("./journey-lib.cjs");
const all = async (t, cols) => { let out = []; for (let from = 0; ; from += 1000) { const r = await admin.from(t).select(cols).range(from, from + 999); if (r.error) throw new Error(t + ": " + r.error.message); out = out.concat(r.data); if (r.data.length < 1000) break; } return out; };
(async () => {
  const items = await all("vault_items", "id");
  const have = new Set(items.map((i) => String(i.id)));
  const idLike = (s) => (String(s).match(/\b(?:\d{13}_[0-9a-f]{4,8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g) || []);
  const refs = new Map(); const add = (id, src) => { if (!refs.has(id)) refs.set(id, new Set()); refs.get(id).add(src); };
  const gi = await all("gallery_items", "gallery_id,artifact_id"); for (const g of gi) add(String(g.artifact_id), "gallery_items");
  const gs = await all("galleries", "id,profile_id,title,layout,exhibition_layout,visibility");
  const gIds = new Set(gs.map((g) => g.id));
  for (const g of gs) for (const col of ["layout", "exhibition_layout"]) for (const id of idLike(JSON.stringify(g[col] || {}))) if (!gIds.has(id) && id !== g.profile_id) add(id, "galleries." + col);
  const sa = await all("sales", "item_id"); for (const s of sa) add(String(s.item_id), "sales");
  const ap = await all("appreciations", "item_id"); for (const a of ap) add(String(a.item_id), "appreciations");
  const fb = await admin.from("public_favorites_backup_20261010").select("content_type,content_id"); for (const f of fb.data || []) if (f.content_type === "item") add(String(f.content_id), "favorites_backup_20261010");
  const orphans = [...refs.keys()].filter((id) => !have.has(id) && !/^qa_/.test(id));
  console.log("distinct item ids referenced from other tables:", refs.size, "| not present in vault_items:", orphans.length);
  const profs = await all("profiles", "id");
  const pset = new Set(profs.map((p) => String(p.id)));
  const real = orphans.filter((id) => !pset.has(id));
  for (const id of real.slice(0, 40)) console.log("  ORPHAN", id, "referenced by", [...refs.get(id)].join(","));
  // storage: image folders whose item no longer exists
  const tops = await admin.storage.from("vault-images").list("", { limit: 1000 });
  console.log("storage top level:", (tops.data || []).map((x) => x.name).join(", "));
  let folders = []; for (let off = 0; ; off += 1000) { const r = await admin.storage.from("vault-images").list("items", { limit: 1000, offset: off }); if (r.error) { console.log("storage list error", r.error.message); break; } folders = folders.concat(r.data || []); if ((r.data || []).length < 1000) break; }
  const orphanFolders = folders.map((f) => f.name).filter((n) => !have.has(n));
  console.log("storage folders under items/:", folders.length, "| with no matching vault item:", orphanFolders.length, orphanFolders.slice(0, 10));
  // other prefixes holding item images (per-user folders)
  for (const t of (tops.data || [])) if (t.name !== "items") { const r = await admin.storage.from("vault-images").list(t.name, { limit: 5 }); console.log("prefix", t.name, "sample entries:", (r.data || []).length); }
})().catch((e) => { console.error(e.message); process.exit(1); });
