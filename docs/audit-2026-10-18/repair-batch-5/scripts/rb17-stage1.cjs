// RC-05 stage 1 verification on PRODUCTION with isolated synthetic exhibitions and two QA accounts. No real person is involved:
// the QA profiles have no followers (checked), events are plain rows, and everything created here is removed at the end.
//   AUDIT_MANIFEST=<manifest> node rb17-stage1.cjs <label>
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const SD = path.join(__dirname, "..", "..", "scripts");
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const L = require(path.join(SD, "audit-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { mclick, byText, byLabel, sleep, admin, P, ST, m } = X;
const LABEL = process.argv[2] || "run";
const r = L.R("RB16");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], facts: {} };
let S, n = 0;
const ids = {};
const gid = (k) => (ids[k] = ids[k] || crypto.randomUUID());
async function rec(ok, control, expected, actual, page = "database (signed-in QA accounts / visitor)") {
  let shot = ""; if (S) { try { await sleep(250); shot = path.join(L.AUD, await S.jshot(`rb16-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: shot });
  r.check(!!ok, { page, control, expected, actual, evidence: shot ? path.relative(L.AUD, shot).replace(/\\/g, "/") : "", impact: "RC-05 stage 1", repro: "" });
}
const client = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const err = (e) => (e ? `${e.code} ${String(e.message).slice(0, 90)}` : "accepted");
const evRows = async (cl) => { const x = await cl.from("exhibition_events").select("gallery_id,type").in("gallery_id", Object.values(ids)); return x.error ? { error: x.error } : { rows: x.data }; };
const names = (rows) => { const byId = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k])); return [...new Set(rows.map((x) => byId[x.gallery_id]))].sort().join("|"); };

(async () => {
  const A = client(), B = client(), V = client();
  try {
    const sa = await A.auth.signInWithPassword({ email: m.email, password: m.password }); if (sa.error) throw new Error("A sign-in: " + sa.error.message);
    const sb = await B.auth.signInWithPassword({ email: m.k.email, password: m.k.password }); if (sb.error) throw new Error("B sign-in: " + sb.error.message);
    const PB = m.k.profileId;
    // nobody can be notified: no followers on either QA profile, and the table holds no real rows
    const f1 = (await admin.from("follows").select("*", { count: "exact", head: true }).eq("followed_id", P)).count;
    const f2 = (await admin.from("follows").select("*", { count: "exact", head: true }).eq("followed_id", PB)).count;
    const evBefore = (await admin.from("exhibition_events").select("*", { count: "exact", head: true })).count;
    out.facts = { followersOfQaProfileA: f1, followersOfQaProfileB: f2, eventsInAccountBefore: evBefore, qaProfileA: P.slice(0, 8), qaProfileB: PB.slice(0, 8) };
    console.log("facts", JSON.stringify(out.facts));
    if (f1 !== 0 || f2 !== 0) throw new Error("a QA profile has followers: stopping");
    // ---- is stage 1 in place? (stage 1 is applied by the owner of the account; the probe decides)
    const items = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("status", "COLLECTION").like("id", "qa_vz_%").limit(3)).data.map((x) => x.id);
    const mk = (k, owner, extra = {}) => { const sec = { id: "s" + k, title: "Exhibit 1", description: "", itemIds: items, slotLayout: [...items, null] }; return { id: gid(k), profile_id: owner, title: `QA RB16 ${k} ${ST}`, description: "synthetic", visibility: "PUBLIC", state: "ACTIVE", cover_image: "/collectibles/comic-slab.png", layout: { itemIds: items, themePack: "classic", displayMode: "grid", guestViewMode: "public", sections: [sec] }, exhibition_layout: { itemIds: items, sections: [sec] }, public_token: `qarb16${ST}${k}`, alias_enabled: false, ...extra }; };
    const rows = [mk("public", P), mk("alias", P, { alias_enabled: true, alias_name: "QA Alias Curator" }), mk("private", P, { visibility: "LOCKED" }), mk("guest", P, { visibility: "INVITE", layout: { itemIds: items, guestViewMode: "guest", sections: [] } }), mk("draft", P, { state: "STORAGE" }), mk("bobs", PB)];
    const ins = await admin.from("galleries").insert(rows); if (ins.error) throw new Error("seed: " + ins.error.message);
    const seeded = (await admin.from("galleries").select("id,visibility,state,alias_enabled,profile_id").in("id", Object.values(ids))).data;
    out.facts.seeded = Object.fromEntries(seeded.map((g) => [Object.entries(ids).find(([, v]) => v === g.id)[0], `${g.visibility}/${g.state}/alias=${g.alias_enabled}/${g.profile_id === P ? "A" : "B"}`]));
    console.log("seeded", JSON.stringify(out.facts.seeded));
    const record = (cl, profile, gallery, type = "announced") => cl.from("exhibition_events").insert({ gallery_id: gallery, profile_id: profile, type, metadata: { qa: "RB16 stage-1 check, no followers" } });

    // ---- 1. a member records events for their own exhibitions
    const own = {};
    for (const k of ["public", "alias", "private", "guest", "draft"]) own[k] = (await record(A, P, gid(k), k === "public" ? "announced" : "published")).error;
    const probeFirst = own.public;
    if (probeFirst && probeFirst.code === "42501") { await rec(false, "Stage 1 is in place", "the owner can record an event for their own exhibition", `still refused: ${err(probeFirst)}. Stage 1 has not been applied to this account (or did not take effect); stopping`); throw new Error("STAGE1-NOT-APPLIED"); }
    await rec(Object.values(own).every((e) => !e), "Owner records an event for each of their own exhibitions (public, alias, private, guest-only, draft)", "all five accepted (a member may record for their own exhibitions; what visitors can read is decided at read time)", Object.entries(own).map(([k, e]) => `${k}: ${err(e)}`).join("; "));
    const bOwn = await record(B, PB, gid("bobs"), "published");
    await rec(!bOwn.error, "Second QA account records an event for its own exhibition (control)", "accepted", err(bOwn.error));

    // ---- 2. forged / cross-account events
    const forged = {
      "A's profile + B's exhibition": await record(A, P, gid("bobs")),
      "B's profile (A is not a member) + B's exhibition": await record(A, PB, gid("bobs")),
      "B's profile (A is not a member) + A's exhibition": await record(A, PB, gid("public")),
      "A's profile + an exhibition that does not exist": await record(A, P, crypto.randomUUID()),
      "A's profile + a malformed exhibition id": await record(A, P, "not-a-uuid"),
      "B (unrelated to A) + A's profile + A's exhibition": await record(B, P, gid("public")),
      "B + B's profile + A's exhibition": await record(B, PB, gid("public")),
      "B + A's profile + B's exhibition": await record(B, P, gid("bobs")),
      "visitor (not signed in) + A's profile + A's exhibition": await record(V, P, gid("public")),
    };
    for (const [k, v] of Object.entries(forged)) await rec(!!v.error, `Forged event refused: ${k}`, "refused, no row written", err(v.error));
    const totalNow = (await admin.from("exhibition_events").select("*", { count: "exact", head: true })).count;
    await rec(totalNow === evBefore + 6, "Only the six legitimate events exist after all forgery attempts", `${evBefore} + 6 rows (five own events + the control)`, `rows in the account now: ${totalNow}`);

    // ---- 3. what each reader can see
    const pubOnly = "bobs|public";
    const aR = await evRows(A), bR = await evRows(B), vR = await evRows(V);
    await rec(!vR.error && names(vR.rows) === pubOnly, "Visitor reads events: only the public, alias-free exhibitions", `public (A) and bobs (B); never alias, private, guest-only or draft`, `visitor sees: ${vR.error ? err(vR.error) : names(vR.rows)}`);
    await rec(!bR.error && names(bR.rows) === pubOnly, "Unrelated signed-in account reads events: same as a visitor", pubOnly, `account B sees (it is not a member of A): ${bR.error ? err(bR.error) : names(bR.rows)}`);
    await rec(!aR.error && ["alias", "draft", "guest", "private", "public", "bobs"].every((k) => names(aR.rows).split("|").includes(k)), "Owner reads their own events (all states) plus public ones", "A sees all five of their own events (and B's public one)", `A sees: ${aR.error ? err(aR.error) : names(aR.rows)}`);
    const exposed = (vR.rows || []).filter((x) => ["alias", "private", "guest", "draft"].some((k) => x.gallery_id === gid(k)));
    await rec(exposed.length === 0, "No alias / private / guest-only / draft event reaches a visitor (direct database read)", "0 exposed", `${exposed.length} exposed`);

    // ---- 4. changing an exhibition's state changes event visibility at once
    const flip = async (patch, back, label, expectHidden) => {
      await admin.from("galleries").update(patch).eq("id", gid("public"));
      const v = await evRows(V), b = await evRows(B);
      const hidden = !names(v.rows).split("|").includes("public") && !names(b.rows).split("|").includes("public");
      await rec(hidden === expectHidden, `Switching the exhibition to ${label}: its event is ${expectHidden ? "hidden from visitors and other accounts at once" : "visible again"}`, expectHidden ? "hidden" : "visible", `visitor sees: ${names(v.rows)}; account B sees: ${names(b.rows)}`);
      await admin.from("galleries").update(back).eq("id", gid("public"));
    };
    await flip({ visibility: "LOCKED" }, { visibility: "PUBLIC" }, "Private", true);
    await flip({ visibility: "INVITE" }, { visibility: "PUBLIC" }, "Guest View / Registered", true);
    await flip({ state: "STORAGE" }, { state: "ACTIVE" }, "draft", true);
    await flip({ alias_enabled: true, alias_name: "QA Alias" }, { alias_enabled: false, alias_name: null }, "alias on", true);
    const v2 = await evRows(V); await rec(names(v2.rows) === pubOnly, "Back to public without an alias: the event is visible again", pubOnly, `visitor sees: ${names(v2.rows)}`);
    const aOwnPrivate = await (async () => { await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", gid("public")); const x = await evRows(A); await admin.from("galleries").update({ visibility: "PUBLIC" }).eq("id", gid("public")); return x; })();
    await rec(names(aOwnPrivate.rows).split("|").includes("public"), "While Private the owner still reads their own event", "yes", `A sees: ${names(aOwnPrivate.rows)}`);

    // ---- 5. nobody can edit or delete an event; helper functions cannot be used to probe ownership
    const anyEv = (await admin.from("exhibition_events").select("id").in("gallery_id", Object.values(ids)).limit(1)).data[0].id;
    const up = await A.from("exhibition_events").update({ type: "published" }).eq("id", anyEv).select();
    await rec(!!up.error || (up.data || []).length === 0, "Owner cannot edit an event", "refused or no row changed", up.error ? err(up.error) : `rows changed: ${(up.data || []).length}`);
    const del = await A.from("exhibition_events").delete().eq("id", anyEv).select();
    await rec(!!del.error || (del.data || []).length === 0, "Owner cannot delete an event", "refused or no row deleted", del.error ? err(del.error) : `rows deleted: ${(del.data || []).length}`);
    const upV = await V.from("exhibition_events").update({ type: "published" }).eq("id", anyEv).select();
    await rec(!!upV.error || (upV.data || []).length === 0, "Visitor cannot edit an event", "refused or no row changed", upV.error ? err(upV.error) : `rows changed: ${(upV.data || []).length}`);
    const delV = await V.from("exhibition_events").delete().eq("id", anyEv).select();
    await rec(!!delV.error || (delV.data || []).length === 0, "Visitor cannot delete an event", "refused or no row deleted", delV.error ? err(delV.error) : `rows deleted: ${(delV.data || []).length}`);
    const pr = await B.rpc("can_record_exhibition_event", { p_gallery_id: gid("alias"), p_profile: P });
    await rec(!pr.error && pr.data === false, "Unrelated account asks 'does this alias exhibition belong to this profile?'", "always false (cannot be used to find who owns an alias exhibition)", pr.error ? err(pr.error) : `answer: ${pr.data}`);
    const prV = await V.rpc("can_record_exhibition_event", { p_gallery_id: gid("alias"), p_profile: P });
    await rec(!!prV.error, "Visitor cannot call the ownership helper at all", "refused", err(prV.error));
    const pubH = await V.rpc("exhibition_events_are_public", { p_gallery_id: gid("alias") });
    await rec(!pubH.error && pubH.data === false, "The public-check helper says false for an alias exhibition (same as for a missing one)", "false", pubH.error ? err(pubH.error) : `answer: ${pubH.data}`);

    // ---- 6. the site: Announce and Make public now record events (QA profile has 0 followers)
    S = await X.S_("owner", { width: 1440, height: 900 });
    const open = async (k) => { await S.visit(`/museum/${gid(k)}`); await S.waitFor(`document.body.innerText.includes('QA RB16 ${k}')`, 60000, "builder").catch(() => {}); await sleep(5000); };
    await admin.from("exhibition_events").delete().in("gallery_id", [gid("guest")]);
    await open("guest");
    const e0 = (await admin.from("exhibition_events").select("*", { count: "exact", head: true }).eq("gallery_id", gid("guest"))).count;
    await mclick(S, byText("Announce", "button")); await sleep(1200);
    const btn = await S.evaluate(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).find(t => /Announc/.test(t))`);
    await sleep(2500);
    const e1 = (await admin.from("exhibition_events").select("*", { count: "exact", head: true }).eq("gallery_id", gid("guest"))).count;
    await rec(/Announced/.test(btn || "") && e1 === e0 + 1, "Site: Announce on a synthetic exhibition", "'✓ Announced' and exactly one event row", `button '${btn}'; rows ${e0} -> ${e1}`, "/museum/[galleryId]");
    await open("private");
    const p0 = (await admin.from("exhibition_events").select("*", { count: "exact", head: true }).eq("gallery_id", gid("private"))).count;
    await mclick(S, byText("^Public Exhibit$", "button")); await sleep(800);
    await mclick(S, byText("^Make public$", "button")); await sleep(5000);
    const g = (await admin.from("galleries").select("visibility").eq("id", gid("private")).maybeSingle()).data;
    const p1 = (await admin.from("exhibition_events").select("type").eq("gallery_id", gid("private"))).data;
    const pageT = (await S.text()).replace(/\s+/g, " ");
    await rec(g.visibility === "PUBLIC" && p1.length === p0 + 1 && !/followers were not notified/.test(pageT), "Site: Make public records the follower notice and says nothing is wrong", "exhibition public, one 'published' event row, no 'not notified' message", `visibility ${g.visibility}; event rows ${p0} -> ${p1.length} (${p1.map((x) => x.type).join(",")}); 'not notified' message shown: ${/followers were not notified/.test(pageT)}`, "/museum/[galleryId]");
    const vAfter = await evRows(V);
    await rec(names(vAfter.rows).split("|").includes("private"), "That now-public exhibition's published event is visible to a visitor (it is public and has no alias)", "visible", `visitor sees: ${names(vAfter.rows)}`);
    await open("alias");
    const a0 = (await admin.from("exhibition_events").select("*", { count: "exact", head: true }).eq("gallery_id", gid("alias")).eq("type", "announced")).count;
    await mclick(S, byText("Announce", "button")); await sleep(1500);
    const a1 = (await admin.from("exhibition_events").select("*", { count: "exact", head: true }).eq("gallery_id", gid("alias")).eq("type", "announced")).count;
    const vAlias = await evRows(V);
    await rec(a1 === a0 + 1 && !names(vAlias.rows).split("|").includes("alias"), "Site: Announce on an ALIAS exhibition works for the owner but the event stays invisible to visitors", "row written, not readable by a visitor", `announce rows ${a0} -> ${a1}; visitor sees: ${names(vAlias.rows)}`, "/museum/[galleryId]");
  } catch (e) { if (e.message !== "STAGE1-NOT-APPLIED") { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); } else out.error = "STAGE1-NOT-APPLIED"; }
  finally {
    try { await admin.from("exhibition_events").delete().in("gallery_id", Object.values(ids)); await admin.from("galleries").delete().in("id", Object.values(ids)); } catch {}
    const left = (await admin.from("exhibition_events").select("*", { count: "exact", head: true })).count;
    out.facts.eventsInAccountAfterCleanup = left;
    fs.writeFileSync(path.join(EV, `rb16-stage1-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | " + out.error : ""} | events left in account: ${left}`);
    try { await S.close(); } catch {}
    process.exit(0);
  }
})();
