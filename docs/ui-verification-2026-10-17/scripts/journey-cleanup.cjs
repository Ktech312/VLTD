// Removes the journey's synthetic account by the exact ids in its manifest, then verifies nothing is left.
const { admin, MANIFEST, fs, sleep } = require("./journey-lib.cjs");
(async () => {
  if (!fs.existsSync(MANIFEST)) { console.log("nothing to clean"); return; }
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const profs = [m.personalId, m.businessId].filter(Boolean);
  const left = async () => {
    const o = { items: 0, galleries: 0 };
    for (const p of profs) {
      o.items += (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", p)).count || 0;
      o.galleries += (await admin.from("galleries").select("id", { count: "exact", head: true }).eq("profile_id", p)).count || 0;
    }
    return o;
  };
  for (let round = 0; round < 3; round++) {
    for (const p of profs) {
      const gs = (await admin.from("galleries").select("id").eq("profile_id", p)).data || [];
      for (const g of gs) await admin.from("gallery_items").delete().eq("gallery_id", g.id);
      await admin.from("vault_items").delete().eq("profile_id", p);
      await admin.from("galleries").delete().eq("profile_id", p);
    }
    await sleep(2500);
    const l = await left(); if (!l.items && !l.galleries) break;
  }
  for (const p of profs) {
    for (const t of ["activity_events", "sales", "portfolio_value_history", "profile_members"]) { try { await admin.from(t).delete().eq("profile_id", p); } catch { /* may not exist */ } }
    const d = await admin.from("profiles").delete().eq("id", p); if (d.error) console.log("profile delete:", d.error.message);
  }
  // storage the journey may have uploaded (a photo-less run leaves none; checked anyway, by the exact user folder)
  try { const f = await admin.storage.from("vault-images").list(m.userId, { limit: 100 }); if (f.data?.length) console.log("storage objects under the user folder:", f.data.length); } catch { /* none */ }
  // referral rows made by the referral checks, by the exact synthetic user ids only
  const users = [m.userId, m.k?.userId].filter(Boolean);
  for (const u of users) {
    await admin.from("referral_redemptions").delete().or(`referrer_id.eq.${u},referred_id.eq.${u}`);
    await admin.from("referral_codes").delete().eq("user_id", u);
    await admin.from("user_perks").delete().eq("user_id", u);
  }
  if (m.k?.profileId) { const d = await admin.from("profiles").delete().eq("id", m.k.profileId); if (d.error) console.log("K profile delete:", d.error.message); }
  for (const u of users) { const du = await admin.auth.admin.deleteUser(u); if (du.error) console.log("user delete:", du.error.message); }
  const refLeft = (await admin.from("referral_codes").select("id", { count: "exact", head: true }).in("user_id", users)).count;
  console.log("referral rows left for these users:", refLeft);
  await sleep(1500);
  const final = await left();
  const stillProfiles = (await admin.from("profiles").select("id").in("id", profs)).data?.length || 0;
  let stillUser = 0; for (const u of users) if ((await admin.auth.admin.getUserById(u)).data?.user) stillUser++;
  const total = (await admin.from("vault_items").select("id", { count: "exact", head: true })).count;
  console.log("after cleanup", { ...final, profilesLeft: stillProfiles, authUserLeft: stillUser, vault_items_total: total });
  if (!final.items && !final.galleries && !stillProfiles && !stillUser) fs.renameSync(MANIFEST, MANIFEST + ".done");
})().catch((e) => { console.error("CLEANUP ERROR", e.message || e); process.exit(2); });
