// Data-layer probe with real user JWTs (what the browser would be allowed to read). node probe.cjs
const { man, userClient } = require("./lib.cjs");
const short = (x) => JSON.stringify(x).slice(0, 220);
(async () => {
  const m = man();
  const B = m.profiles.business;
  for (const who of ["owner", "member", "stranger"]) {
    const { sb } = await userClient(m.users[who].email, m.users[who].password);
    console.log("=== " + who);
    const pr = await sb.from("profiles").select("id,display_name,user_id").eq("id", B);
    console.log("profiles by id (business):", pr.error ? "ERR " + pr.error.message : pr.data.length + " row(s)");
    const own = await sb.from("profiles").select("id").eq("user_id", m.users[who].id);
    console.log("profiles where user_id=me:", own.data?.length);
    const it = await sb.from("vault_items").select("id,title").eq("profile_id", B);
    console.log("business items:", it.error ? "ERR " + it.error.message : it.data.length);
    const gl = await sb.from("galleries").select("id,title").eq("profile_id", B);
    console.log("business galleries:", gl.error ? "ERR " + gl.error.message : gl.data.length);
    const pm = await sb.from("profile_members").select("user_id,role").eq("profile_id", B);
    console.log("profile_members rows (business):", pm.error ? "ERR " + pm.error.message : pm.data.length);
    const mine = await sb.from("profile_members").select("profile_id,role").eq("user_id", m.users[who].id);
    console.log("my memberships:", mine.error ? "ERR " + mine.error.message : short(mine.data.map((r) => r.profile_id.slice(0, 6) + ":" + r.role)));
    const lm = await sb.rpc("list_profile_members", { p_profile: B });
    console.log("rpc list_profile_members:", lm.error ? "ERR " + lm.error.message : lm.data.length);
  }
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
