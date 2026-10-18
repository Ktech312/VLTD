// Second synthetic account (K) for the cross-account referral checks. Recorded in the journey manifest so journey-cleanup removes it.
const { admin, MANIFEST, fs, crypto } = require("./journey-lib.cjs");
(async () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  if (m.k) { console.log("K exists already"); return; }
  const stamp = m.stamp;
  const email = `vltdadmin+qa-jr-k-${stamp}@gmail.com`; const password = "Qa!" + crypto.randomBytes(9).toString("base64url");
  const cu = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (cu.error) throw cu.error;
  m.k = { userId: cu.data.user.id, email, password }; fs.writeFileSync(MANIFEST, JSON.stringify(m));
  const r = await admin.from("profiles").insert({ user_id: m.k.userId, username: "qa_jr_k_" + stamp, display_name: "QA Journey K", profile_type: "personal", primary_focus: "Sports", avatar_emoji: "key", onboarding_completed: true, is_public: false, avatar_url: "__preset:key" }).select("id").single();
  if (r.error) throw new Error(r.error.message);
  m.k.profileId = r.data.id; fs.writeFileSync(MANIFEST, JSON.stringify(m));
  console.log("created K", m.k.userId.slice(0, 8));
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
