// Exhibition privacy by access mode: what the visitor's browser RECEIVES (the link lookup response) as well as what the page shows.
// Private, Public, Guest View, Registered Users, Storage (draft), hidden items, aliases, stale saved layouts, revoked (regenerated) links, and the owner opening their own private link.
// The link lookup is a SIMULATION of supabase/migrations/20261018 in sim-supabase.cjs; the real database function is covered by the owner's validation SQL, not by this file.
const L = require("./lib.cjs"); const { sleep, NL, check, sim, seed, P } = L; const O = "33333333-3333-4333-8333-333333333333";
const norm = (t) => t.split(NL).join(" ").replace(/\s+/g, " ");
const now = new Date().toISOString(); const snap = (id, title, extra = {}) => ({ id, title, imageFrontUrl: "/collectibles/guitar.png", categoryLabel: "Cards", createdAt: 1790000000000, ...extra });
const gal = (id, token, over = {}) => ({ id, profile_id: O, title: "EXH " + id.slice(-2), visibility: "PUBLIC", state: "ACTIVE", public_token: token, alias_enabled: false, alias_name: "", analytics_unique_view_keys: ["VIEWER-KEY-SECRET"], created_at: now, updated_at: now,
  layout: { itemIds: ["pv1", "hid1"], publicItemSnapshots: [snap("pv1", "Visible Guitar PV1"), { id: "hid1", title: "Hidden Item", hidden: true, createdAt: 1790000000001 }] }, exhibition_layout: { itemIds: ["pv1", "hid1"], publicItemSnapshots: [snap("pv1", "Visible Guitar PV1"), { id: "hid1", title: "Hidden Item", hidden: true, createdAt: 1790000000001 }] }, ...over });
const G = { priv: "00000000-0000-4000-8000-000000000a01", pub: "00000000-0000-4000-8000-000000000a02", alias: "00000000-0000-4000-8000-000000000a03", guest: "00000000-0000-4000-8000-000000000a04", reg: "00000000-0000-4000-8000-000000000a05", storage: "00000000-0000-4000-8000-000000000a06", stale: "00000000-0000-4000-8000-000000000a07", mine: "00000000-0000-4000-8000-000000000a08" };
async function visit(opts, token) {
  const s = await L.open({ width: 1280, height: 1400, ...opts }); const ids = []; s.c.on((m) => { if (m.method === "Network.responseReceived" && /get_gallery_by_share_token/.test(m.params.response.url)) ids.push(m.params.requestId); });
  await s.go("/museum/share/" + token, 11000); await s.dismiss(); const text = norm(await s.text()); const bodies = []; for (const id of ids) { try { bodies.push((await s.send("Network.getResponseBody", { requestId: id })).body); } catch {} }
  await s.close(); return { text, got: bodies.join(" ") };
}
(async () => {
  await sim("/__sim/reset");
  await seed({ profiles: [...(await L.dump("profiles")), { id: O, user_id: "44444444-4444-4444-8444-444444444444", display_name: "Real Owner Name", username: "real_owner", profile_type: "personal", onboarding_completed: true, is_public: true, tier: "FULL", avatar_emoji: "key", created_at: "2026-01-01T00:00:00Z" }],
    public_profiles: [{ profile_id: O, display_name: "Real Owner Name", username: "real_owner" }],
    vault_items: [{ id: "pv1", profile_id: O, title: "Visible Guitar PV1", universe: "MUSIC", category: "Cards", status: "COLLECTION", is_public: true, created_at: 1790000000000, image_front_url: "/collectibles/guitar.png" }, { id: "hid1", profile_id: O, title: "SECRET hidden item title", universe: "MUSIC", category: "Cards", status: "COLLECTION", is_public: true, created_at: 1790000000001, image_front_url: "/collectibles/vinyl-record.png" }, { id: "gone1", profile_id: O, title: "Removed from layout item", universe: "MUSIC", category: "Cards", status: "COLLECTION", is_public: true, created_at: 1790000000002, image_front_url: "/collectibles/vinyl-record.png" }],
    galleries: [gal(G.priv, "pub_priv", { visibility: "LOCKED" }), gal(G.pub, "pub_pub"), gal(G.alias, "pub_alias", { alias_enabled: true, alias_name: "Mystery Curator" }), gal(G.guest, "pub_guest", { visibility: "INVITE" }), gal(G.reg, "pub_reg", { guest_view_mode: "guest", layout: { ...gal("x", "x").layout, guestViewMode: "guest" } }), gal(G.storage, "pub_store", { state: "STORAGE" }),
      gal(G.stale, "pub_stale", { layout: { itemIds: ["pv1"], publicItemSnapshots: [snap("pv1", "Visible Guitar PV1"), snap("gone1", "Removed from layout item")] }, exhibition_layout: { itemIds: ["pv1"], publicItemSnapshots: [snap("pv1", "Visible Guitar PV1"), snap("gone1", "Removed from layout item")] } }), gal(G.mine, "pub_mine", { profile_id: P, visibility: "LOCKED", title: "My private one" })] });
  // Private
  let r = await visit({ signedIn: false }, "pub_priv"); check("Private: the visitor's browser receives no exhibition row and the page says it is unavailable", !/EXH 01|Visible Guitar/.test(r.got + r.text) && /(not available|private|invalid|no longer)/i.test(r.text), [r.got.slice(0, 100), r.text.slice(0, 160)]);
  // Public
  r = await visit({ signedIn: false }, "pub_pub"); check("Public: page shows the visible item", /Visible Guitar PV1/.test(r.text), r.text.slice(0, 200));
  check("Public: hidden item shows as 'Hidden Item' and its real title is nowhere on the page or in the response", /Hidden Item/.test(r.text) && !/SECRET hidden item title/.test(r.text + r.got), 0);
  check("Public: the response carries no visitor analytics keys", !/VIEWER-KEY-SECRET/.test(r.got) && !/analytics_unique_view_keys/.test(r.got), r.got.slice(0, 120));
  // Alias
  r = await visit({ signedIn: false }, "pub_alias"); check("Alias: the page shows the alias, not the real name", /Mystery Curator/.test(r.text) && !/Real Owner Name|real_owner/.test(r.text), r.text.slice(0, 220));
  check("Alias: the response does not contain the owner's real profile id", !r.got.includes(O) && /"profile_id":null/.test(r.got.replace(/\s/g, "")), r.got.slice(0, 200));
  // Guest View
  r = await visit({ signedIn: false }, "pub_guest"); check("Guest View: a signed-out visitor can open it", /Visible Guitar PV1/.test(r.text), r.text.slice(0, 200));
  // Registered users
  r = await visit({ signedIn: false }, "pub_reg"); console.log("Registered Users, signed out:", r.text.slice(r.text.indexOf("Level") + 9, r.text.indexOf("Level") + 220));
  check("Registered Users: a signed-out visitor is asked to sign in and does not see the items", !/Visible Guitar PV1/.test(r.text) && /(sign in|log in|registered)/i.test(r.text), r.text.slice(0, 220));
  r = await visit({ signedIn: true }, "pub_reg"); check("Registered Users: a signed-in visitor sees the exhibition", /Visible Guitar PV1/.test(r.text), r.text.slice(0, 200));
  // Storage (draft)
  r = await visit({ signedIn: false }, "pub_store"); check("Storage/draft state: nothing is received or shown", !/Visible Guitar/.test(r.got + r.text), r.text.slice(0, 120));
  // Stale saved layout
  r = await visit({ signedIn: false }, "pub_stale"); check("Stale layout: an item that is no longer in the exhibition's item list is not shown", /Visible Guitar PV1/.test(r.text) && !/Removed from layout item/.test(r.text), r.text.slice(0, 260));
  // Revoked link: regenerate the token, the old one must stop working
  await seed({ galleries: (await L.dump("galleries")).map((g) => (g.id === G.pub ? { ...g, public_token: "pub_pub_new" } : g)) });
  r = await visit({ signedIn: false }, "pub_pub"); check("Revoked link: the old link shows nothing", !/Visible Guitar PV1/.test(r.text + r.got), r.text.slice(0, 160));
  r = await visit({ signedIn: false }, "pub_pub_new"); check("Revoked link: the new link works", /Visible Guitar PV1/.test(r.text), r.text.slice(0, 160));
  // Owner opening their own Private link
  r = await visit({ signedIn: true }, "pub_mine"); console.log("owner on own private link:", r.text.slice(r.text.indexOf("Level") + 9, r.text.indexOf("Level") + 200));
  check("Owner on their own Private link sees a 'private' notice (not 'not found', not the public view)", /private/i.test(r.text) && !/(invalid or no longer available)/i.test(r.text), r.text.slice(0, 200));
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
