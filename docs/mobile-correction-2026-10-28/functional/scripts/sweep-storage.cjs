// Removes any stored pictures left under a dropped synthetic user's id (exact prefix from the manifest), in the vault-images bucket.
const fs = require("fs");
const SD = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/audit-2026-10-18/scripts";
const J = require(SD + "/journey-lib.cjs");
const { admin } = J;
(async () => {
  for (const f of process.argv.slice(2)) {
    const m = JSON.parse(fs.readFileSync(f, "utf8")); const uid = m.userId; if (!uid) { console.log(f, "no userId"); continue; }
    const sweep = async (prefix) => { const l = await admin.storage.from("vault-images").list(prefix, { limit: 1000 }); const out = []; for (const e of l.data || []) { const p = prefix + "/" + e.name; if (e.id === null || !e.metadata) out.push(...(await sweep(p))); else out.push(p); } return out; };
    const objs = [...(await sweep(uid)), ...(m.personalId ? await sweep(m.personalId) : []), ...(m.businessId ? await sweep(m.businessId) : [])];
    console.log(path_(f), "objects under the user's folder:", objs.length);
    if (objs.length) { const r = await admin.storage.from("vault-images").remove(objs); console.log(" removed:", r.error ? r.error.message : objs.length); }
    const again = [...(await sweep(uid)), ...(m.personalId ? await sweep(m.personalId) : [])]; console.log(" left:", again.length);
  }
  function path_(f) { return f.split(/[\\/]/).pop(); }
  process.exit(0);
})();
