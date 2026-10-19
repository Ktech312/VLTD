const { admin, man } = require("./journey-lib.cjs");
(async()=>{ const m=man(); const P=m.personalId;
const it=(await admin.from("vault_items").select("id,title,universe,status,is_public,current_value,purchase_price,image_front_url").eq("profile_id",P).order("id")).data;
console.log(it.length, it.slice(0,14).map(x=>[x.id,x.title,x.universe,x.status,x.is_public,x.current_value,x.purchase_price,(x.image_front_url||"").slice(0,50)].join("|")).join("\n"));
const gs=(await admin.from("galleries").select("id,title,visibility,state,layout").eq("profile_id",P)).data; console.log(gs.map(g=>[g.id,g.title,g.visibility,g.state,JSON.stringify(g.layout).slice(0,200)].join("|")).join("\n"));
const pp=(await admin.from("profiles").select("id,display_name,username,is_public").eq("id",P)).data; console.log(pp);
const t=await admin.from("galleries").select("*").limit(1); console.log(Object.keys(t.data[0]));
process.exit(0)})();
