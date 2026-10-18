// READ-ONLY. Run in the browser console on https://vltd.app while signed in as the account that owns the Kellogg collection.
// It reads this browser's own saved copy of the Vault (the key "vltd_vault_items_v1"), changes NOTHING (no sign-in, no sync, no save),
// prints how many items the copy holds per collection, and downloads one small JSON file with ONLY: item id, item code, profile id,
// created time, status and title. No photos, notes, prices, links or account details are read or saved.
// Why: the cloud lost two items between 2026-10-15 and 2026-10-17. If this browser's copy still has them, their ids settle which two.
(async () => {
  const raw = localStorage.getItem("vltd_vault_items_v1");
  if (!raw) { console.log("No saved copy of the Vault in this browser (key missing)."); return; }
  let json = raw;
  if (raw.startsWith("z64:")) {
    const bin = atob(raw.slice(4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    json = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"))).text();
  }
  let data = JSON.parse(json);
  // The copy is either one list of items, or a map of profile id -> list of items.
  const rows = [];
  const push = (it, pid) => rows.push({ id: String(it.id), itemCode: it.itemCode || it.item_code || null, profileId: String(it.profile_id || it.profileId || pid || ""), createdAt: it.createdAt || it.created_at || null, status: it.status || null, title: it.title || null });
  if (Array.isArray(data)) data.forEach((it) => push(it));
  else if (data && typeof data === "object") for (const [pid, list] of Object.entries(data)) if (Array.isArray(list)) list.forEach((it) => push(it, pid));
  const by = {};
  for (const r of rows) by[r.profileId || "(none)"] = (by[r.profileId || "(none)"] || 0) + 1;
  console.log("Items in this browser's saved copy:", rows.length, "| per collection (profile id: count):", by);
  const blob = new Blob([JSON.stringify({ takenAt: new Date().toISOString(), site: location.origin, count: rows.length, items: rows })], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vltd-local-copy-ids-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  console.log("Downloaded", a.download, "- it only holds ids, codes, times, status and titles.");
})();
