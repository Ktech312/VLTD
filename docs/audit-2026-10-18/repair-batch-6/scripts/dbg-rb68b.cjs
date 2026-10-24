const path=require("path");const SD=path.resolve("docs/audit-2026-10-18/scripts");
const T=require(path.join(SD,"audit-s-add-lib.cjs"));const {admin,man}=T;
(async()=>{const m=man();const P=m.personalId;
const a=await admin.from("vault_items").select("id,title,purchase_price,created_at").eq("profile_id",P).like("id","vault_acq_%");console.log("acq",JSON.stringify(a.data||a.error));
const b=await admin.from("vault_items").select("id,profile_id").like("id","vault_acq_%").order("created_at",{ascending:false}).limit(8);console.log("recent acq any profile",JSON.stringify(b.data||b.error));
const c=await admin.from("vault_items").select("id",{count:"exact",head:true}).eq("profile_id",P);console.log("count",c.count);
process.exit(0)})();
