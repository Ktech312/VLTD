// READ-ONLY exposure assessment for RC-01/02/03 on production data. Aggregates only: no titles, notes or descriptions are printed or saved. Nothing is written.
const { admin, AUD, fs } = require("./audit-lib.cjs");
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
(async () => {
  const profs = (await admin.from("profiles").select("id,user_id,username,is_public,profile_type")).data;
  const real = profs.filter((p) => !/^qa_/.test(p.username || ""));
  const realIds = new Set(real.map((p) => p.id));
  const pubProfile = new Map(real.map((p) => [p.id, !!p.is_public]));
  const byUser = new Map(); real.forEach((p) => byUser.set(p.user_id, (byUser.get(p.user_id) || 0) + 1));
  const multiProfileUsers = [...byUser.values()].filter((n) => n > 1).length;

  // ---------- RC-02: descriptions that contain their own private notes, or carry the marks of generated listing copy
  const items = []; let from = 0;
  for (;;) { const r = await admin.from("vault_items").select("id,profile_id,notes,description,is_public,purchase_price").range(from, from + 999); if (r.error) throw new Error(r.error.message); items.push(...r.data); if (r.data.length < 1000) break; from += 1000; }
  const mine = items.filter((i) => realIds.has(i.profile_id));
  const withNotes = mine.filter((i) => norm(i.notes).length >= 12);
  const withDesc = mine.filter((i) => norm(i.description).length >= 12);
  const leaks = withNotes.filter((i) => { const n = norm(i.notes), d = norm(i.description); return d && (d.includes(n) || (n.length > 40 && d.includes(n.slice(0, 40)))); });
  const markers = mine.filter((i) => /serious inquiries only|recorded cost basis|prepared for (ebay|etsy|icona|whatnot|discogs|mercari|facebook|pwcc)|listed via vltd/i.test(i.description || ""));
  const markerCost = mine.filter((i) => /recorded cost basis/i.test(i.description || ""));
  const exposed = (arr) => arr.filter((i) => i.is_public && pubProfile.get(i.profile_id));
  // generated listing text that also contains the owner's note
  const markerWithNote = markers.filter((i) => { const n = norm(i.notes); return n.length >= 12 && norm(i.description).includes(n.slice(0, Math.min(40, n.length))); });
  // ---------- RC-03: auctions
  const au = (await admin.from("vault_items").select("id,profile_id,auction_status,is_public,status").not("auction_status", "is", null)).data.filter((i) => realIds.has(i.profile_id));
  const cancelled = au.filter((i) => i.auction_status === "CANCELLED");
  // ---------- RC-01: exhibitions that are empty but show signs of having held items
  const gal = (await admin.from("galleries").select("id,profile_id,layout,exhibition_layout,visibility,state,analytics_views,item_notes,created_at,updated_at").limit(2000)).data.filter((g) => realIds.has(g.profile_id));
  const ids = (g) => { const a = new Set([...(g.layout?.itemIds || []), ...(g.exhibition_layout?.itemIds || [])]); return a.size; };
  const empty = gal.filter((g) => ids(g) === 0);
  const links = (await admin.from("gallery_items").select("gallery_id")).data || [];
  const linkCount = new Map(); links.forEach((l) => linkCount.set(l.gallery_id, (linkCount.get(l.gallery_id) || 0) + 1));
  const emptyButSnap = empty.filter((g) => (g.layout?.publicItemSnapshots || []).length > 0);
  const emptyButLinks = empty.filter((g) => (linkCount.get(g.id) || 0) > 0);
  const emptyButNotes = empty.filter((g) => Array.isArray(g.item_notes) && g.item_notes.length > 0 || (g.layout?.itemNotes || []).length > 0);
  const emptyWithViews = empty.filter((g) => (g.analytics_views || 0) > 0);
  // owners with both a Personal and a Business profile who own galleries on both
  const galByProfile = new Map(); gal.forEach((g) => galByProfile.set(g.profile_id, (galByProfile.get(g.profile_id) || 0) + 1));
  const profByUser = new Map(); real.forEach((p) => { if (!profByUser.has(p.user_id)) profByUser.set(p.user_id, []); profByUser.get(p.user_id).push(p); });
  const usersAtRisk = [...profByUser.values()].filter((arr) => arr.length > 1 && arr.some((p) => galByProfile.get(p.id))).length;

  const out = {
    generatedAt: new Date().toISOString(), note: "aggregate counts only; read-only; QA rows excluded",
    population: { realProfiles: real.length, usersWithMoreThanOneProfile: multiProfileUsers, realItems: mine.length, realGalleries: gal.length },
    rc02: { itemsWithPrivateNotes: withNotes.length, itemsWithDescription: withDesc.length, descriptionsContainingTheirOwnNote: leaks.length, ofWhichPublicOnAPublicProfile: exposed(leaks).length, descriptionsThatLookLikeGeneratedOrPastedListingCopy: markers.length, ofWhichContainRecordedCostBasisLine: markerCost.length, generatedCopyAlsoContainingTheNote: markerWithNote.length, markerCopyPublicOnAPublicProfile: exposed(markers).length },
    rc03: { itemsWithAnAuctionRecord: au.length, cancelledAuctions: cancelled.length, cancelledAndStillPublic: cancelled.filter((i) => i.is_public).length, cancelledStillPublicOnPublicProfile: exposed(cancelled).length, note: "the prior visibility is not stored, so which of these were private before the auction cannot be determined from the data" },
    rc01: { galleries: gal.length, galleriesWithZeroItems: empty.length, emptyButStillHoldingPublicSnapshots: emptyButSnap.length, emptyButStillHoldingLinkRows: emptyButLinks.length, emptyButStillHoldingItemNotes: emptyButNotes.length, emptyWithViews: emptyWithViews.length, ownersWithBothProfilesAndExhibitions: usersAtRisk, note: "an empty exhibition can be genuine (just created); leftover snapshots/links/notes are the only signs of a past wipe, and a wipe that also pruned snapshots leaves no trace" },
  };
  fs.writeFileSync(AUD + "/rc-exposure-readonly.json", JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
