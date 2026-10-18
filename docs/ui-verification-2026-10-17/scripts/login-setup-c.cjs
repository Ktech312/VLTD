// Third synthetic account (C) whose onboarding is unfinished. Recorded in the journey manifest.
const { admin, MANIFEST, fs, crypto } = require("./journey-lib.cjs");
(async () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); if (m.c) { console.log("C exists"); return; }
  const email = `vltdadmin+qa-jr-c-${m.stamp}@gmail.com`, password = "Qa!" + crypto.randomBytes(9).toString("base64url");
  const cu = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (cu.error) throw cu.error;
  m.c = { userId: cu.data.user.id, email, password }; fs.writeFileSync(MANIFEST, JSON.stringify(m));
  const r = await admin.from("profiles").insert({ user_id: m.c.userId, username: "qa_jr_c_" + m.stamp, display_name: "QA Journey C", profile_type: "personal", primary_focus: "Sports", avatar_emoji: "key", onboarding_completed: false, is_public: false, avatar_url: "__preset:key" }).select("id").single();
  if (r.error) throw new Error(r.error.message); m.c.profileId = r.data.id; fs.writeFileSync(MANIFEST, JSON.stringify(m)); console.log("created C", m.c.userId.slice(0, 8));
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
