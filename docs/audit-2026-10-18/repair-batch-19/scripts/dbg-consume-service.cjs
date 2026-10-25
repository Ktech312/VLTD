// Same function, called by the trusted server (service role) on a QA profile: does the counter move? (no provider call)
const path = require("path");
const T = require(path.join(__dirname, "..", "..", "scripts", "audit-s-add-lib.cjs"));
const { admin, man } = T;
const P = man().personalId;
(async () => {
  const read = async () => (await admin.from("profiles").select("bulk_scans_used,bulk_scans_cycle_start").eq("id", P).single()).data;
  console.log("before", JSON.stringify(await read()));
  for (let i = 0; i < 2; i++) console.log("service consume", JSON.stringify((await admin.rpc("consume_bulk_scan", { p_profile: P, p_count: 1 })).data));
  console.log("after", JSON.stringify(await read()));
  const m = await admin.from("profile_members").select("profile_id,user_id,role").eq("profile_id", P);
  console.log("members", JSON.stringify(m.data || m.error));
  await admin.from("profiles").update({ bulk_scans_used: 0 }).eq("id", P);
  console.log("reset to", JSON.stringify(await read()));
  process.exit(0);
})();
