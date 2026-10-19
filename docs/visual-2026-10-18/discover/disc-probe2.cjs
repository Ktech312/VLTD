const { admin } = require("./journey-lib.cjs");
(async () => {
  const names = ["Stealth","Comics (Misc. & Peach cards)","New Live","Music","Gear of Rock","Grails"];
  const g = await admin.from("galleries").select("id,title,profile_id,cover_image,layout,exhibition_layout,analytics_views").in("title", names).eq("visibility","PUBLIC");
  for (const r of g.data) {
    const L = r.layout||{}, E = r.exhibition_layout||{};
    const lid = Array.isArray(L.itemIds)?L.itemIds:[]; const eid = Array.isArray(E.itemIds)?E.itemIds:[];
    const all = [...new Set([...lid,...eid])];
    const t = (await admin.from("vault_items").select("id,current_value,purchase_price,is_public,status").in("id", all)).data ?? [];
    const v = (await admin.from("public_vault_items").select("id,current_value").in("id", all)).data ?? [];
    console.log(JSON.stringify({ title:r.title, profile:r.profile_id, layoutIds:lid.length, exIds:eid.length, union:all.length, inTable:t.length, public:t.filter(x=>x.is_public).length, inView:v.length, viewValued:v.filter(x=>Number(x.current_value)>0).length, tableValued:t.filter(x=>Number(x.current_value)>0).length, err:t.length?"":"?",statuses:[...new Set(t.map(x=>x.status))].join("|"),hasPurchaseOnly:t.filter(x=>!(Number(x.current_value)>0)&&Number(x.purchase_price)>0).length, exType:typeof r.exhibition_layout, exStrKeys:Object.keys(E).slice(0,6), shelfBg:L.shelfBackground, cover:(r.cover_image||"").slice(0,60), exSample: String(E[0]??"")+String(E[1]??"") }));
  }
})().catch(e=>{console.error(e);process.exit(1)});
