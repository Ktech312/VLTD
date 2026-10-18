const {admin,man}=require("./journey-lib.cjs");(async()=>{const m=man();const d=(n)=>new Date(Date.now()-n*86400e3).toISOString().slice(0,10);
await admin.from("portfolio_value_history").delete().eq("profile_id",m.personalId);
const r=await admin.from("portfolio_value_history").insert([{profile_id:m.personalId,day:d(6),total_value:1127.23,total_cost:1127.23,by_universe:{}},{profile_id:m.personalId,day:d(3),total_value:1127.23,total_cost:1127.23,by_universe:{}}]);console.log("history",r.error?r.error.message:"ok");})()
