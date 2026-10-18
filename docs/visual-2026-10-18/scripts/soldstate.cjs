// sets the synthetic Sold rows: node soldstate.cjs <n|0|all>
const { admin, man } = require("./journey-lib.cjs");
(async () => { const m = man(); const P = m.personalId; const n = process.argv[2];
  const rows = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("status", "SOLD").order("created_at")).data;
  if (n === "all") { console.log("restoring needs visual-fixture"); return; }
  const keep = Number(n); const del = rows.slice(keep).map((r) => r.id);
  if (del.length) await admin.from("vault_items").delete().in("id", del);
  console.log("sold rows kept:", Math.min(keep, rows.length));
})();
