// Removes the QA user, profile, items, galleries and anything they made, then verifies nothing is left.
const fs = require("fs");
const env = require("../qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const MANIFEST = __dirname + "/qa_ui.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  if (!fs.existsSync(MANIFEST)) { console.log("nothing to clean"); return; }
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const P = m.profileId;
  const left = async () => {
    const out = {};
    if (P) {
      out.items = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
      out.galleries = (await admin.from("galleries").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    }
    return out;
  };
  for (let round = 0; round < 3; round++) {
    if (P) {
      await admin.from("vault_items").delete().eq("profile_id", P);
      await admin.from("galleries").delete().eq("profile_id", P);
    }
    await sleep(2500);
    const l = await left();
    if (!l.items && !l.galleries) break;
  }
  if (P) {
    for (const t of ["activity_events", "sales", "portfolio_value_history", "profile_members"]) { try { await admin.from(t).delete().eq("profile_id", P); } catch { /* table may not exist */ } }
    const del = await admin.from("profiles").delete().eq("id", P);
    if (del.error) console.log("profile delete:", del.error.message);
  }
  const du = await admin.auth.admin.deleteUser(m.userId);
  if (du.error) console.log("user delete:", du.error.message);
  await sleep(1500);
  const final = await left();
  const prof = P ? (await admin.from("profiles").select("id").eq("id", P).maybeSingle()).data : null;
  const total = (await admin.from("vault_items").select("id", { count: "exact", head: true })).count;
  console.log("after cleanup", { ...final, profileStillThere: !!prof, vault_items_total: total });
  if (!final.items && !final.galleries && !prof) fs.renameSync(MANIFEST, MANIFEST + ".done");
})().catch((e) => { console.error("CLEANUP ERROR", e.message || e); process.exit(2); });
