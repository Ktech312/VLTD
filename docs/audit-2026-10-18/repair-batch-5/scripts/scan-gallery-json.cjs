// READ-ONLY structure scan of galleries (key names and counts only; no content is printed or saved).
const path = require("path");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(__dirname, "..", "..", "qa", "env.cjs"));
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const keyPaths = (v, prefix, acc, depth = 0) => {
  if (Array.isArray(v)) { acc.add(prefix + "[]"); v.slice(0, 50).forEach((x) => keyPaths(x, prefix + "[]", acc, depth + 1)); return; }
  if (v && typeof v === "object") { for (const k of Object.keys(v)) { acc.add(prefix + "." + k); if (depth < 5) keyPaths(v[k], prefix + "." + k, acc, depth + 1); } }
};
(async () => {
  const rows = []; for (let from = 0; ; from += 1000) { const r = await a.from("galleries").select("*").range(from, from + 999); if (r.error) throw new Error(r.error.message); rows.push(...r.data); if (r.data.length < 1000) break; }
  const profiles = new Set((await a.from("profiles").select("id,user_id")).data.flatMap((p) => [String(p.id), String(p.user_id)]).filter(Boolean));
  const out = { galleries: rows.length, byVisibility: {}, aliasEnabled: 0, topLevelColumns: Object.keys(rows[0] || {}) };
  rows.forEach((r) => { const k = `${r.visibility}/${r.state}`; out.byVisibility[k] = (out.byVisibility[k] || 0) + 1; if (r.alias_enabled) out.aliasEnabled++; });
  const keys = { layout: new Set(), exhibition_layout: new Set(), item_notes: new Set(), analytics_unique_view_keys: new Set() };
  let hiddenSnaps = 0, hiddenWithRealTitle = 0, hiddenWithImage = 0, snaps = 0, snapsWithValue = 0, uuidInJson = 0, emailInJson = 0, profileIdInJson = 0, longStringFields = {};
  for (const r of rows) {
    for (const c of Object.keys(keys)) keyPaths(r[c], c, keys[c]);
    const sn = r.layout?.publicItemSnapshots || r.exhibition_layout?.publicItemSnapshots || [];
    for (const s of sn) { snaps++; if (typeof s.currentValue === "number") snapsWithValue++; if (s.hidden === true) { hiddenSnaps++; if (s.title && s.title !== "Hidden Item") hiddenWithRealTitle++; if (s.imageFrontUrl || s.imageBackUrl || s.imageFrontStoragePath || s.primaryImageKey) hiddenWithImage++; } }
    const blob = JSON.stringify([r.layout, r.exhibition_layout, r.item_notes]);
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(blob)) emailInJson++;
    const uu = blob.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
    if (uu.length) uuidInJson++;
    if (uu.some((x) => profiles.has(x.toLowerCase()) || profiles.has(x))) profileIdInJson++;
    if (Array.isArray(r.analytics_unique_view_keys)) out.uniqueKeysTotal = (out.uniqueKeysTotal || 0) + r.analytics_unique_view_keys.length;
  }
  Object.assign(out, { snapshots: snaps, snapshotsWithCurrentValue: snapsWithValue, hiddenSnapshots: hiddenSnaps, hiddenSnapshotsStillHoldingRealTitle: hiddenWithRealTitle, hiddenSnapshotsStillHoldingImageRefs: hiddenWithImage, galleriesWithEmailLikeTextInJson: emailInJson, galleriesWithUuidInJson: uuidInJson, galleriesWhoseJsonContainsAKnownProfileOrUserId: profileIdInJson });
  out.keyPaths = Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, [...v].sort()]));
  require("fs").writeFileSync(path.join(__dirname, "..", "evidence", "gallery-json-structure-scan.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ...out, keyPaths: Object.fromEntries(Object.entries(out.keyPaths).map(([k, v]) => [k, v.length + " paths"])) }, null, 1));
})();
