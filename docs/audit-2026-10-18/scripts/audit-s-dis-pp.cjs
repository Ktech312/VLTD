const { admin, man } = require("./journey-lib.cjs");
(async()=>{ const m=man(); const r=await admin.from("public_profiles").upsert({ profile_id: m.personalId, display_name: "QA dis Collector" }); console.log(r.error?r.error.message:"ok"); process.exit(0)})();
