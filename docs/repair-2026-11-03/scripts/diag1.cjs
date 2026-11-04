const L = require("./shr-lib.cjs");
const { admin, man } = L;
const env = require("../../audit-2026-10-18/qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
(async () => {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const m = man();
  const g = (await admin.from("galleries").select("id,public_token,visibility,state,layout").eq("profile_id", m.personalId)).data[0];
  const ask = async (label) => { const r = await anon.rpc("get_gallery_by_share_token", { p_token: g.public_token }); console.log(label.padEnd(28), r.error ? "ERR " + r.error.message : (r.data || []).length + " row(s)"); };
  console.log("layout.guestViewMode:", g.layout && g.layout.guestViewMode);
  for (const [v, s] of [["PUBLIC", "ACTIVE"], ["INVITE", "ACTIVE"], ["LOCKED", "ACTIVE"], ["PUBLIC", "STORAGE"], ["INVITE", "STORAGE"]]) {
    await admin.from("galleries").update({ visibility: v, state: s }).eq("id", g.id);
    await ask(`${v}/${s}`);
  }
  await admin.from("galleries").update({ visibility: g.visibility, state: g.state }).eq("id", g.id);
})();
