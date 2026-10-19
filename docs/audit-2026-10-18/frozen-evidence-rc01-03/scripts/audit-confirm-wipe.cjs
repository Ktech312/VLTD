// Independent confirmation of EXH-433: does opening a Personal exhibition while the Business profile is active remove its items?
const { session, R, sleep, admin, man } = require("./audit-lib.cjs");
const r = R("CRW");
(async () => {
  const m = man();
  const g = (await admin.from("galleries").select("id,title,layout,exhibition_layout").eq("profile_id", m.personalId).eq("title", "Vinyl Wall").single()).data;
  const count = async () => {
    const x = (await admin.from("galleries").select("layout,exhibition_layout,updated_at").eq("id", g.id).single()).data;
    const links = (await admin.from("gallery_items").select("artifact_id", { count: "exact", head: true }).eq("gallery_id", g.id)).count;
    return { layoutIds: (x.layout?.itemIds || []).length, exIds: (x.exhibition_layout?.itemIds || []).length, links, updated: x.updated_at };
  };
  const before = await count();
  // control: open it on the matching (Personal) profile, then wait
  const P = await session("owner"); await P.visit(`/museum/${g.id}`); await sleep(8000);
  const control = await count(); await P.jshot("crw-wipe-control-personal"); await P.close();
  // test: Business profile active
  const B = await session("business"); await B.visit(`/museum/${g.id}`); await sleep(10000);
  const t = await B.evaluate("document.body.innerText.replace(/\\s+/g,' ').slice(0,200)"); const shot = await B.jshot("crw-wipe-business-profile");
  await sleep(6000);
  const after = await count(); await B.close();
  console.log(JSON.stringify({ before, control, after, t }));
  r.check(after.layoutIds === before.layoutIds && after.links === before.links, { page: "/museum/<Personal exhibition id> | owner with the BUSINESS profile active", control: "opening another profile's exhibition (independent confirmation of EXH-433)", expected: "opening an exhibition that belongs to the other profile changes nothing (shows not-found or asks to switch profile)", actual: `DB before: layout ids ${before.layoutIds}, links ${before.links}; after opening on Personal: ${control.layoutIds}/${control.links}; after opening with Business active: ${after.layoutIds}/${after.links}. Page text: ${t.slice(0, 120)}`, evidence: shot, impact: "privacy/data loss", repro: "Sign in as a user with Personal and Business profiles, switch to Business, open /museum/<id of a Personal exhibition>, wait 15 s, check its items." });
  // restore the exhibition if the test emptied it (QA-owned)
  if (after.layoutIds !== before.layoutIds) { await admin.from("galleries").update({ layout: g.layout, exhibition_layout: g.exhibition_layout }).eq("id", g.id); console.log("restored layout from the saved copy"); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
