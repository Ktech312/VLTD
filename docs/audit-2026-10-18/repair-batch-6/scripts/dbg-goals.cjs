const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session, admin } = A; const m = A.man(); const P = m.personalId;
(async () => {
  const id = "rb31_a_" + m.stamp;
  await admin.from("collection_goals").delete().eq("id", id);
  const ins = await admin.from("collection_goals").insert({ id, profile_id: P, name: "RB31 Alpha", target_count: 400, universe: "POP_CULTURE", created_at: new Date().toISOString() });
  console.log("insert", JSON.stringify(ins.error), JSON.stringify((await admin.from("collection_goals").select("id,name").eq("profile_id", P)).data));
  const S = await session("owner", { width: 1440, height: 900 });
  await S.visit("/goals"); await sleep(12000);
  const t = (await S.text()).replace(/\s+/g, " "); console.log(t.slice(0, 1200));
  await S.close(); await admin.from("collection_goals").delete().eq("id", id); process.exit(0);
})();
