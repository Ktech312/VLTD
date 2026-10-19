// Extra synthetic fixtures for the audit, on top of visual-fixture.cjs. Everything is owned by the journey manifest (cleanup: journey-cleanup.cjs).
//   m.k = an unrelated viewer (signed in, onboarding complete, own profile)
//   m.c = a user whose onboarding is NOT finished
const crypto = require("crypto");
const fs = require("fs");
const { admin, man, MANIFEST } = require("./journey-lib.cjs");
(async () => {
  const m = man(); const P = m.personalId; const st = m.stamp;
  const owned = (await admin.from("vault_items").select("id,title,image_front_url").eq("profile_id", P).eq("status", "COLLECTION").order("id")).data;
  const ids = owned.map((o) => o.id);
  // item mix: explicit value, explicit zero value, purchase-only (ghost), missing, for sale, public valued
  const up = async (id, patch) => { const r = await admin.from("vault_items").update(patch).eq("id", id); if (r.error) throw new Error(r.error.message); };
  await up(ids[0], { current_value: 120, value_source: "manual", purchase_price: 40 });
  await up(ids[1], { current_value: 0, purchase_price: 15 });                     // explicit zero value
  await up(ids[2], { current_value: null, purchase_price: 25 });                   // purchase-only
  await up(ids[3], { current_value: null, purchase_price: null });                  // missing everything
  for (const k of [4, 5, 6, 7]) await up(ids[k], { status: "FOR_SALE", asking_price: 50 + k * 10 });
  await up(ids[8], { is_public: true, current_value: 300 });
  await up(ids[9], { is_public: true, current_value: 75 });
  // one public exhibition with the room's own public snapshots, one with a share token and private
  const gs = (await admin.from("galleries").select("id,title,layout,exhibition_layout").eq("profile_id", P).order("title")).data;
  const pub = gs.find((g) => g.title === "Sports Slabs");
  const itemsOf = (g) => (g.layout?.itemIds ?? g.exhibition_layout?.itemIds ?? []);
  const inRoom = itemsOf(pub);
  const snaps = (await admin.from("vault_items").select("id,title,image_front_url").in("id", inRoom)).data.map((r) => ({ id: r.id, title: r.title, imageFrontUrl: r.image_front_url || undefined }));
  const lay = { ...(pub.layout || {}), itemIds: inRoom, publicItemSnapshots: snaps, themePack: "walnut", templateId: "CUSTOM", displayMode: "shelf" };
  const gu = await admin.from("galleries").update({ visibility: "PUBLIC", state: "ACTIVE", layout: lay, description: "synthetic QA public exhibition", analytics_views: 3 }).eq("id", pub.id);
  if (gu.error) throw new Error(gu.error.message);
  // goals
  await admin.from("collection_goals").delete().eq("profile_id", P);
  const t = new Date().toISOString();
  const gl = await admin.from("collection_goals").insert([
    { id: `qa_goal_${st}_1`, profile_id: P, name: "Complete the Spider-Man run", target_count: 12, universe: "POP_CULTURE", created_at: t },
    { id: `qa_goal_${st}_2`, profile_id: P, name: "Reach $2,000 collection value", target_count: 2000, universe: "POP_CULTURE", created_at: t },
    { id: `qa_goal_${st}_3`, profile_id: P, name: "Sell duplicate comics", target_count: 5, universe: "POP_CULTURE", created_at: t },
  ]);
  if (gl.error) throw new Error("goals: " + gl.error.message);
  // second and third synthetic users
  const mkUser = async (tag, onboarded) => {
    const email = `vltdadmin+qa-au-${tag}-${st}@gmail.com`; const password = "Qa!" + crypto.randomBytes(9).toString("base64url");
    const cu = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (cu.error) throw cu.error;
    const pr = await admin.from("profiles").insert({ user_id: cu.data.user.id, username: `qa_au_${tag}_${st}`, display_name: `QA Audit ${tag}`, profile_type: "personal", primary_focus: "Sports", avatar_emoji: "key", onboarding_completed: onboarded, is_public: false, avatar_url: "__preset:key" }).select("id").single();
    if (pr.error) throw new Error(pr.error.message);
    return { email, password, userId: cu.data.user.id, profileId: pr.data.id };
  };
  if (!m.k) m.k = await mkUser("viewer", true);
  if (!m.c) m.c = await mkUser("onboard", false);
  m.audit = { publicGalleryId: pub.id, publicToken: (await admin.from("galleries").select("public_token").eq("id", pub.id).single()).data.public_token, galleries: gs.map((g) => ({ id: g.id, title: g.title })), itemIds: ids.slice(0, 12) };
  fs.writeFileSync(MANIFEST, JSON.stringify(m));
  console.log("audit fixtures ready", { forSale: 4, publicItems: 2, publicGallery: pub.id.slice(0, 8), goals: 3, viewer: m.k.profileId.slice(0, 8), onboarding: m.c.profileId.slice(0, 8) });
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
