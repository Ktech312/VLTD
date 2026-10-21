// RC-05 stage 4 verification, database level, on PRODUCTION with isolated QA exhibitions (run AFTER the owner has run step 4).
// Then run rb20-stage3.cjs with the label "stage4" for the page-level matrix (visitor / unrelated account / owner, cache ownership).
//   AUDIT_MANIFEST=<manifest> node rb22-stage4-db.cjs <label>
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const SD = path.join(__dirname, "..", "..", "scripts");
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const L = require(path.join(SD, "audit-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { admin, P, ST, m } = X;
const LABEL = process.argv[2] || "run";
const r = L.R("RB22");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], facts: {} };
const ids = {}; const gid = (k) => (ids[k] = ids[k] || crypto.randomUUID());
const tok = (k) => `qarb22${ST}${k}`;
function rec(ok, control, expected, actual) { out.cases.push({ control, expected, ok: !!ok, actual }); r.check(!!ok, { page: "database (visitor / QA accounts)", control, expected, actual, evidence: "", impact: "RC-05 stage 4", repro: "" }); }
const client = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const err = (e) => (e ? `${e.code} ${String(e.message).slice(0, 80)}` : "ok");
(async () => {
  const A = client(), B = client(), V = client();
  try {
    await A.auth.signInWithPassword({ email: m.email, password: m.password });
    const sb = await B.auth.signInWithPassword({ email: m.k.email, password: m.k.password }); if (sb.error) throw new Error("B sign-in");
    const items = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("status", "COLLECTION").like("id", "qa_vz_%").limit(2)).data.map((x) => x.id);
    const lay = { itemIds: items, themePack: "classic", guestViewMode: "public", sections: [], publicItemSnapshots: items.map((id, i) => ({ id, title: `QA Card ${i + 1}`, imageFrontUrl: "/collectibles/comic-slab.png" })) };
    const mk = (k, extra = {}) => ({ id: gid(k), profile_id: P, title: `QA RB22 ${k} ${ST}`, description: "synthetic", visibility: "PUBLIC", state: "ACTIVE", cover_image: "/collectibles/comic-slab.png", layout: lay, exhibition_layout: lay, public_token: tok(k), alias_enabled: false, item_notes: [{ itemId: items[0], note: "SECRET-NOTE-RB22" }], analytics_unique_view_keys: ["viewer-key-rb22"], ...extra });
    await admin.from("galleries").insert([mk("plain"), mk("alias", { alias_enabled: true, alias_name: "QA Alias Curator" }), mk("private", { visibility: "LOCKED" }), mk("guest", { visibility: "INVITE" }), mk("draft", { state: "STORAGE" })]);
    await admin.from("gallery_items").insert(Object.keys(ids).flatMap((k) => items.map((it, i) => ({ gallery_id: ids[k], position: i + 1, artifact_id: it }))));
    const qa = Object.values(ids);
    // ---- the old table read is closed
    const v1 = await V.from("galleries").select("id,profile_id,item_notes,analytics_unique_view_keys").in("id", qa);
    rec(!v1.error && (v1.data || []).length === 0, "Visitor reads the exhibitions table for QA exhibitions (public, alias, and the rest)", "nothing", v1.error ? err(v1.error) : `${(v1.data || []).length} rows`);
    const v2 = await V.from("galleries").select("id,profile_id").limit(5);
    rec(!v2.error && (v2.data || []).length === 0, "Visitor reads the exhibitions table without a filter", "nothing at all", v2.error ? err(v2.error) : `${(v2.data || []).length} rows`);
    const b1 = await B.from("galleries").select("id,profile_id").in("id", qa);
    rec(!b1.error && (b1.data || []).length === 0, "Unrelated signed-in account reads A's exhibitions from the table", "nothing", b1.error ? err(b1.error) : `${(b1.data || []).length} rows`);
    const a1 = await A.from("galleries").select("id,profile_id,item_notes").in("id", qa);
    rec(!a1.error && (a1.data || []).length === 5 && a1.data.every((g) => g.profile_id === P), "Owner A still reads all five of their exhibitions from the table (public, alias, private, guest-only, draft), with full rows", "5 rows with profile_id", a1.error ? err(a1.error) : `${(a1.data || []).length} rows`);
    const b2 = await B.from("galleries").select("id,profile_id");
    rec(!b2.error && (b2.data || []).every((g) => g.profile_id === m.k.profileId), "Unrelated account B's own table read returns only B's own exhibitions", "none of anyone else's", b2.error ? err(b2.error) : `${(b2.data || []).length} rows, all B's=${(b2.data || []).every((g) => g.profile_id === m.k.profileId)}`);
    // ---- the public view still serves public pages
    for (const [who, cl] of [["visitor", V], ["unrelated account", B], ["owner", A]]) {
      const x = await cl.from("public_galleries").select("id,profile_id,alias_enabled").in("id", qa);
      const got = (x.data || []).map((g) => Object.entries(ids).find(([, v]) => v === g.id)[0]).sort().join("|");
      rec(!x.error && got === "alias|plain" && (x.data || []).find((g) => g.alias_enabled).profile_id === null, `Public view as ${who}: the public QA exhibitions, the alias one without a profile id`, "alias|plain, alias profile_id null", x.error ? err(x.error) : got);
    }
    const nPub = (await V.from("public_galleries").select("id", { count: "exact", head: true })).count, nTbl = (await admin.from("galleries").select("id", { count: "exact", head: true }).eq("visibility", "PUBLIC").eq("state", "ACTIVE")).count;
    rec(nPub === nTbl, "The view still lists every public exhibition in the account", `${nTbl}`, `${nPub}`);
    // ---- items of exhibitions
    const cnt = async (cl, k) => (await cl.from("gallery_items").select("id", { count: "exact", head: true }).eq("gallery_id", gid(k))).count;
    for (const k of ["plain", "alias"]) rec((await cnt(V, k)) === items.length, `Visitor reads the items of the public ${k} exhibition`, `${items.length}`, `${await cnt(V, k)}`);
    for (const k of ["private", "guest", "draft"]) rec((await cnt(V, k)) === 0 && (await cnt(B, k)) === 0, `Visitor and unrelated account read none of the ${k} exhibition's items`, "0", `visitor ${await cnt(V, k)}; B ${await cnt(B, k)}`);
    rec((await cnt(A, "private")) === items.length, "Owner reads their private exhibition's items", `${items.length}`, `${await cnt(A, "private")}`);
    // ---- link functions
    const sh = async (cl, t) => (await cl.rpc("get_gallery_by_share_token", { p_token: t })).data || [];
    const sa = (await sh(V, tok("alias")))[0];
    rec(sa && sa.profile_id === null && JSON.stringify(sa.item_notes) === "[]" && sa.analytics_unique_view_keys === null, "Share link (visitor): alias exhibition still works and is sanitised", "profile id empty, no notes, no keys", sa ? `profile_id=${sa.profile_id}; notes=${JSON.stringify(sa.item_notes)}; keys=${sa.analytics_unique_view_keys}` : "no row");
    rec((await sh(V, tok("plain"))).length === 1 && (await sh(B, tok("private"))).length === 0 && (await sh(A, tok("private"))).length === 1, "Share link: ordinary works for a visitor; private only for the owner", "1 / 0 / 1", `${(await sh(V, tok("plain"))).length} / ${(await sh(B, tok("private"))).length} / ${(await sh(A, tok("private"))).length}`);
    // ---- writes by members unaffected; others still cannot write
    const up = await A.from("galleries").update({ description: "synthetic (edited by owner)" }).eq("id", gid("plain")).select("id");
    rec(!up.error && (up.data || []).length === 1, "Owner can still update their own exhibition", "1 row", up.error ? err(up.error) : `${(up.data || []).length}`);
    const upB = await B.from("galleries").update({ description: "forged" }).eq("id", gid("plain")).select("id");
    rec((upB.data || []).length === 0, "Unrelated account cannot update A's exhibition", "0 rows", upB.error ? err(upB.error) : `${(upB.data || []).length}`);
    // ---- events (stage 1) unaffected: the public check helper runs with owner rights
    await A.from("exhibition_events").insert([{ gallery_id: gid("plain"), profile_id: P, type: "published", metadata: { qa: "RB22" } }, { gallery_id: gid("alias"), profile_id: P, type: "published", metadata: { qa: "RB22" } }]);
    const ev = await V.from("exhibition_events").select("gallery_id").in("gallery_id", qa);
    rec(!ev.error && (ev.data || []).length === 1 && ev.data[0].gallery_id === gid("plain"), "Events still readable the stage-1 way: a visitor sees only the public alias-free exhibition's event", "plain only", ev.error ? err(ev.error) : `${(ev.data || []).length} rows`);
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await admin.from("exhibition_events").delete().in("gallery_id", Object.values(ids)); await admin.from("gallery_items").delete().in("gallery_id", Object.values(ids)); await admin.from("galleries").delete().in("id", Object.values(ids)); } catch {}
    fs.writeFileSync(path.join(EV, `rb22-stage4-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    process.exit(0);
  }
})();
