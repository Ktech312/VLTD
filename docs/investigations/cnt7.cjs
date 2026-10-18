const { admin } = require("./journey-lib.cjs");
const all = async (t, cols) => { let out = []; for (let from = 0; ; from += 1000) { const r = await admin.from(t).select(cols).range(from, from + 999); if (r.error) throw new Error(r.error.message); out = out.concat(r.data); if (r.data.length < 1000) break; } return out; };
(async () => {
  const items = await all("vault_items", "id,image_front_storage_path,images_json");
  const have = new Set(items.map((i) => String(i.id)));
  let folders = []; for (let off = 0; ; off += 1000) { const r = await admin.storage.from("vault-images").list("items", { limit: 1000, offset: off }); folders = folders.concat(r.data || []); if ((r.data || []).length < 1000) break; }
  const orphan = folders.map((f) => f.name).filter((n) => !have.has(n));
  const day = (n) => { const m = /^(\d{13})_/.exec(n); return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : "(non-timestamp id) " + n.slice(0, 12); };
  const hist = {}; for (const n of orphan) hist[day(n)] = (hist[day(n)] || 0) + 1;
  console.log("orphan image folders by creation day (from the id timestamp):"); console.log(JSON.stringify(hist));
  // newest orphans: inspect their files (names, size, last modified)
  const ts = (n) => { const m = /^(\d{13})_/.exec(n); return m ? Number(m[1]) : 0; };
  const newest = orphan.filter((n) => ts(n)).sort((a, b) => ts(b) - ts(a)).slice(0, 8);
  for (const n of newest) { const r = await admin.storage.from("vault-images").list("items/" + n, { limit: 20 }); console.log(n, new Date(ts(n)).toISOString().slice(0, 19) + "Z", "files:", (r.data || []).map((f) => f.name.slice(0, 22) + "(" + (f.metadata?.size ?? "?") + "B, last modified " + String(f.updated_at || f.created_at || "?").slice(0, 19) + ")").join("; ")); }
  // does any current item still point at an image folder that no longer exists, or an item without folder?
  const withStorage = items.filter((i) => /^items\//.test(String(i.image_front_storage_path || "")));
  console.log("current items whose front image is in storage:", withStorage.length, "| distinct folders matched:", new Set(withStorage.map((i) => i.image_front_storage_path.split("/")[1])).size);
  // folders that are NOT orphan: are there items with folder?
  console.log("storage folders with a matching item:", folders.length - orphan.length);
})().catch((e) => { console.error(e.message); process.exit(1); });
