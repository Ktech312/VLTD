const { admin } = require("./journey-lib.cjs");
(async()=>{ const r=await admin.from("bug_reports").select("id,created_at,message,user_id,page_path").ilike("message","%QA audit%").order("created_at",{ascending:false}).limit(10); console.log(r.error?r.error.message:JSON.stringify(r.data,null,1));
if (process.argv[2]==="--del" && r.data) { for (const x of r.data) { if (/\[QA audit\] test report/.test(x.message) && /QA dis/.test(x.message)) { const d=await admin.from("bug_reports").delete().eq("id",x.id); console.log("deleted",x.id,d.error?d.error.message:"ok"); } } }
process.exit(0)})();
