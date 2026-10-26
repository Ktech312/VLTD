// Empties the tutorial's synthetic collector (exact ids from the manifest): its Vault items, their stored pictures, and anything the walkthrough created. Use between capture runs and at the end.
//   AUDIT_MANIFEST=<manifest> node reset-qa.cjs
const SD = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/audit-2026-10-18/scripts";
const J = require(SD + "/journey-lib.cjs");
const { admin } = J;
const m = J.man();
(async () => {
  const profs = [m.personalId, m.businessId].filter(Boolean);
  let removed = 0, files = 0;
  for (const p of profs) {
    const rows = (await admin.from("vault_items").select("id,images_json,image_front_url,image_front_storage_path").eq("profile_id", p)).data || [];
    for (const r of rows) {
      const urls = [r.image_front_url, ...(r.images_json || []).map((x) => x && x.url)].filter(Boolean);
      for (const u of urls) { const mm = /\/object\/public\/([^/]+)\/(.+?)(?:\?.*)?$/.exec(String(u)); if (mm) { const d = await admin.storage.from(mm[1]).remove([decodeURIComponent(mm[2])]); if (!d.error) files++; } }
      if (r.image_front_storage_path) { await admin.storage.from("vault-images").remove([r.image_front_storage_path]).catch(() => {}); }
    }
    const d = await admin.from("vault_items").delete().eq("profile_id", p); if (!d.error) removed += rows.length;
    await admin.from("profiles").update({ bulk_scans_used: 0, bulk_scan_limit_override: null }).eq("id", p);
  }
  // any stored objects still under the QA user's own folder
  const sweep = async (bucket, prefix) => { const l = await admin.storage.from(bucket).list(prefix, { limit: 1000 }); const out = []; for (const e of l.data || []) { if (e.id) out.push(`${prefix}/${e.name}`); else out.push(...(await sweep(bucket, `${prefix}/${e.name}`))); } return out; };
  let left = 0;
  for (const b of ["vault-images"]) { try { const objs = await sweep(b, m.userId); if (objs.length) { await admin.storage.from(b).remove(objs); left += objs.length; } for (const p of profs) { const o2 = await sweep(b, p); if (o2.length) { await admin.storage.from(b).remove(o2); left += o2.length; } } } catch { /* bucket layout differs */ } }
  console.log("items removed:", removed, "| stored pictures removed:", files, "| swept from QA folders:", left);
  process.exit(0);
})();
