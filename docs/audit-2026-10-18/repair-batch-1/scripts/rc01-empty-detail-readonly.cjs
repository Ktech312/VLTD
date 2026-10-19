// READ-ONLY follow-up for RC-01: do any of the 3 empty production exhibitions look like past wipes? Aggregates and yes/no flags only; no titles or content.
const { admin, AUD, fs } = require("./audit-lib.cjs");
(async () => {
  const profs = (await admin.from("profiles").select("id,user_id,username,profile_type")).data.filter((p) => !/^qa_/.test(p.username || ""));
  const byUser = new Map(); profs.forEach((p) => { if (!byUser.has(p.user_id)) byUser.set(p.user_id, []); byUser.get(p.user_id).push(p); });
  const owner = new Map(profs.map((p) => [p.id, p]));
  const gal = (await admin.from("galleries").select("id,profile_id,layout,exhibition_layout,visibility,state,cover_image,analytics_views,created_at,updated_at").limit(2000)).data.filter((g) => owner.has(g.profile_id));
  const n = (g) => new Set([...(g.layout?.itemIds || []), ...(g.exhibition_layout?.itemIds || [])]).size;
  const empty = gal.filter((g) => n(g) === 0);
  const rows = empty.map((g) => {
    const p = owner.get(g.profile_id); const sibs = byUser.get(p.user_id) || [];
    const sections = g.exhibition_layout?.sections || g.layout?.sections || [];
    const sectionIds = Array.isArray(sections) ? sections.reduce((a, s) => a + ((s && s.itemIds) || []).length, 0) : 0;
    const gapMin = Math.round((Date.parse(g.updated_at) - Date.parse(g.created_at)) / 60000);
    return { ownerHasOtherProfile: sibs.length > 1, ownerProfileType: p.profile_type, visibility: g.visibility, hasCover: !!g.cover_image, hasUploadedBackground: !!g.layout?.shelfBackground, itemIdsInSections: sectionIds, minutesBetweenCreateAndLastUpdate: gap(gapMin), views: g.analytics_views || 0, ageDays: Math.round((Date.now() - Date.parse(g.created_at)) / 86400000) };
  });
  function gap(m) { return m; }
  const multi = gal.filter((g) => (byUser.get(owner.get(g.profile_id).user_id) || []).length > 1);
  const out = { note: "read-only; no titles/content", emptyExhibitions: rows, exhibitionsOwnedByUsersWithTwoProfiles: multi.length, ofWhichEmpty: multi.filter((g) => n(g) === 0).length };
  fs.writeFileSync(AUD + "/rc01-empty-detail-readonly.json", JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
