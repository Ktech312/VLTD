const { admin, man } = require("./journey-lib.cjs"); const m = man();
(async () => { const d = await admin.from("public_profiles").delete().in("profile_id", [m.personalId, m.businessId, m.k.profileId, m.c.profileId]); console.log("public_profiles delete:", d.error ? d.error.message : "ok"); process.exit(0); })();
