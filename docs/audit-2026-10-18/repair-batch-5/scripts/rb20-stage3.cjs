// RC-05 stage 3: the public-view consumers, verified on PRODUCTION with isolated QA exhibitions, as a signed-out visitor, an unrelated signed-in
// account (QA account B) and the owner (QA account A). QA content only; removed at the end. No real person is notified or affected.
//   AUDIT_MANIFEST=<manifest> node rb20-stage3.cjs <label> <before|after>
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const SD = path.join(__dirname, "..", "..", "scripts");
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const L = require(path.join(SD, "audit-lib.cjs"));
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { sleep, admin, P, ST, m } = X;
const LABEL = process.argv[2] || "run";
const PHASE = process.argv[3] || "after";
const AFTER = PHASE === "after";
const r = L.R("RB20");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, phase: PHASE, cases: [], facts: {} };
const REAL = "QA Real Collector Name", ALIAS = "QA Alias Curator";
const BASE = "https://vltd.app";
let S, n = 0;
const ids = {}; const gid = (k) => (ids[k] = ids[k] || crypto.randomUUID());
const tok = (k) => `qarb20${ST}${k}`;
async function rec(ok, control, expected, actual, page, shot = true) {
  let ev = ""; if (S && shot && page.startsWith("/")) { try { await sleep(250); ev = path.join(L.AUD, await S.jshot(`rb20-${LABEL}-${PHASE}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  if (AFTER) r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(L.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-05 stage 3", repro: "" });
  else console.log(ok ? "OK-NOW " : "FAILS  ", control, "|", String(actual).slice(0, 260));
}
// every response of the exhibitions table / public view seen by a browser session, with whether it names the alias exhibition's real profile
function tracer(sess) {
  const seen = new Map(); const results = [];
  sess.c.on((e) => { if (e.method === "Network.responseReceived") { const u = e.params.response.url; if (/\/rest\/v1\/(galleries|public_galleries)(\?|$)/.test(u)) seen.set(e.params.requestId, u); } });
  return {
    async take() {
      for (const [id, url] of [...seen]) {
        let body = ""; try { body = (await sess.send("Network.getResponseBody", { requestId: id })).body; } catch { continue; }
        let rows = []; try { const j = JSON.parse(body); rows = Array.isArray(j) ? j : j ? [j] : []; } catch {}
        results.push({ kind: /public_galleries/.test(url) ? "view" : "table", url: url.replace(/^https?:\/\/[^/]+/, "").slice(0, 90), rows: rows.length,
          aliasRealProfile: rows.some((x) => x && x.id === gid("alias") && x.profile_id === P), aliasRowSeen: rows.some((x) => x && x.id === gid("alias")), foreignRows: rows.some((x) => x && x.profile_id && x.profile_id !== P && x.id && !Object.values(ids).includes(x.id)) });
        seen.delete(id);
      }
      return results;
    },
    results,
  };
}
const body = async (x = S) => (await x.text()).replace(/\s+/g, " ");
const visit = async (sess, url, needle, ms = 45000) => { await sess.visit(url); await sess.waitFor(`document.body.innerText.includes(${JSON.stringify(needle)})`, ms, "page").catch(() => {}); await sleep(3000); };
const cache = (sess) => sess.evaluate(`(() => { try { const l = JSON.parse(localStorage.getItem('vltd_galleries') || '[]'); return Array.isArray(l) ? l.map((g) => ({ id: g.id, profile_id: g.profile_id || null, title: g.title })) : []; } catch { return null; } })()`);

(async () => {
  const ownGalleries = [];
  let hadPublic = null, hadFlags = null, hadUsername;
  const PB = m.k.profileId;
  try {
    const items = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("status", "COLLECTION").eq("is_public", false).like("id", "qa_vz_%").limit(2)).data.map((x) => x.id);
    hadPublic = (await admin.from("public_profiles").select("*").eq("profile_id", P).maybeSingle()).data;
    hadFlags = (await admin.from("profiles").select("is_public,onboarding_completed,username").eq("id", P).maybeSingle()).data;
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true, username: `qarb20${ST}` }).eq("id", P);
    await admin.from("public_profiles").upsert({ profile_id: P, display_name: REAL, bio: "synthetic QA profile" });
    const snap = (id, t) => ({ id, title: t, subtitle: "sub", number: "7", grade: "9.6", categoryLabel: "Comics", imageFrontUrl: "/collectibles/comic-slab.png", createdAt: 5 });
    const lay = { itemIds: items, themePack: "classic", displayMode: "grid", guestViewMode: "public", sections: [{ id: "s", title: "Exhibit 1", description: "", itemIds: items, slotLayout: [...items, null] }], publicItemSnapshots: items.map((id, i) => snap(id, `QA Card ${i + 1}`)) };
    const mk = (k, extra = {}) => ({ id: gid(k), profile_id: P, title: `QA RB20 ${k} ${ST}`, description: "synthetic", visibility: "PUBLIC", state: "ACTIVE", cover_image: "/collectibles/comic-slab.png", layout: lay, exhibition_layout: lay, public_token: tok(k), analytics_views: 9999000, alias_enabled: false, ...extra });
    const rows = [mk("plain"), mk("alias", { alias_enabled: true, alias_name: ALIAS }), mk("private", { visibility: "LOCKED", analytics_views: 0 }), mk("guest", { visibility: "INVITE", analytics_views: 0 }), mk("draft", { state: "STORAGE", analytics_views: 0 })];
    const ins = await admin.from("galleries").insert(rows); if (ins.error) throw new Error("seed: " + ins.error.message);
    ownGalleries.push(...Object.values(ids));
    await admin.from("gallery_items").insert(Object.keys(ids).flatMap((k) => items.map((it, i) => ({ gallery_id: ids[k], position: i + 1, artifact_id: it }))));
    const inv = `qarb20inv${ST}`; await admin.from("gallery_invites").insert({ token: inv, gallery_id: gid("guest") });
    // events and a follower, all QA (the follower is QA account B following QA profile A: no real person)
    await admin.from("follows").insert({ follower_id: PB, followed_id: P });
    await admin.from("exhibition_events").insert([{ gallery_id: gid("plain"), profile_id: P, type: "published", metadata: { title: "QA RB20 plain" } }, { gallery_id: gid("alias"), profile_id: P, type: "published", metadata: { title: "QA RB20 alias" } }]);

    // ============ 1. signed-out visitor
    S = await X.S_("visitor", { width: 1440, height: 900 });
    let tr = tracer(S);
    await S.send("Network.enable").catch(() => {});
    await visit(S, "/discover", "QA RB20");
    const card = (title) => S.evaluate(`(() => { const e = [...document.querySelectorAll('*')].find((x) => x.children.length === 0 && (x.textContent || '').trim() === ${JSON.stringify(title)}); let c = e; for (let i = 0; i < 8 && c; i++) { c = c.parentElement; if (c && /\\bby\\b/.test(c.innerText || '') && (c.innerText || '').length < 600) return c.innerText.replace(/\\s+/g, ' '); } return e ? 'title found, no by-line' : ''; })()`);
    const ca = await card(`QA RB20 alias ${ST}`), cp = await card(`QA RB20 plain ${ST}`);
    const dpage = await body();
    await rec(ca.includes(ALIAS) && !ca.includes(REAL), "Discover (visitor): the exhibition under an alias", `shown under "${ALIAS}", never "${REAL}"`, `card: ${ca.slice(0, 160)}`, "/discover");
    await rec(cp.includes(REAL), "Discover (visitor): an exhibition without an alias still shows the real collector", REAL, `card: ${cp.slice(0, 160)}`, "/discover");
    await rec(!["private", "guest", "draft"].some((k) => dpage.includes(`QA RB20 ${k} ${ST}`)), "Discover (visitor): private, guest-only and draft exhibitions are not listed", "none listed", `listed: ${["private", "guest", "draft"].filter((k) => dpage.includes(`QA RB20 ${k} ${ST}`)).join(",") || "none"}`, "/discover");
    let tres = await tr.take();
    await rec(tres.some((x) => x.kind === "view" && x.rows > 0), "Discover reads the exhibitions through the public view", "a response from public_galleries with rows", JSON.stringify(tres.map((x) => `${x.kind}:${x.rows}rows`)), "/discover", false);
    await rec(!tres.some((x) => x.kind === "view" && x.aliasRealProfile), "Discover: no response from the public view names the alias exhibition's real profile", "none", `view responses naming it: ${tres.filter((x) => x.kind === "view" && x.aliasRealProfile).length}`, "/discover", false);
    const tableNames = tres.filter((x) => x.kind === "table" && x.aliasRealProfile).length;
    out.facts.discoverTableResponsesNamingAliasProfile = tableNames;
    await rec(tableNames === 0, "Discover: no response from the exhibitions TABLE names it either", "none", `table responses naming it: ${tableNames}`, "/discover", false);
    // other pages as the same visitor (so the cache check covers the whole visit)
    await visit(S, `/museum/${gid("alias")}/guest`, "QA RB20 alias");
    let t = await body();
    await rec(t.includes("QA RB20 alias") && t.includes(ALIAS) && !t.includes(REAL), "Guest page of an alias exhibition (visitor)", "renders under the alias; real name nowhere", `title=${t.includes("QA RB20 alias")}; alias=${t.includes(ALIAS)}; real name on page=${t.includes(REAL)}`, "/museum/[galleryId]/guest");
    await visit(S, `/museum/${gid("plain")}/guest`, "QA RB20 plain");
    t = await body();
    await rec(t.includes("QA RB20 plain") && t.includes("QA Card 1"), "Guest page of an ordinary public exhibition (visitor): its items render", "title and cards", `title=${t.includes("QA RB20 plain")}; card=${t.includes("QA Card 1")}`, "/museum/[galleryId]/guest");
    for (const k of ["private", "draft", "guest"]) {
      await visit(S, `/museum/${gid(k)}/guest`, "zzzz", 9000);
      t = await body();
      await rec(!t.includes(`QA RB20 ${k} ${ST}`), `Guest page of a ${k} exhibition (visitor)`, "not shown", `title shown=${t.includes(`QA RB20 ${k} ${ST}`)}`, "/museum/[galleryId]/guest");
    }
    await visit(S, `/museum/share/${tok("alias")}`, "QA RB20 alias");
    t = await body();
    await rec(t.includes("QA RB20 alias") && t.includes(ALIAS) && !t.includes(REAL), "Share-link page of an alias exhibition (visitor)", "renders under the alias", `title=${t.includes("QA RB20 alias")}; alias=${t.includes(ALIAS)}; real=${t.includes(REAL)}`, "/museum/share/[token]");
    await visit(S, `/museum/share/${tok("plain")}`, "QA RB20 plain");
    t = await body();
    await rec(t.includes("QA RB20 plain") && t.includes("QA Card 1"), "Share-link page of an ordinary exhibition (visitor)", "title and cards", `title=${t.includes("QA RB20 plain")}; card=${t.includes("QA Card 1")}`, "/museum/share/[token]");
    await visit(S, `/museum/share/${tok("private")}`, "zzzz", 9000);
    t = await body(); await rec(!t.includes(`QA RB20 private ${ST}`), "Share-link page of a private exhibition (visitor)", "not shown", `shown=${t.includes(`QA RB20 private ${ST}`)}`, "/museum/share/[token]");
    // public home: the featured exhibition (a real, public, existing one) is still there
    const featTok = "pub_mr6nb8k6_vp2iwm7i";
    const feat = (await admin.from("galleries").select("title").eq("public_token", featTok).eq("visibility", "PUBLIC").maybeSingle()).data;
    out.facts.featuredExhibitionExists = !!feat;
    await visit(S, "/", feat ? feat.title : "VLTD");
    t = await body();
    await rec(feat ? t.includes(feat.title) : true, "Public home (visitor): the featured exhibition card", feat ? "its title is on the page" : "(no featured exhibition exists; nothing to show)", feat ? `featured title on page=${t.includes(feat.title)}` : "n/a", "/");
    tres = await tr.take();
    const visitorCache = await cache(S);
    const qaInCache = (visitorCache || []).filter((g) => Object.values(ids).includes(g.id));
    await rec(qaInCache.length === 0, "Visitor's browser storage after the whole visit: no exhibition of anyone else is stored", "none of the QA exhibitions in the visitor's local exhibition list", `stored: ${qaInCache.map((g) => `${g.title.slice(0, 26)}(profile ${g.profile_id ? g.profile_id.slice(0, 8) : "none"})`).join("; ") || "none"}; total stored ${visitorCache ? visitorCache.length : "unreadable"}`, "/ (browser storage)", false);
    const aliasStoredWithRealId = qaInCache.some((g) => g.id === gid("alias") && g.profile_id === P);
    await rec(!aliasStoredWithRealId, "Visitor's browser storage never holds the alias exhibition together with the real profile id", "not stored", `alias exhibition stored with the real profile id=${aliasStoredWithRealId}`, "/ (browser storage)", false);
    await S.close();

    // ============ 2. preview images and page titles (server side)
    const get = async (p) => { const res = await fetch(BASE + p, { redirect: "follow" }); return { status: res.status, type: res.headers.get("content-type") || "", text: /image/.test(res.headers.get("content-type") || "") ? "" : await res.text() }; };
    const ga = await get(`/museum/${gid("alias")}/guest`), gp = await get(`/museum/${gid("plain")}/guest`);
    const metaOf = (h) => (h.match(/<title>[^<]*<\/title>|property="og:[^"]*" content="[^"]*"|name="description" content="[^"]*"/g) || []).join(" | ");
    await rec(ga.status === 200 && ga.text.includes(ALIAS) && !ga.text.includes(REAL), "Guest page title / preview text (alias exhibition)", "mentions the alias, never the real collector", `status ${ga.status}; alias in head=${ga.text.includes(ALIAS)}; real name in the page source=${ga.text.includes(REAL)}; ${metaOf(ga.text).slice(0, 160)}`, "/museum/[galleryId]/guest (server)", false);
    await rec(gp.status === 200 && gp.text.includes("QA RB20 plain"), "Guest page title / preview text (ordinary exhibition)", "its title", `status ${gp.status}; title in head=${gp.text.includes("QA RB20 plain")}`, "/museum/[galleryId]/guest (server)", false);
    const sa = await get(`/museum/share/${tok("alias")}`);
    await rec(sa.status === 200 && sa.text.includes(ALIAS) && !sa.text.includes(REAL), "Share link title / preview text (alias exhibition)", "mentions the alias, never the real collector", `status ${sa.status}; alias=${sa.text.includes(ALIAS)}; real name in source=${sa.text.includes(REAL)}`, "/museum/share/[token] (server)", false);
    for (const [label, p] of [["guest page, alias exhibition", `/museum/${gid("alias")}/guest/opengraph-image`], ["guest page, ordinary exhibition", `/museum/${gid("plain")}/guest/opengraph-image`], ["share link, alias exhibition", `/museum/share/${tok("alias")}/opengraph-image`], ["share link, ordinary exhibition", `/museum/share/${tok("plain")}/opengraph-image`], ["Discover", "/discover/opengraph-image"], ["collector profile", `/u/qarb20${ST}/opengraph-image`]]) {
      const x = await get(p);
      await rec(x.status === 200 && /image\/png/.test(x.type), `Preview image: ${label}`, "200 image/png", `${x.status} ${x.type}`, p + " (server)", false);
    }

    // ============ 3. unrelated signed-in account B: pages, follower feed, and what B's browser stores
    S = await X.S_("viewer", { width: 1440, height: 900 });
    tr = tracer(S);
    await S.send("Network.enable").catch(() => {});
    await visit(S, "/discover", "QA RB20");
    const cb = await card(`QA RB20 alias ${ST}`);
    await rec(cb.includes(ALIAS) && !cb.includes(REAL), "Discover (signed-in unrelated account): the alias exhibition shows the alias", ALIAS, `card: ${cb.slice(0, 140)}`, "/discover");
    await visit(S, `/museum/${gid("alias")}/guest`, "QA RB20 alias");
    t = await body(); await rec(t.includes(ALIAS) && !t.includes(REAL), "Guest page of the alias exhibition (signed-in unrelated account)", "alias, no real name", `alias=${t.includes(ALIAS)}; real=${t.includes(REAL)}`, "/museum/[galleryId]/guest");
    await visit(S, `/museum/share/${tok("plain")}`, "QA RB20 plain");
    t = await body(); await rec(t.includes("QA RB20 plain") && t.includes("QA Card 1"), "Share-link page (signed-in unrelated account)", "title and cards", `ok=${t.includes("QA Card 1")}`, "/museum/share/[token]");
    await visit(S, `/museum/invite/${inv}`, "QA RB20 guest");
    t = await body(); await rec(t.includes("QA RB20 guest") && t.includes("QA Card 1"), "Invite-link page (signed-in unrelated account)", "title and cards", `ok=${t.includes("QA RB20 guest")}`, "/museum/invite/[token]");
    await visit(S, "/notifications", "QA RB20");
    t = await body();
    out.facts.feedText = t.slice(0, 400);
    await rec(t.includes("QA RB20 plain") && !t.includes("QA RB20 alias"), "Follower feed (QA account B follows QA profile A): the ordinary exhibition's event is listed, the alias exhibition's is not", "plain listed; alias not", `plain=${t.includes("QA RB20 plain")}; alias=${t.includes("QA RB20 alias")}`, "/notifications");
    // an older version stored other people's public exhibitions in this cache: plant one stale copy, as it would be left behind
    const STALE = crypto.randomUUID();
    await S.evaluate(`(() => { const l = JSON.parse(localStorage.getItem('vltd_galleries') || '[]'); l.push({ id: ${JSON.stringify(STALE)}, profile_id: ${JSON.stringify(P)}, title: 'QA RB20 stale foreign copy', description: '', visibility: 'PUBLIC', state: 'ACTIVE', layout: { itemIds: [] }, createdAt: Date.now(), updatedAt: Date.now() }); localStorage.setItem('vltd_galleries', JSON.stringify(l)); return true; })()`);
    await visit(S, "/museum", "Exhibition", 30000); await sleep(5000);
    t = await body();
    await rec(!Object.keys(ids).some((k) => t.includes(`QA RB20 ${k} ${ST}`)), "Signed-in unrelated account: its own Exhibitions list shows none of QA account A's exhibitions", "none listed", `listed: ${Object.keys(ids).filter((k) => t.includes(`QA RB20 ${k} ${ST}`)).join(",") || "none"}`, "/museum");
    const bCache = await cache(S);
    const adopted = (bCache || []).filter((g) => Object.values(ids).includes(g.id) && g.profile_id === PB);
    const foreign = (bCache || []).filter((g) => Object.values(ids).includes(g.id));
    await rec(adopted.length === 0, "Cache ownership: none of A's exhibitions is stored in B's browser as B's own", "0 stored under B's profile id", `adopted as B's: ${adopted.length}; stored at all: ${foreign.map((g) => `${g.title.slice(0, 24)}(profile ${g.profile_id ? g.profile_id.slice(0, 8) : "none"})`).join("; ") || "none"}`, "/ (browser storage)", false);
    out.facts.foreignRowsCachedForSignedInViewer = foreign.length;
    await rec(foreign.length === 0, "Cache ownership: B's browser stores NO exhibition of A at all (public pages read the view and keep nothing)", "none stored", `stored: ${foreign.map((g) => g.title.slice(0, 24)).join("; ") || "none"}`, "/ (browser storage)", false);
    const staleLeft = (bCache || []).filter((g) => g.id === STALE).length;
    await rec(staleLeft === 0, "Cache ownership: a stale copy of someone else's public exhibition left by an older version is removed from B's browser", "removed", `still stored: ${staleLeft}`, "/ (browser storage)", false);
    const dbOwners = (await admin.from("galleries").select("id,profile_id").in("id", Object.values(ids))).data;
    await rec(dbOwners.every((g) => g.profile_id === P), "Cache ownership: after B's whole visit every QA exhibition still belongs to A in the account (nothing was uploaded under B)", "all A's", `owners: ${[...new Set(dbOwners.map((g) => g.profile_id === P ? "A" : g.profile_id))].join(",")}`, "database", false);
    tres = await tr.take();
    out.facts.signedInViewerTableResponsesNamingAliasProfile = tres.filter((x) => x.kind === "table" && x.aliasRealProfile).length;
    await S.close();

    // ============ 4. owner A: own exhibitions in every state
    S = await X.S_("owner", { width: 1440, height: 900 });
    await visit(S, "/museum", "QA RB20", 45000); await sleep(4000);
    t = await body();
    await rec(["plain", "alias", "private", "guest"].every((k) => t.includes(`QA RB20 ${k} ${ST}`)) && !t.includes(`QA RB20 draft ${ST}`), "Owner: the Exhibitions list shows their public, alias, private and guest-only exhibitions (a draft is archived and not listed, as designed)", "four listed, the draft not", `listed: ${["plain", "alias", "private", "guest", "draft"].filter((k) => t.includes(`QA RB20 ${k} ${ST}`)).join(",")}`, "/museum");
    await visit(S, `/museum/${gid("alias")}`, "QA RB20 alias");
    t = await body(); await rec(t.includes("QA RB20 alias") && /Use an alias/.test(t), "Owner: builder of the alias exhibition opens with the alias control", "opens", `title=${t.includes("QA RB20 alias")}; alias control=${/Use an alias/.test(t)}`, "/museum/[galleryId]");
    await visit(S, `/museum/${gid("private")}/guest`, "QA RB20 private");
    t = await body(); await rec(t.includes(`QA RB20 private ${ST}`), "Owner: guest preview of their own private exhibition", "renders for the owner", `title=${t.includes(`QA RB20 private ${ST}`)}`, "/museum/[galleryId]/guest");
    const oCache = await cache(S);
    const own = (oCache || []).filter((g) => Object.values(ids).includes(g.id));
    await rec(own.length >= 4 && own.every((g) => g.profile_id === P), "Owner's browser storage holds their own exhibitions under their own profile", "all under A", `stored ${own.length}; all under A=${own.every((g) => g.profile_id === P)}`, "/ (browser storage)", false);
    await visit(S, "/vault/halls", "Hall", 20000);
    t = await body(); await rec(t.length > 200, "Owner: another own-exhibition screen (Halls) still loads", "loads", `page text length ${t.length}`, "/vault/halls");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 700); }
  finally {
    try {
      await admin.from("follows").delete().eq("follower_id", PB).eq("followed_id", P);
      if (ownGalleries.length) { await admin.from("exhibition_events").delete().in("gallery_id", ownGalleries); await admin.from("gallery_invites").delete().in("gallery_id", ownGalleries); await admin.from("gallery_items").delete().in("gallery_id", ownGalleries); await admin.from("galleries").delete().in("id", ownGalleries); }
      if (hadPublic) await admin.from("public_profiles").upsert(hadPublic); else await admin.from("public_profiles").delete().eq("profile_id", P);
      if (hadFlags) await admin.from("profiles").update(hadFlags).eq("id", P);
    } catch {}
    fs.writeFileSync(path.join(EV, `rb20-stage3-${LABEL}-${PHASE}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    console.log("facts", JSON.stringify(out.facts).slice(0, 700));
    try { await S.close(); } catch {}
    process.exit(0);
  }
})();
