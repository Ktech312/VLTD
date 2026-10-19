const { admin } = require("./journey-lib.cjs");
(async () => {
  const g = await admin.from("galleries").select("id,title,profile_id,layout,exhibition_layout,cover_image").eq("visibility","PUBLIC").eq("state","ACTIVE").limit(100);
  const tally = {};
  for (const r of g.data) {
    const L = r.layout||{};
    const k = `${L.themePack??"-"}|bg:${L.shelfBackground? "yes":"no"}|tpl:${L.templateId??"-"}|disp:${L.displayMode??"-"}`;
    tally[k]=(tally[k]||0)+1;
    if (["Comics (Misc. & Peach cards)","Music","Grails","New Live"].includes(r.title)) console.log(r.title, "snaps:", (L.publicItemSnapshots||[]).length, "hiddenSnaps:", (L.publicItemSnapshots||[]).filter(s=>s.hidden).length, "snapWithValue:", (L.publicItemSnapshots||[]).filter(s=>s.currentValue!=null).length, "pack", L.themePack, "tpl", L.templateId, "shelf", (L.shelfBackground||"").slice(-40), "overlay", L.glassShelfOverlay, L.shelfOverlayStyle);
  }
  console.log(tally);
})();
