// Share-link and invite-link access, checked directly against the real project as a signed-out visitor, an unrelated account and the
// owner, plus what a visitor's browser actually receives. Synthetic QA account only.
//   node ui-links.cjs <label> --base=https://vltd.app [--nopage]
// Expectations are the target behaviour of supabase/migrations/20261018_gallery_links_respect_private.sql: before it is applied the
// "Private link" / "Storage" / row-content checks FAIL (that is the before-evidence); after it they must all pass.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { launch } = require("./cdp.cjs");
const { qa, admin, sleep, env } = require("./ui-lib.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
const LABEL = process.argv[2] || "links";
const NOPAGE = process.argv.includes("--nopage");
const OUT = path.join(__dirname, "shots-links-" + LABEL); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 500));
const stamp = Date.now().toString(36);
const mkClient = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const NOTE = "PRIVATE-NOTE-LINKS-" + stamp, SHELF = "PRIVATE-SHELF-LINKS-" + stamp, ALIAS = "QA Alias Curator " + stamp;

(async () => {
  const [g0, g1, g2, g3] = qa.galleryIds;
  const tok = (n) => `qa-links-${stamp}-${n}`;
  const orig = (await admin.from("galleries").select("id,visibility,state,public_token,alias_enabled,alias_name,analytics_unique_view_keys").in("id", qa.galleryIds)).data;
  const aItem = `qa_ui_${qa.stamp}_2`;
  const aRow = (await admin.from("vault_items").select("notes,storage_location,is_public,purchase_price").eq("id", aItem).maybeSingle()).data;
  const setG = (id, patch) => admin.from("galleries").update(patch).eq("id", id);
  // state of the four synthetic exhibitions
  await setG(g0, { visibility: "INVITE", state: "ACTIVE", public_token: tok(0), alias_enabled: true, alias_name: ALIAS, analytics_unique_view_keys: ["visitor-key-1", "visitor-key-2"] }); // Guest View with an alias
  await setG(g1, { visibility: "PUBLIC", state: "ACTIVE", public_token: tok(1) });
  await setG(g2, { visibility: "LOCKED", state: "ACTIVE", public_token: tok(2) });
  await setG(g3, { visibility: "PUBLIC", state: "STORAGE", public_token: tok(3) });
  await admin.from("gallery_items").delete().in("gallery_id", qa.galleryIds);
  await admin.from("gallery_items").insert(qa.galleryIds.flatMap((gid) => [{ gallery_id: gid, position: 1, artifact_id: aItem }, { gallery_id: gid, position: 2, artifact_id: "qa_ui_" + qa.stamp + "_3" }]));
  await admin.from("vault_items").update({ notes: NOTE, storage_location: SHELF, is_public: true, purchase_price: 4321.5 }).eq("id", aItem);
  // B = an unrelated account
  const bMail = `vltdadmin+qa-links-${stamp}@gmail.com`, bPass = "Qa!" + crypto.randomBytes(9).toString("base64url");
  const cu = await admin.auth.admin.createUser({ email: bMail, password: bPass, email_confirm: true });
  const bUser = cu.data.user.id;
  const bProf = (await admin.from("profiles").insert({ user_id: bUser, username: "qa_links_b_" + stamp, display_name: "QA Links B", profile_type: "personal", primary_focus: "Sports", avatar_emoji: "key", onboarding_completed: true, is_public: false, avatar_url: "__preset:key" }).select("id").single()).data.id;
  const anon = mkClient();
  const sbB = mkClient(); await sbB.auth.signInWithPassword({ email: bMail, password: bPass });
  const sbA = mkClient(); await sbA.auth.signInWithPassword({ email: qa.email, password: qa.password });
  const share = async (c, t) => (await c.rpc("get_gallery_by_share_token", { p_token: t })).data || [];
  const items = async (c, t) => (await c.rpc("get_gallery_items_by_share_token", { p_token: t })).data || [];
  const rpcN = async (c, fn, t) => { const r = await c.rpc(fn, { p_token: t }); return r.error ? "error: " + r.error.message : (r.data || []).length; };
  try {
    // ---- every state, three callers ----
    const states = [["Guest View (INVITE/ACTIVE)", g0, tok(0), true], ["Public (PUBLIC/ACTIVE)", g1, tok(1), true], ["Private (LOCKED)", g2, tok(2), false], ["Storage/draft (PUBLIC/STORAGE)", g3, tok(3), false]];
    for (const [name, id, t, shareable] of states) {
      for (const [who, c] of [["signed-out", anon], ["unrelated account", sbB]]) {
        const rows = await share(c, t), its = await items(c, t);
        check(`[${name}] share link, ${who}: ${shareable ? "opens with its items" : "returns nothing"}`, shareable ? rows.length === 1 && its.length >= 1 : rows.length === 0 && its.length === 0, { rows: rows.length, items: its.length });
      }
      const own = await share(sbA, t);
      check(`[${name}] the owner keeps access through the link`, own.length === 1 && own[0].profile_id === qa.profileId, own.length);
    }
    // ---- an old link after switching to Private ----
    const t1 = tok(0);
    check("[switch] Guest View link works while shared", (await share(anon, t1)).length === 1);
    await setG(g0, { visibility: "LOCKED" });
    check("[switch] the SAME old link returns nothing once the exhibition is Private (signed-out)", (await share(anon, t1)).length === 0 && (await items(anon, t1)).length === 0);
    check("[switch] and nothing for an unrelated account", (await share(sbB, t1)).length === 0);
    check("[switch] the owner still reads it", (await share(sbA, t1)).length === 1);
    await setG(g0, { visibility: "INVITE" });
    check("[switch] switching back to Guest View makes the same link work again (intended shareable state preserved)", (await share(anon, t1)).length === 1);
    await setG(g0, { state: "STORAGE" });
    check("[switch] moving it to Storage also stops the link for a visitor", (await share(anon, t1)).length === 0);
    await setG(g0, { state: "ACTIVE" });

    // ---- invitation links ----
    const mkInv = (n, extra = {}) => admin.from("gallery_invites").insert({ token: `qa-inv-${stamp}-${n}`, gallery_id: extra.gid || g0, disabled: false, permissions: { financialHistory: true }, ...extra.row });
    await mkInv("ok"); await mkInv("off", { row: { disabled: true } }); await mkInv("old", { row: { expires_at: new Date(Date.now() - 86400e3).toISOString() } }); await mkInv("locked", { gid: g2 });
    const I = (n) => `qa-inv-${stamp}-${n}`;
    check("[invite] valid invite on a Guest View exhibition opens (link, items, financials for public items)", (await rpcN(anon, "get_gallery_by_invite_token", I("ok"))) === 1 && (await rpcN(anon, "get_gallery_items_by_invite_token", I("ok"))) >= 1 && (await rpcN(anon, "get_invite_item_financials", I("ok"))) >= 1);
    check("[invite] a disabled invite returns nothing", (await rpcN(anon, "get_gallery_by_invite_token", I("off"))) === 0 && (await rpcN(anon, "get_gallery_items_by_invite_token", I("off"))) === 0 && (await rpcN(anon, "get_invite_item_financials", I("off"))) === 0);
    check("[invite] an expired invite returns nothing", (await rpcN(anon, "get_gallery_by_invite_token", I("old"))) === 0 && (await rpcN(anon, "get_invite_item_financials", I("old"))) === 0);
    check("[invite] an unknown invite returns nothing", (await rpcN(anon, "get_gallery_by_invite_token", "nope-" + stamp)) === 0);
    check("[invite] a valid invite on a PRIVATE exhibition returns nothing (link, items AND purchase prices), also for an unrelated account", (await rpcN(anon, "get_gallery_by_invite_token", I("locked"))) === 0 && (await rpcN(anon, "get_gallery_items_by_invite_token", I("locked"))) === 0 && (await rpcN(anon, "get_invite_item_financials", I("locked"))) === 0 && (await rpcN(sbB, "get_invite_item_financials", I("locked"))) === 0);
    check("[invite] the owner can still use the invite of their own private exhibition", (await rpcN(sbA, "get_gallery_by_invite_token", I("locked"))) === 1);

    // ---- what a visitor receives ----
    const row = (await share(anon, tok(0)))[0];
    check("[content] no visitor identifiers in the row (analytics_unique_view_keys)", row && row.analytics_unique_view_keys == null, row && row.analytics_unique_view_keys);
    check("[content] an aliased exhibition's response does not carry the real profile_id", row && row.profile_id == null && row.alias_name === ALIAS, row && { profile_id: row.profile_id, alias: row.alias_name });
    const flat = JSON.stringify([row, await items(anon, tok(0)), (await share(anon, tok(1)))[0], (await items(anon, tok(1)))]);
    check("[content] the link responses contain none of the owner's private values (notes, storage location, purchase price)", !flat.includes(NOTE) && !flat.includes(SHELF) && !flat.includes("4321.5"), { note: flat.includes(NOTE), shelf: flat.includes(SHELF), price: flat.includes("4321.5") });
    check("[content] nor the owner's e-mail, user id or display name", !flat.includes(qa.email) && !flat.includes(qa.userId) && !flat.includes("QA Curator"), { email: flat.includes(qa.email), uid: flat.includes(qa.userId), name: flat.includes("QA Curator") });
    // can the real name be found from what the visitor was given for the ALIASED exhibition?
    const pid = row && row.profile_id;
    info("[content] profile_id handed to a visitor for the aliased exhibition", pid ?? null);
    const items2 = (await items(anon, tok(1)));
    const ids = items2.map((x) => x.artifact_id).filter(Boolean);
    if (ids.length) {
      const PUBLIC_COLS = "id,profile_id,title,description,status,is_public,images_json";
      const rows = (await anon.from("public_vault_items").select(PUBLIC_COLS).in("id", ids)).data || [];
      const blob = JSON.stringify(rows);
      check("[content] the public item view returns none of the private values for items listed in a link", !blob.includes(NOTE) && !blob.includes(SHELF) && !blob.includes("4321.5"), rows.length);
      const forbidden = await anon.from("vault_items").select("notes,purchase_price,storage_location").eq("id", aItem);
      check("[content] a visitor cannot select the private columns of an item directly (database-level)", !!forbidden.error || (forbidden.data || []).length === 0, forbidden.error && forbidden.error.message);
    }

    // ---- what the page shows to a visitor's browser (aliased Guest View link) ----
    if (!NOPAGE) {
      // The owner's OTHER Public exhibition would put the owner's profile id on the page through the public exhibitions list (a Public
      // exhibition is listed with its profile id by design). Make it Private for this page check so the check is about the aliased link alone.
      await setG(g1, { visibility: "LOCKED" });
      const V = await launch(9800 + Math.floor(Math.random() * 150));
      try {
        await V.send("Page.enable"); await V.send("Network.enable"); await V.send("Runtime.enable");
        await V.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
        const seen = []; V.on((m) => { if (m.method === "Network.responseReceived" && /supabase/.test(m.params.response.url)) seen.push(m.params.requestId); });
        await V.send("Page.navigate", { url: BASE + "/museum/share/" + tok(0) }); await sleep(14000);
        const text = await V.evaluate("document.body.innerText");
        const shot = await V.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(OUT + "/guest-view-link-alias.png", Buffer.from(shot.data, "base64"));
        const bodies = []; for (const id of seen) { try { bodies.push((await V.send("Network.getResponseBody", { requestId: id })).body || ""); } catch { /* none */ } }
        const all = text + " " + bodies.join(" ");
        check("[page] the Guest View link opens for a signed-out visitor and names the exhibition", /QA Exhibition 1/.test(text), text.slice(0, 200));
        check("[page] it shows the alias as the curator", text.includes(ALIAS), text.slice(0, 400));
        check("[page] and nothing the browser received names the real curator, e-mail, user id or private values", !all.includes("QA Curator") && !all.includes(qa.email) && !all.includes(qa.userId) && !all.includes(NOTE) && !all.includes(SHELF) && !all.includes(qa.profileId), { name: all.includes("QA Curator"), pid: all.includes(qa.profileId), note: all.includes(NOTE) });
        await setG(g0, { visibility: "LOCKED" });
        await V.send("Page.navigate", { url: BASE + "/museum/share/" + tok(0) }); await sleep(9000);
        const t2 = await V.evaluate("document.body.innerText");
        const shot2 = await V.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(OUT + "/old-link-after-private.png", Buffer.from(shot2.data, "base64"));
        check("[page] the old link of an exhibition switched to Private shows nothing of it to a visitor", !/QA Exhibition 1/.test(t2), t2.slice(0, 300));
        info("[page] what the visitor sees instead", t2.replace(/\s+/g, " ").slice(0, 200));
        await setG(g0, { visibility: "INVITE" });
      } finally { await V.close(); }
    }
  } finally {
    for (const o of orig) await setG(o.id, { visibility: o.visibility, state: o.state, public_token: o.public_token, alias_enabled: o.alias_enabled, alias_name: o.alias_name, analytics_unique_view_keys: o.analytics_unique_view_keys });
    await admin.from("vault_items").update({ notes: aRow.notes, storage_location: aRow.storage_location, is_public: aRow.is_public, purchase_price: aRow.purchase_price }).eq("id", aItem);
    await admin.from("gallery_items").delete().in("gallery_id", qa.galleryIds);
    await admin.from("gallery_invites").delete().like("token", `qa-inv-${stamp}-%`);
    await admin.from("profiles").delete().eq("id", bProf); await admin.auth.admin.deleteUser(bUser);
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
