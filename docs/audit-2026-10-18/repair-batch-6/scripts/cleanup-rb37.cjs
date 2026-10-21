const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { admin } = A; const m = A.man(); const P = m.personalId;
(async () => {
  const a = await admin.from("vault_items").delete().eq("profile_id", P).like("id", "rb37_%");
  const b = await admin.from("gallery_invites").delete().like("token", "qarb37%");
  const convs = (await admin.from("conversations").select("id").or(`profile_a_id.eq.${P},profile_b_id.eq.${P}`)).data || [];
  for (const c of convs) { await admin.from("direct_messages").delete().eq("conversation_id", c.id); await admin.from("conversations").delete().eq("id", c.id); }
  await admin.from("public_profiles").delete().eq("profile_id", m.k.profileId);
  console.log("cleanup", JSON.stringify({ items: a.error && a.error.message, invites: b.error && b.error.message, conversations: convs.length }));
  process.exit(0);
})();
