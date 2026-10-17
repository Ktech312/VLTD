// Can a visitor who holds ONLY an aliased Guest View link connect that exhibition to its collector?
// Realistic mixed case, synthetic QA data: one collector with a PUBLIC profile, a LISTED (Public) exhibition, and an ALIASED Guest View
// exhibition. Four kinds of items: public in the vault / not public, each either only in the aliased exhibition or in both.
//   node alias-exposure.cjs [--base=https://vltd.app]
// The visitor below is a plain anonymous API client (what anyone with the public anon key can do), starting from the link token alone.
const crypto = require("crypto");
const { launch } = require("./cdp.cjs");
const { qa, admin, sleep, env } = require("./ui-lib.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const J = (x) => JSON.stringify(x);
const rows = [];
const fact = (name, value) => { rows.push([name, value]); console.log("FACT", name.padEnd(74), "=>", typeof value === "string" ? value : J(value)); };

(async () => {
  const [g0, g1] = qa.galleryIds; // g0 = aliased Guest View, g1 = listed (Public)
  const P = qa.profileId, NAME = "QA Real Collector " + qa.stamp, T0 = "qa-alias-" + qa.stamp, T1 = "qa-listed-" + qa.stamp;
  const uniq = (n) => `/qa-alias/unique-${qa.stamp}-${n}.png`;
  const orig = (await admin.from("galleries").select("id,visibility,state,public_token,alias_enabled,alias_name,layout,exhibition_layout").in("id", [g0, g1])).data;
  const origProfile = (await admin.from("profiles").select("is_public").eq("id", P).maybeSingle()).data;
  const mk = (k, title, pub) => ({ id: `qa_alias_${qa.stamp}_${k}`, profile_id: P, title, created_at: Date.now(), status: "COLLECTION", is_public: pub, universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", purchase_price: 10, image_front_url: uniq(k), images_json: [{ id: uniq(k), url: uniq(k), storageKey: uniq(k), order: 0, role: "primary" }] });
  const items = { pubA: mk("pubA", "Alias Test Public (only in aliased)", true), privA: mk("privA", "Alias Test Private (only in aliased)", false), pubBoth: mk("pubBoth", "Alias Test Public (in both)", true), privBoth: mk("privBoth", "Alias Test Private (in both)", false), other: mk("other", "Alias Test Other listed item", true) };
  await admin.from("vault_items").insert(Object.values(items));
  const snap = (it) => ({ id: it.id, title: it.title, imageFrontUrl: it.image_front_url, categoryLabel: "Sports Cards" });
  const aliasedIds = [items.pubA.id, items.privA.id, items.pubBoth.id, items.privBoth.id], listedIds = [items.pubBoth.id, items.privBoth.id, items.other.id];
  const lay = (ids) => ({ itemIds: ids, themePack: "classic", displayMode: "grid", guestViewMode: "public", publicItemSnapshots: ids.map((id) => snap(Object.values(items).find((x) => x.id === id))) });
  await admin.from("galleries").update({ visibility: "INVITE", state: "ACTIVE", public_token: T0, alias_enabled: true, alias_name: "QA Alias Curator", layout: lay(aliasedIds), exhibition_layout: { itemIds: aliasedIds } }).eq("id", g0);
  await admin.from("galleries").update({ visibility: "PUBLIC", state: "ACTIVE", public_token: T1, alias_enabled: false, layout: lay(listedIds), exhibition_layout: { itemIds: listedIds } }).eq("id", g1);
  await admin.from("gallery_items").delete().in("gallery_id", [g0, g1]);
  await admin.from("gallery_items").insert([...aliasedIds.map((a, i) => ({ gallery_id: g0, position: i + 1, artifact_id: a })), ...listedIds.map((a, i) => ({ gallery_id: g1, position: i + 1, artifact_id: a }))]);
  await admin.from("profiles").update({ is_public: true }).eq("id", P);
  await admin.from("public_profiles").upsert({ profile_id: P, display_name: NAME, avatar_emoji: "key" });
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  try {
    console.log("\n=== The visitor holds ONLY the aliased Guest View link token. What can they learn? ===");
    // 1. the link's own response
    const row = (await anon.rpc("get_gallery_by_share_token", { p_token: T0 }).maybeSingle()).data;
    const flat = J(row);
    fact("1. link row: real profile id present?", flat.includes(P));
    fact("1. link row: collector name / user id / e-mail present?", flat.includes(NAME) || flat.includes(qa.userId) || flat.includes(qa.email));
    fact("1. link row: fields the visitor gets", Object.keys(row).join(","));
    const its = (await anon.rpc("get_gallery_items_by_share_token", { p_token: T0 })).data || [];
    const ids = its.map((x) => x.artifact_id);
    fact("2. item ids in the aliased exhibition (visible to the visitor)", ids.length + " ids");
    // 3. look those ids up in the public item view
    const view = (await anon.from("public_vault_items").select("id,profile_id,title").in("id", ids)).data || [];
    fact("3. public item view returns which of those ids", view.map((v) => v.id.replace(`qa_alias_${qa.stamp}_`, "")));
    const derived = [...new Set(view.map((v) => v.profile_id))];
    fact("3. ...and the collector's profile id comes back for them?", derived.includes(P));
    const pp = derived.length ? (await anon.from("public_profiles").select("profile_id,display_name").in("profile_id", derived)).data || [] : [];
    fact("4. that profile id resolves to the collector's NAME?", pp.some((x) => x.display_name === NAME));
    // 5. is the aliased exhibition itself listed anywhere?
    const direct = (await anon.from("galleries").select("id").eq("id", g0)).data || [];
    fact("5. aliased exhibition readable straight from the galleries table?", direct.length > 0);
    const byProfile = (await anon.from("galleries").select("id,title,visibility").eq("profile_id", P)).data || [];
    fact("5. collector's exhibitions a visitor can list by profile id", byProfile.map((g) => g.visibility + ":" + g.title));
    // 6. overlap of item ids with the LISTED exhibition(s)
    const listedRows = byProfile.length ? (await anon.from("gallery_items").select("gallery_id,artifact_id").in("gallery_id", byProfile.map((g) => g.id))).data || [] : [];
    const overlap = ids.filter((i) => listedRows.some((r) => r.artifact_id === i)).map((i) => i.replace(`qa_alias_${qa.stamp}_`, ""));
    fact("6. aliased item ids that ALSO appear in the collector's listed exhibition", overlap);
    // 7. per item: how could the visitor link it?
    const per = {};
    for (const [k, it] of Object.entries(items)) {
      if (!aliasedIds.includes(it.id)) continue;
      const viaView = view.some((v) => v.id === it.id);
      const viaListed = listedRows.some((r) => r.artifact_id === it.id);
      per[k] = (it.is_public ? "public in vault" : "private in vault") + " | " + (k.endsWith("Both") ? "also in listed exhibition" : "only in aliased") + " -> linkable to the collector: " + (viaView || viaListed ? "YES (" + [viaView ? "item id -> public item view -> profile id" : "", viaListed ? "same item id in the listed exhibition" : ""].filter(Boolean).join(" + ") + ")" : "no");
    }
    for (const [k, v] of Object.entries(per)) fact("7. item " + k.padEnd(8), v);
    // 8. other tables that could tie a gallery / item id to a profile
    const probes = {};
    for (const t of ["activity_events", "exhibition_events", "gallery_views", "gallery_item_notes", "gallery_invite_tokens", "virtual_rooms", "artifact_events"]) {
      const col = t === "gallery_item_notes" || t === "artifact_events" ? null : "gallery_id";
      const r = col ? await anon.from(t).select("*").eq(col, g0) : await anon.from(t).select("*").in("artifact_id", aliasedIds);
      probes[t] = r.error ? "denied" : (r.data || []).length + " rows";
    }
    fact("8. other tables, queried by the aliased gallery / item ids", probes);
    const act = await anon.from("activity_events").select("*").eq("profile_id", P);
    fact("8. activity events by the collector's profile id (anon)", act.error ? "denied" : (act.data || []).length + " rows");
    // 9. unique photo URL of a PRIVATE item: does it appear on anything public?
    const imgHit = await anon.from("public_vault_items").select("id,profile_id").eq("image_front_url", items.privA.image_front_url);
    fact("9. the private aliased item's photo URL found on any public item?", (imgHit.data || []).length > 0);
    // 10. the page a visitor's browser loads for the link: does anything in it tie the exhibition to the collector?
    const V = await launch(9991);
    try {
      await V.send("Page.enable"); await V.send("Network.enable"); await V.send("Runtime.enable");
      const reqs = new Map();
      V.on((m) => { if (m.method === "Network.requestWillBeSent") reqs.set(m.params.requestId, m.params.request.url); });
      await V.send("Page.navigate", { url: BASE + "/museum/share/" + T0 }); await sleep(14000);
      const text = await V.evaluate("document.body.innerText");
      let withP = [];
      for (const [id, url] of reqs) { let b = ""; try { b = (await V.send("Network.getResponseBody", { requestId: id })).body || ""; } catch { /* none */ } if (url.includes(P) || b.includes(P) || b.includes(NAME)) withP.push(url.replace(/https:\/\/[^/]+/, "").slice(0, 70)); }
      fact("10. page shows the alias, not the collector's name", text.includes("QA Alias Curator") && !text.includes(NAME));
      fact("10. requests the visitor's browser made that carry the real profile id or name", withP);
      const hrefs = await V.evaluate("[...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => /^\\/(u|v|@|vault)/.test(h || ''))");
      fact("10. links on the page that go to a profile or vault page", hrefs);
      const cardLinks = await V.evaluate("(() => { const c = [...document.querySelectorAll('[data-item-id]')]; return c.length; })()");
      fact("10. item cards on the page", cardLinks);
    } finally { await V.close(); }
  } finally {
    await admin.from("gallery_items").delete().in("gallery_id", [g0, g1]);
    for (const o of orig) await admin.from("galleries").update({ visibility: o.visibility, state: o.state, public_token: o.public_token, alias_enabled: o.alias_enabled, alias_name: o.alias_name, layout: o.layout, exhibition_layout: o.exhibition_layout }).eq("id", o.id);
    await admin.from("profiles").update({ is_public: origProfile.is_public }).eq("id", P);
    await admin.from("public_profiles").delete().eq("profile_id", P);
    await admin.from("vault_items").delete().like("id", `qa_alias_${qa.stamp}_%`);
  }
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
