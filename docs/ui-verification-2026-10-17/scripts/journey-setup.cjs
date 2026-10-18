// One synthetic collector for the journey check: one auth user, a Personal profile (empty Vault) and a Business profile.
const { admin, MANIFEST, fs, crypto } = require("./journey-lib.cjs");
(async () => {
  if (fs.existsSync(MANIFEST)) throw new Error("qa_journey.json already exists: run journey-cleanup.cjs first");
  const stamp = Date.now().toString(36);
  const email = `vltdadmin+qa-jr-${stamp}@gmail.com`;
  const password = "Qa!" + crypto.randomBytes(9).toString("base64url");
  const cu = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cu.error) throw cu.error;
  const m = { stamp, email, password, userId: cu.data.user.id, personalId: null, businessId: null };
  fs.writeFileSync(MANIFEST, JSON.stringify(m));
  const mk = async (type, uname, display) => {
    const r = await admin.from("profiles").insert({ user_id: m.userId, username: uname, display_name: display, profile_type: type, primary_focus: "Sports", avatar_emoji: "key", onboarding_completed: true, is_public: false, avatar_url: "__preset:key" }).select("id").single();
    if (r.error) throw new Error(r.error.message);
    await admin.from("profiles").update({ tier: "FULL" }).eq("id", r.data.id);
    return r.data.id;
  };
  m.personalId = await mk("personal", "qa_jr_p_" + stamp, "QA Journey Personal");
  m.businessId = await mk("business", "qa_jr_b_" + stamp, "QA Journey Business");
  fs.writeFileSync(MANIFEST, JSON.stringify(m));
  console.log("created", { user: m.userId.slice(0, 8), personal: m.personalId.slice(0, 8), business: m.businessId.slice(0, 8), stamp });
})().catch((e) => { console.error("SETUP ERROR", e.message || e); process.exit(2); });
