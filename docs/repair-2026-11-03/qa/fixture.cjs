// node fixture.cjs create | drop | baseline   (tag biz1; manifest outside the repo)
const crypto = require("crypto");
const { admin, fs, MANIFEST, man, sleep, baseline } = require("./lib.cjs");
const mode = process.argv[2];
(async () => {
  if (mode === "baseline") { console.log(await baseline()); return; }
  if (mode === "create") {
    if (fs.existsSync(MANIFEST)) throw new Error("manifest exists");
    const stamp = Date.now().toString(36);
    const m = { stamp, users: {}, profiles: {}, items: [], galleries: [] };
    const save = () => fs.writeFileSync(MANIFEST, JSON.stringify(m));
    save();
    for (const key of ["owner", "member", "stranger"]) {
      const email = `vltdadmin+qa-biz1-${key}-${stamp}@gmail.com`;
      const password = "Qa!" + crypto.randomBytes(9).toString("base64url");
      const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (r.error) throw r.error;
      m.users[key] = { id: r.data.user.id, email, password }; save();
    }
    const mkProf = async (key, user, type, uname, display) => {
      const r = await admin.from("profiles").insert({ user_id: m.users[user].id, username: uname, display_name: display, profile_type: type, primary_focus: "Sports", avatar_emoji: "key", onboarding_completed: true, is_public: false, avatar_url: "__preset:key" }).select("id").single();
      if (r.error) throw new Error(r.error.message);
      await admin.from("profiles").update({ tier: "FULL" }).eq("id", r.data.id);
      m.profiles[key] = r.data.id; save();
    };
    await mkProf("ownerPersonal", "owner", "personal", "qa_b1_op_" + stamp, "QA Owner Personal");
    await mkProf("business", "owner", "business", "qa_b1_biz_" + stamp, "QA Biz Co");
    await mkProf("memberPersonal", "member", "personal", "qa_b1_mp_" + stamp, "QA Member Personal");
    await mkProf("strangerPersonal", "stranger", "personal", "qa_b1_sp_" + stamp, "QA Stranger Personal");
    const mkItems = async (prof, label, n) => {
      const rows = [];
      for (let i = 1; i <= n; i++) rows.push({ id: `qa_biz1_${stamp}_${label}_${i}`, profile_id: m.profiles[prof], title: `${label} ITEM ${i}`, universe: "POP_CULTURE", category: "comics", category_label: "Comics", status: "COLLECTION", is_public: false, created_at: Date.now() - i * 86400e3, purchase_price: 10 + i });
      const r = await admin.from("vault_items").insert(rows);
      if (r.error) throw new Error(r.error.message);
      m.items.push(...rows.map((x) => x.id)); save();
    };
    await mkItems("ownerPersonal", "OWNERPERSONAL", 2);
    await mkItems("business", "BIZCO", 3);
    await mkItems("memberPersonal", "MEMBERPERSONAL", 2);
    await mkItems("strangerPersonal", "STRANGER", 1);
    const gid = crypto.randomUUID();
    const ids = m.items.filter((i) => i.includes("_BIZCO_"));
    const sec = { id: "s0", title: "Exhibit 1", description: "", itemIds: ids, slotLayout: [...ids, null, null, null] };
    const g = await admin.from("galleries").insert({ id: gid, profile_id: m.profiles.business, title: "BIZCO EXHIBIT", description: "synthetic", visibility: "LOCKED", state: "ACTIVE", layout: { itemIds: ids, themePack: "classic", displayMode: "grid", sections: [sec] }, exhibition_layout: { itemIds: ids, sections: [sec] } });
    if (g.error) throw new Error(g.error.message);
    m.galleries.push(gid); save();
    const mem = await admin.from("profile_members").select("profile_id,user_id,role").in("profile_id", Object.values(m.profiles));
    console.log("created", { users: 3, profiles: 4, items: m.items.length, galleries: 1, memberRows: mem.data?.length, roles: mem.data?.map((x) => x.role) });
  } else if (mode === "drop") {
    const m = man();
    const profs = Object.values(m.profiles);
    for (const p of profs) {
      const gs = (await admin.from("galleries").select("id").eq("profile_id", p)).data || [];
      for (const g of gs) await admin.from("gallery_items").delete().eq("gallery_id", g.id);
      await admin.from("galleries").delete().eq("profile_id", p);
      await admin.from("vault_items").delete().eq("profile_id", p);
      for (const t of ["activity_events", "sales", "portfolio_value_history", "profile_members"]) { try { await admin.from(t).delete().eq("profile_id", p); } catch { /* table may not exist */ } }
      const d = await admin.from("profiles").delete().eq("id", p);
      if (d.error) console.log("profile delete:", d.error.message);
    }
    for (const u of Object.values(m.users).map((x) => x.id)) {
      await admin.from("referral_redemptions").delete().or(`referrer_id.eq.${u},referred_id.eq.${u}`);
      await admin.from("referral_codes").delete().eq("user_id", u);
      await admin.from("user_perks").delete().eq("user_id", u);
      try { const f = await admin.storage.from("vault-images").list(u, { limit: 100 }); if (f.data?.length) console.log("storage objects under", u, f.data.length); } catch { /* none */ }
      const du = await admin.auth.admin.deleteUser(u);
      if (du.error) console.log("user delete:", du.error.message);
    }
    await sleep(1500);
    const left = (await admin.from("profiles").select("id").in("id", profs)).data?.length;
    console.log("after drop", { ...(await baseline()), profilesLeft: left });
    fs.renameSync(MANIFEST, MANIFEST + ".done");
  }
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
