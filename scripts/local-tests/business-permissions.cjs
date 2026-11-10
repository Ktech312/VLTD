// Business (team) profile roles as seen by the app: owner, admin, member, removed member, unrelated account. Shows what the UI offers and explains for viewing/deleting items.
// The team lookup is a labelled simulation (sim-supabase list_member_profiles); the database's own row-level protections are NOT exercised here and stay as they are.
const L = require("./lib.cjs"); const { sleep, NL, check, sim, seed, SECOND, U, P } = L; const norm = (t) => t.split(NL).join(" ").replace(/\s+/g, " ");
const BZ = "77777777-7777-4777-8777-777777777777";
const biz = (userId) => ({ id: BZ, user_id: userId, display_name: "Team Shop", username: "team_shop", profile_type: "business", primary_focus: "Sports", avatar_emoji: "key", onboarding_completed: true, is_public: false, tier: "FULL", avatar_url: "__preset:key", created_at: "2026-01-01T00:00:00Z" });
const item = { id: "bz_item_1", profile_id: BZ, title: "Team Shop Item One", universe: "SPORTS", category: "Collectors Choice", category_label: "Collectors Choice", status: "COLLECTION", created_at: 1790000000500, is_public: false, purchase_price: 10, current_value: 20, image_front_url: "/collectibles/sports-slab.png" };
async function scenario(label, ownerUser, role, activeBz) {
  await sim("/__sim/reset"); await L.registerSecond();
  const base = (await L.dump("profiles")).filter((x) => x.id !== BZ);
  await seed({ profiles: [...base, biz(ownerUser)], vault_items: [...(await L.dump("vault_items")), item], profile_members: role ? [{ profile_id: BZ, user_id: U, role }] : [] });
  const s = await L.open({ width: 1280, height: 1500 });
  try { await s.evaluate(`localStorage.setItem("vltd_active_profile_id_v1", ${JSON.stringify(activeBz ? BZ : P)}); true`);
    if (label === "removed") { // this device has shown this person the team before: it was in their list, and now it is gone
      await s.evaluate(`localStorage.setItem("vltd_member_profiles_seen_v1", JSON.stringify({ u: ${JSON.stringify(U)}, ids: [${JSON.stringify(BZ)}] })); true`); }
    await s.go("/vault/item/" + item.id, 11000); await s.dismiss(); const t = norm(await s.text());
    const hasDelete = await s.evaluate(`!!document.querySelector('button[aria-label="Delete item"]')`); const active = await s.evaluate(`localStorage.getItem("vltd_active_profile_id_v1")`);
    await s.go("/vault", 10000); const list = norm(await s.text());
    return { s, t, hasDelete, active, list };
  } finally { await s.close(); }
}
(async () => {
  let r = await scenario("owner", U, null, true); check("owner: the team item opens and offers Delete item", /Team Shop Item One/.test(r.t) && r.hasDelete, [r.t.slice(0, 120), r.hasDelete]);
  r = await scenario("admin", SECOND.userId, "admin", true); check("admin: the team item opens and offers Delete item", /Team Shop Item One/.test(r.t) && r.hasDelete, [r.t.slice(0, 120), r.hasDelete]);
  r = await scenario("member", SECOND.userId, "member", true); check("member: the team item opens for viewing but Delete item is NOT offered", /Team Shop Item One/.test(r.t) && !r.hasDelete, [r.t.slice(0, 120), r.hasDelete]);
  console.log("member vault page mentions:", (r.list.match(/(owner or an admin|can.t delete|only an owner)[^.]{0,80}/gi) || []).slice(0, 2));
  // members get an explanation where they would look for Delete: the Vault's Select mode
  { await sim("/__sim/reset"); await L.registerSecond(); const base = (await L.dump("profiles")).filter((x) => x.id !== BZ); await seed({ profiles: [...base, biz(SECOND.userId)], vault_items: [...(await L.dump("vault_items")), item], profile_members: [{ profile_id: BZ, user_id: U, role: "member" }] });
    const s = await L.open({ width: 1280, height: 1500 }); try { await s.evaluate(`localStorage.setItem("vltd_active_profile_id_v1", ${JSON.stringify(BZ)}); true`); await s.go("/vault", 11000); await s.dismiss(); await s.mclick("Select", false); await sleep(1500); const t = norm(await s.text());
      check("member: in Select mode there is no Delete action", !/Delete \d* ?selected|Delete selected|^Delete$/m.test(await s.evaluate("document.body.innerText")) && !(await s.evaluate(`[...document.querySelectorAll("button")].some((b) => /^Delete/.test(b.innerText.trim()))`)), t.slice(0, 200));
      console.log("member select-mode text:", (t.match(/(owner or an admin|team member|can.t delete)[^.]{0,100}/gi) || []).slice(0, 2)); } finally { await s.close(); } }
  r = await scenario("removed", SECOND.userId, null, true); check("removed member: the device falls back to their own profile (no team items listed)", r.active !== BZ && !/Team Shop Item One/.test(r.list), [r.active, r.list.slice(0, 100)]);
  console.log("removed member opening the old team item link:", r.t.slice(r.t.indexOf("Level") + 9, r.t.indexOf("Level") + 160));
  check("removed member: the old team item is not shown to them", !/Team Shop Item One/.test(r.t) && !r.hasDelete, r.t.slice(0, 160));
  r = await scenario("unrelated", SECOND.userId, null, true); check("unrelated account with a stale team profile id: falls back to their own profile, team items not listed or openable", r.active !== BZ && !/Team Shop Item One/.test(r.list + r.t) && !r.hasDelete, [r.active, r.t.slice(0, 100)]);
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
