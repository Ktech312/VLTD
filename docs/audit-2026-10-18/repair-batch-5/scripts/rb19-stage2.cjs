// RC-05 stage 2 verification on PRODUCTION (view + sanitised link responses) with isolated synthetic exhibitions, including a deliberately
// hostile one, read as a visitor, an unrelated signed-in account (QA account B) and the owner (QA account A). QA content only; removed at the end.
//   AUDIT_MANIFEST=<manifest> node rb19-stage2.cjs <label>
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const SD = path.join(__dirname, "..", "..", "scripts");
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const L = require(path.join(SD, "audit-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { sleep, admin, P, ST, m } = X;
const LABEL = process.argv[2] || "run";
const r = L.R("RB19");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], facts: {} };
let S, n = 0;
const ids = {}; const gid = (k) => (ids[k] = ids[k] || crypto.randomUUID());
const tok = (k) => `qarb19${ST}${k}`;
async function rec(ok, control, expected, actual, page = "database (visitor / QA accounts)", blocked = false) {
  let shot = ""; if (S && page.startsWith("/")) { try { await sleep(250); shot = path.join(L.AUD, await S.jshot(`rb19-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: shot });
  const row = { page, control, expected, actual: blocked && !ok ? "STILL OPEN UNTIL STAGE 4 (expected): " + actual : actual, evidence: shot ? path.relative(L.AUD, shot).replace(/\\/g, "/") : "", impact: "RC-05 stage 2", repro: "" };
  if (blocked && !ok) r.blocked(row); else r.check(!!ok, row);
}
const client = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const SECRETS = ["SECRET-NOTE-RB19", "owner-secret@example.com", "REAL HIDDEN TITLE RB19", "real-hidden-rb19", "viewer-key-rb19"];
const leaks = (v) => SECRETS.filter((x) => JSON.stringify(v).includes(x));
const ALLOWED_COLS = ["alias_avatar", "alias_enabled", "alias_name", "analytics_views", "cover_image", "created_at", "description", "exhibition_layout", "id", "layout", "profile_id", "public_token", "state", "title", "visibility"];

(async () => {
  const A = client(), B = client(), V = client();
  try {
    await A.auth.signInWithPassword({ email: m.email, password: m.password });
    const sb = await B.auth.signInWithPassword({ email: m.k.email, password: m.k.password }); if (sb.error) throw new Error("B sign-in");
    const items = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("status", "COLLECTION").like("id", "qa_vz_%").limit(2)).data.map((x) => x.id);
    const snapOpen = (id, t) => ({ id, title: t, subtitle: "sub", number: "7", grade: "9.6", year: "1990", description: "public text", categoryLabel: "Comics", subcategoryLabel: "Key", imageFrontUrl: "/collectibles/comic-slab.png", imageBackUrl: "/collectibles/comic-slab.png", imageFrontStoragePath: "items/1_x/a.jpg", primaryImageKey: "k1", createdAt: 5 });
    const plainLayout = { itemIds: items, themePack: "classic", displayMode: "grid", guestViewMode: "public", sections: [{ id: "s", title: "Exhibit 1", description: "", itemIds: items, slotLayout: [...items, null] }], publicItemSnapshots: [snapOpen(items[0], "QA Card One"), snapOpen(items[1], "QA Card Two")] };
    const hostile = { ...plainLayout, ownerProfileId: P, ownerEmail: "owner-secret@example.com", privateNote: "SECRET-NOTE-RB19", "0": "G", "1": "R", itemIds: [...items, { evil: "object" }, 7],
      publicItemSnapshots: [{ ...snapOpen(items[0], "QA Card One"), purchasePrice: 99, currentValue: 500, ownerEmail: "owner-secret@example.com", notes: "SECRET-NOTE-RB19", profileId: P, nested: { a: 1 } },
        { id: items[1], hidden: true, title: "REAL HIDDEN TITLE RB19", imageFrontUrl: "/real-hidden-rb19.png", imageBackUrl: "/real-hidden-rb19-b.png", imageFrontStoragePath: "items/2_y/real-hidden-rb19.jpg", primaryImageKey: "k2", blurThumb: "data:image/png;base64,AAAA", createdAt: 6, description: "SECRET-NOTE-RB19" }, "not an object"] };
    const mk = (k, extra = {}) => ({ id: gid(k), profile_id: P, title: `QA RB19 ${k} ${ST}`, description: "synthetic", visibility: "PUBLIC", state: "ACTIVE", cover_image: "/collectibles/comic-slab.png", layout: plainLayout, exhibition_layout: plainLayout, public_token: tok(k), alias_enabled: false, analytics_views: 11, item_notes: [{ itemId: items[0], note: "SECRET-NOTE-RB19", updatedAt: 1 }], analytics_unique_view_keys: ["viewer-key-rb19"], analytics_last_viewed_at: new Date().toISOString(), ...extra });
    const rows = [mk("plain"), mk("hostile", { alias_enabled: true, alias_name: "QA Alias Curator", layout: hostile, exhibition_layout: hostile }), mk("private", { visibility: "LOCKED" }), mk("guest", { visibility: "INVITE" }), mk("draft", { state: "STORAGE" })];
    const ins = await admin.from("galleries").insert(rows); if (ins.error) throw new Error("seed: " + ins.error.message);
    await admin.from("gallery_items").insert(Object.keys(ids).flatMap((k) => items.map((it, i) => ({ gallery_id: ids[k], position: i + 1, artifact_id: it }))));
    const inv = {}; for (const k of ["hostile", "guest", "private"]) { inv[k] = `qarb19inv${ST}${k}`; const x = await admin.from("gallery_invites").insert({ token: inv[k], gallery_id: gid(k) }); if (x.error) out.facts["inviteSeedError_" + k] = x.error.message; }
    const qaIds = Object.values(ids);

    // ===== the view
    const view = async (cl) => { const x = await cl.from("public_galleries").select("*").in("id", qaIds); return x; };
    for (const [who, cl] of [["visitor", V], ["unrelated signed-in account B", B], ["owner A", A]]) {
      const x = await view(cl); const got = (x.data || []).map((g) => g.title.replace(/ QA.*$/, "").replace(/^QA RB19 /, "").split(" ")[0]).sort().join("|");
      await rec(!x.error && got === "hostile|plain", `View as ${who}: only the public, active QA exhibitions`, "hostile|plain (not private, guest-only, draft)", x.error ? `${x.error.code} ${x.error.message}` : got);
    }
    const vh = ((await view(V)).data || []).find((g) => g.id === gid("hostile")), vp = ((await view(V)).data || []).find((g) => g.id === gid("plain"));
    await rec(vh && JSON.stringify(Object.keys(vh).sort()) === JSON.stringify(ALLOWED_COLS), "View columns are exactly the allowlist", ALLOWED_COLS.join(", "), vh ? Object.keys(vh).sort().join(", ") : "no row");
    await rec(vh && vh.profile_id === null && vh.alias_name === "QA Alias Curator" && vh.alias_enabled === true, "Alias exhibition in the view: no profile id, alias name kept", "profile_id null, alias name present", vh ? `profile_id=${vh.profile_id}; alias_name=${vh.alias_name}` : "no row");
    await rec(vp && vp.profile_id === P, "Ordinary exhibition in the view keeps its profile id (Discover and listings need it)", "real profile id present", vp ? `profile_id present=${vp.profile_id === P}` : "no row");
    await rec(vh && leaks(vh).length === 0, "Hostile row in the view: none of the planted secrets survive (owner email, private note, hidden title and images, visitor key)", "none", vh ? `leaked: ${leaks(vh).join(", ") || "none"}` : "no row");
    const LAY = ["adultOnly", "displayMode", "glassShelfOverlay", "guestViewMode", "itemIds", "publicItemSnapshots", "sections", "shelfBackground", "shelfOverlayStyle", "templateId", "themePack", "type"];
    const badKeys = [...Object.keys(vh?.layout || {}), ...Object.keys(vh?.exhibition_layout || {})].filter((k) => !LAY.includes(k));
    await rec(vh && badKeys.length === 0, "Hostile row: layout keeps only allowlisted keys (owner id, email, private note, stray numeric keys removed)", "no key outside the allowlist", `keys outside: ${badKeys.join(", ") || "none"}`);
    const hs = (vh?.layout?.publicItemSnapshots || []).find((s) => s.id === items[1]);
    await rec(hs && JSON.stringify(Object.keys(hs).sort()) === JSON.stringify(["blurThumb", "createdAt", "hidden", "id"]), "Hidden item in the view keeps only id, hidden, blur thumbnail, created time", "title and image references removed", hs ? Object.keys(hs).sort().join(", ") : "no hidden snapshot");
    const os = (vh?.layout?.publicItemSnapshots || []).find((s) => s.id === items[0]);
    await rec(os && os.title === "QA Card One" && !("purchasePrice" in os) && !("currentValue" in os) && !("ownerEmail" in os) && !("notes" in os) && !("profileId" in os) && !("nested" in os), "Visible card keeps what a public card needs and none of price / value / owner fields", "title, images etc. kept; owner fields gone", os ? Object.keys(os).sort().join(", ") : "no snapshot");
    await rec(vh && JSON.stringify(vh.layout.itemIds) === JSON.stringify(items), "Item ids keep only text ids", JSON.stringify(items), JSON.stringify(vh?.layout?.itemIds));
    await rec(vp && JSON.stringify(vp.layout.publicItemSnapshots.map((s) => s.title)) === JSON.stringify(["QA Card One", "QA Card Two"]) && vp.layout.themePack === "classic" && vp.exhibition_layout.sections.length === 1, "Ordinary exhibition's layout is unchanged for a public page (titles, theme, sections)", "same content", vp ? JSON.stringify({ titles: vp.layout.publicItemSnapshots.map((s) => s.title), theme: vp.layout.themePack, sections: vp.exhibition_layout.sections.length }) : "no row");
    const cnt = (await V.from("public_galleries").select("id", { count: "exact", head: true })).count, tbl = (await admin.from("galleries").select("id", { count: "exact", head: true }).eq("visibility", "PUBLIC").eq("state", "ACTIVE")).count;
    await rec(cnt === tbl, "The view lists every public, active exhibition in the account (nothing lost for discovery)", `${tbl}`, `${cnt}`);
    const realLeak = ((await V.from("public_galleries").select("*")).data || []).filter((g) => g.alias_enabled && g.profile_id !== null).length;
    await rec(realLeak === 0, "No alias exhibition anywhere in the view names a profile", "0", `${realLeak}`);

    // ===== link responses (share and invite functions)
    const share = async (cl, t) => (await cl.rpc("get_gallery_by_share_token", { p_token: t }));
    for (const [who, cl] of [["visitor", V], ["unrelated account B", B]]) {
      const x = await share(cl, tok("hostile")); const row = (x.data || [])[0];
      await rec(row && row.profile_id === null && JSON.stringify(row.item_notes) === "[]" && row.analytics_unique_view_keys === null && row.analytics_last_viewed_at === null && leaks(row).length === 0 && ![...Object.keys(row.layout || {})].some((k) => !LAY.includes(k)), `Share link of the hostile alias exhibition as ${who}: sanitised`, "profile id empty, no notes, no visitor keys, no last-viewed time, layout allowlisted, no planted secret", row ? `profile_id=${row.profile_id}; item_notes=${JSON.stringify(row.item_notes)}; keys=${row.analytics_unique_view_keys}; lastViewed=${row.analytics_last_viewed_at}; leaked=${leaks(row).join(",") || "none"}` : `${x.error?.message || "no row"}`);
    }
    const ao = (await share(A, tok("hostile"))).data?.[0];
    await rec(ao && ao.profile_id === P && Array.isArray(ao.item_notes) && ao.item_notes.length === 1 && Array.isArray(ao.analytics_unique_view_keys), "Share link as the owner: still the whole row (profile id, notes, visitor keys)", "full row", ao ? `profile_id present=${ao.profile_id === P}; notes=${ao.item_notes?.length}; keys=${JSON.stringify(ao.analytics_unique_view_keys)}` : "no row");
    const pp = (await share(V, tok("plain"))).data?.[0];
    await rec(pp && pp.profile_id === P && JSON.stringify(pp.layout.publicItemSnapshots.map((s) => s.title)) === JSON.stringify(["QA Card One", "QA Card Two"]), "Share link of an ordinary exhibition for a visitor: content intact, profile id as before", "titles intact", pp ? JSON.stringify(pp.layout.publicItemSnapshots.map((s) => s.title)) : "no row");
    for (const k of ["private", "draft"]) { const x = await share(B, tok(k)); await rec((x.data || []).length === 0, `Share link of a ${k} exhibition for an unrelated account`, "nothing", `${(x.data || []).length} rows`); }
    const xo = await share(A, tok("private")); await rec((xo.data || []).length === 1, "...but the owner still reaches their private exhibition through it", "1 row", `${(xo.data || []).length}`);
    const g1 = (await share(V, tok("guest"))).data?.[0];
    await rec(g1 && JSON.stringify(g1.item_notes) === "[]" && g1.analytics_unique_view_keys === null, "Share link of a guest-only exhibition for a visitor: sanitised too", "no notes, no keys", g1 ? `notes=${JSON.stringify(g1.item_notes)}; keys=${g1.analytics_unique_view_keys}` : "no row");
    if (!out.facts.inviteSeedError_hostile) {
      const iv = (await V.rpc("get_gallery_by_invite_token", { p_token: inv.hostile })).data?.[0];
      await rec(iv && iv.profile_id === null && JSON.stringify(iv.item_notes) === "[]" && iv.analytics_unique_view_keys === null && leaks(iv).length === 0, "Invite link of the hostile alias exhibition for a visitor: sanitised", "profile id empty, no notes, no keys, no secrets", iv ? `profile_id=${iv.profile_id}; notes=${JSON.stringify(iv.item_notes)}; leaked=${leaks(iv).join(",") || "none"}` : "no row");
      const ivp = (await V.rpc("get_gallery_by_invite_token", { p_token: inv.private })).data || [];
      await rec(ivp.length === 0, "Invite link of a private exhibition for a visitor", "nothing", `${ivp.length} rows`);
      const it = (await V.rpc("get_gallery_items_by_invite_token", { p_token: inv.guest })).data || [];
      await rec(it.length === items.length, "Invite link items still load", `${items.length} items`, `${it.length}`);
    } else await rec(false, "Invite link checks", "run", "could not seed an invite: " + out.facts.inviteSeedError_hostile);
    const sitems = (await V.rpc("get_gallery_items_by_share_token", { p_token: tok("plain") })).data || [];
    await rec(sitems.length === items.length, "Share-link items still load", `${items.length}`, `${sitems.length}`);

    // ===== what stage 2 does NOT change: the old table read is still open until stage 4
    const old = await V.from("galleries").select("profile_id,item_notes,analytics_unique_view_keys").eq("id", gid("hostile")).maybeSingle();
    await rec(!old.data, "Old path (expected to stay open until stage 4): a visitor reading the table for an alias exhibition", "(after stage 4) nothing", old.data ? `still returns profile_id=${old.data.profile_id === P ? "the real id" : old.data.profile_id}, item_notes=${JSON.stringify(old.data.item_notes).slice(0, 40)}` : "nothing", "database (visitor)", true);

    // ===== the site still renders with the sanitised link responses (stage 2 changes nothing it reads)
    S = await X.S_("visitor", { width: 1440, height: 900 });
    const page = async (url, needle) => { await S.visit(url); await S.waitFor(`document.body.innerText.includes(${JSON.stringify(needle)})`, 45000, "page").catch(() => {}); await sleep(2500); return (await S.text()).replace(/\s+/g, " "); };
    let t = await page(`/museum/share/${tok("plain")}`, "QA RB19 plain");
    await rec(t.includes("QA RB19 plain") && t.includes("QA Card One") && t.includes("QA Card Two"), "Site: share-link page of an ordinary exhibition (visitor)", "title and both cards render", `title=${t.includes("QA RB19 plain")}; cards=${t.includes("QA Card One")},${t.includes("QA Card Two")}`, "/museum/share/[token]");
    t = await page(`/museum/share/${tok("hostile")}`, "QA RB19 hostile");
    await rec(t.includes("QA RB19 hostile") && t.includes("QA Alias Curator") && !t.includes(SECRETS[0]) && !t.includes(SECRETS[2]), "Site: share-link page of the hostile alias exhibition (visitor)", "renders under the alias; no planted secret on the page", `title=${t.includes("QA RB19 hostile")}; alias=${t.includes("QA Alias Curator")}; secret on page=${SECRETS.some((s2) => t.includes(s2))}`, "/museum/share/[token]");
    if (!out.facts.inviteSeedError_guest) {
      // invitation pages require a signed-in account (an invite is for registered users): use the QA account B browser session
      await S.close(); S = await X.S_("viewer", { width: 1440, height: 900 });
      t = await page(`/museum/invite/${inv.guest}`, "QA RB19 guest");
      await rec(t.includes("QA RB19 guest") && t.includes("QA Card One"), "Site: invite-link page of a guest-only exhibition (signed-in QA account B)", "title and cards render", `title=${t.includes("QA RB19 guest")}; card=${t.includes("QA Card One")}`, "/museum/invite/[token]");
    }
    t = await page(`/museum/${gid("plain")}/guest`, "QA RB19 plain");
    await rec(t.includes("QA RB19 plain") && t.includes("QA Card One"), "Site: guest page of an ordinary public exhibition (visitor)", "title and cards render", `title=${t.includes("QA RB19 plain")}; card=${t.includes("QA Card One")}`, "/museum/[galleryId]/guest");
    t = await page("/discover", "QA RB19");
    await rec(t.includes("QA RB19 plain"), "Site: Discover still lists a public exhibition (nothing reads the view yet)", "listed", `listed=${t.includes("QA RB19 plain")}`, "/discover");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await admin.from("gallery_invites").delete().in("gallery_id", Object.values(ids)); await admin.from("gallery_items").delete().in("gallery_id", Object.values(ids)); await admin.from("galleries").delete().in("id", Object.values(ids)); } catch {}
    fs.writeFileSync(path.join(EV, `rb19-stage2-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    try { await S.close(); } catch {}
    process.exit(0);
  }
})();
