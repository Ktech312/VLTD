// EXH suite 5: who can open an exhibition in each visibility state (rendered AND network/database), Guest View data, hidden items, invite links, view counter, /gallery redirect.
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, byLabel, byLabelRe, key, gdb, gItemIds, itemsOf } = X;
const { env, createClient } = require("./journey-lib.cjs");
const R = rows();
const m = man();
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
const A = ex.A;
const PUB = m.audit.publicGalleryId;
const MARK = 7777.77;
const id = (n) => `qa_vz_${m.stamp}_${n}`;
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
async function asUser(c) { const sb = anon(); const { error } = await sb.auth.signInWithPassword({ email: c.email, password: c.password }); if (error) throw error; return sb; }
const classify = (t, title) => {
  t = t.replace(/\s+/g, " ");
  if (/Link not available/.test(t)) return "link-not-available";
  if (/Exhibition not found/.test(t)) return "exhibition-not-found";
  if (/Private Exhibition/.test(t) && /cannot be viewed from a shared link/.test(t)) return "private-notice";
  if (/Owner only allows registered users/.test(t)) return "registered-gate";
  if (/Please confirm you are 18|18 or older/.test(t) && !t.includes(title)) return "adult-gate";
  if (t.includes(title)) return "renders";
  return "other:" + t.slice(0, 80);
};
async function readPage(S, path, wait = 7000) { await S.visit(path); await sleep(wait); return { path: await S.path(), text: (await S.text()).replace(/\s+/g, " ") }; }

(async () => {
  // ---------- fixture shaping (admin, own rows only)
  const pubIds = [6, 7, 8, 9, 10, 11].map(id);
  await admin.from("vault_items").update({ purchase_price: MARK }).in("id", pubIds.concat([1, 3, 4, 5].map(id)));
  await admin.from("vault_items").update({ is_public: true, current_value: 111 }).eq("id", id(6));
  await admin.from("vault_items").update({ is_public: true, current_value: 222 }).eq("id", id(7));
  const gp = await gdb(PUB);
  const lay = { ...gp.layout, publicItemSnapshots: (gp.layout.publicItemSnapshots || []).map((s) => (s.id === id(8) ? { id: id(8), title: "Hidden Item", hidden: true, createdAt: s.createdAt } : s)) };
  await admin.from("galleries").update({ layout: lay, alias_enabled: false, alias_name: null, analytics_views: 0, analytics_unique_view_keys: [], visibility: "PUBLIC", state: "ACTIVE" }).eq("id", PUB);
  const gA0 = await gdb(A); const tokA = gA0.public_token;
  const titleA = gA0.title;
  const setA = (patch, guestMode = "public") => admin.from("galleries").update({ ...patch, layout: { ...gA0.layout, guestViewMode: guestMode } }).eq("id", A);
  const privateTitles = ["QA Album 1 - ", "QA Album 3 - ", "QA Album 4 - ", "QA Album 5 - "];
  const states = [
    { name: "Private", patch: { visibility: "LOCKED", state: "ACTIVE" }, guest: "public", share: { visitor: "link-not-available", viewer: "link-not-available", owner: "private-notice" }, guestPage: { visitor: "exhibition-not-found", viewer: "exhibition-not-found", owner: "renders" }, rpcRows: 0 },
    { name: "Guest View", patch: { visibility: "INVITE", state: "ACTIVE" }, guest: "public", share: { visitor: "renders", viewer: "renders", owner: "renders" }, guestPage: { visitor: "exhibition-not-found", viewer: "exhibition-not-found", owner: "renders" }, rpcRows: 1 },
    { name: "Registered Users", patch: { visibility: "INVITE", state: "ACTIVE" }, guest: "guest", share: { visitor: "registered-gate", viewer: "renders", owner: "renders" }, guestPage: { visitor: "exhibition-not-found", viewer: "exhibition-not-found", owner: "renders" }, rpcRows: 1 },
    { name: "Public Exhibit", patch: { visibility: "PUBLIC", state: "ACTIVE" }, guest: "public", share: { visitor: "renders", viewer: "renders", owner: "renders" }, guestPage: { visitor: "renders", viewer: "renders", owner: "renders" }, rpcRows: 1 },
    { name: "Public but moved to Storage (draft)", patch: { visibility: "PUBLIC", state: "STORAGE" }, guest: "public", share: { visitor: "link-not-available", viewer: "link-not-available", owner: "renders" }, guestPage: { visitor: "exhibition-not-found", viewer: "exhibition-not-found", owner: "renders" }, rpcRows: 0 },
  ];
  const sbAnon = anon();
  const sbViewer = await asUser(m.k);
  for (const st of states) {
    await setA(st.patch, st.guest);
    const label = `/museum/share/[token] + /museum/[id]/guest | state: ${st.name} | exhibition 'QA Spare A', 4 items`;
    // ---- database / network level
    const rpcAnon = await sbAnon.rpc("get_gallery_by_share_token", { p_token: tokA });
    const rpcView = await sbViewer.rpc("get_gallery_by_share_token", { p_token: tokA });
    const itemsRpc = await sbAnon.rpc("get_gallery_items_by_share_token", { p_token: tokA });
    const direct = await sbAnon.from("galleries").select("id,title").eq("id", A);
    const directViewer = await sbViewer.from("galleries").select("id,title").eq("id", A);
    const gi = await sbAnon.from("gallery_items").select("artifact_id").eq("gallery_id", A);
    const expDirect = st.patch.visibility === "PUBLIC" && st.patch.state === "ACTIVE" ? 1 : 0;
    const rpcA = (rpcAnon.data || []).length, rpcV = (rpcView.data || []).length;
    R.check(rpcA === st.rpcRows && rpcV === st.rpcRows, { page: label, control: "Database: share-link lookup (get_gallery_by_share_token) as signed-out and as another user", expected: `${st.rpcRows} row(s) for ${st.name}`, actual: `signed-out ${rpcA}${rpcAnon.error ? " (" + rpcAnon.error.message + ")" : ""}; other user ${rpcV}`, impact: "privacy/data loss", repro: "Call the function with the exhibition's share token without being its owner" });
    R.check((itemsRpc.data || []).length === (st.rpcRows ? gItemIds(await gdb(A)).length : 0), { page: label, control: "Database: share-link item list (get_gallery_items_by_share_token), signed-out", expected: st.rpcRows ? "the exhibition's items" : "nothing", actual: `${(itemsRpc.data || []).length} rows`, impact: "privacy/data loss", repro: "Call the function with the token signed out" });
    R.check((direct.data || []).length === expDirect && (directViewer.data || []).length === expDirect, { page: label, control: "Database: direct read of the exhibition row (galleries) signed-out and as another user", expected: `${expDirect} row (only Public + Active exhibitions are readable)`, actual: `signed-out ${(direct.data || []).length}; other user ${(directViewer.data || []).length}`, impact: "privacy/data loss", repro: "Select the exhibition by id with the public key" });
    R.check((gi.data || []).length === expDirect * gItemIds(await gdb(A)).length, { page: label, control: "Database: direct read of the exhibition's item links (gallery_items), signed-out", expected: expDirect ? "readable for a Public Active exhibition" : "no rows", actual: `${(gi.data || []).length} rows`, impact: "privacy/data loss", repro: "Select gallery_items by gallery_id with the public key" });
    // ---- rendered per audience
    const kinds = { visitor: await session("visitor"), viewer: await session("viewer"), owner: await session("owner") };
    try {
      for (const [who, S] of Object.entries(kinds)) {
        const sh = await readPage(S, `/museum/share/${tokA}`);
        const k1 = classify(sh.text, titleA);
        const shot = k1 !== st.share[who] ? await S.jshot(`exh-access-share-${st.name.replace(/\W+/g, "-")}-${who}`) : "";
        R.check(k1 === st.share[who], { page: label, control: `Share link opened as ${who === "visitor" ? "a signed-out visitor" : who === "viewer" ? "an unrelated signed-in user" : "the owner"}`, expected: st.share[who], actual: k1, evidence: shot, impact: "privacy/data loss", repro: `Set the exhibition to ${st.name}; open /museum/share/<token> as ${who}` });
        if (k1 === "renders") {
          const leaks = [/7,?777/, /\bPaid\b/i, /Total Value|CURATED COST|Purchase/i].filter((re) => re.test(sh.text));
          const shown = privateTitles.filter((t) => sh.text.includes(t)).length;
          R.check(leaks.length === 0 && shown === 4, { page: label, control: `Share link content for ${who}: items shown and private data`, expected: "4 item titles from the exhibition's public record; no purchase cost / 'Paid' / curated cost", actual: `${shown} titles; leaks: ${leaks.map(String).join(",") || "none"}`, evidence: leaks.length ? await S.jshot(`exh-access-leak-${who}`) : "", impact: "privacy/data loss", repro: "Open the share link; look for cost" });
        }
        const gp2 = await readPage(S, `/museum/${A}/guest`, 6500);
        const k2 = classify(gp2.text, titleA);
        const shot2 = k2 !== st.guestPage[who] ? await S.jshot(`exh-access-guest-${st.name.replace(/\W+/g, "-")}-${who}`) : "";
        R.check(k2 === st.guestPage[who], { page: label, control: `/museum/[id]/guest opened as ${who === "visitor" ? "a signed-out visitor" : who === "viewer" ? "an unrelated signed-in user" : "the owner"}`, expected: st.guestPage[who], actual: k2, evidence: shot2, impact: "privacy/data loss", repro: `Open /museum/<id>/guest as ${who} while ${st.name}` });
      }
    } finally { for (const S of Object.values(kinds)) await S.close(); }
  }
  await setA({ visibility: "LOCKED", state: "ACTIVE" }, "public");

  // ---------- Regenerated token: old link must stop working
  const tk = JSON.parse(require("fs").readFileSync(__dirname + "/exh-tokens.json", "utf8"));
  await setA({ visibility: "INVITE", state: "ACTIVE" }, "public");
  const cur = (await gdb(A)).public_token;
  const oldR = await sbAnon.rpc("get_gallery_by_share_token", { p_token: tk.oldTokenA });
  const newR = await sbAnon.rpc("get_gallery_by_share_token", { p_token: cur });
  R.check((oldR.data || []).length === 0 && (newR.data || []).length === 1 && cur === tk.newTokenA, { page: "/museum/share/[token] | after 'Regenerate link' | Guest View", control: "Old share link after Regenerate", expected: "Old token returns nothing; the new token works", actual: `old ${(oldR.data || []).length} row(s); new ${(newR.data || []).length}`, impact: "privacy/data loss", repro: "Regenerate link; open the old URL signed out" });
  { const S = await session("visitor"); try { const p = await readPage(S, `/museum/share/${tk.oldTokenA}`, 6000); R.check(/Link not available/.test(p.text), { page: "/museum/share/[old token] | visitor", control: "Old share URL rendered", expected: "Link not available", actual: classify(p.text, titleA), evidence: await S.jshot("exh-access-old-token"), impact: "privacy/data loss", repro: "Open the pre-regeneration link" }); const p2 = await readPage(S, `/museum/share/not-a-real-token-xyz`, 5000); R.check(/Link not available/.test(p2.text) && !/error|undefined|exception/i.test(p2.text), { page: "/museum/share/[invalid token] | visitor", control: "Invalid share token", expected: "'Link not available' with a way back, no crash", actual: p2.text.slice(p2.text.indexOf("SHARED"), p2.text.indexOf("SHARED") + 160), evidence: await S.jshot("exh-access-invalid-share"), impact: "usability", repro: "Open /museum/share/not-a-real-token-xyz" }); } finally { await S.close(); } }

  // ---------- Public exhibition (Sports Slabs): hidden item, public items, cost, columns
  const base = `exhibition 'Sports Slabs' PUBLIC, 6 items (2 public valued, 1 hidden, 3 private)`;
  const pubTok = (await gdb(PUB)).public_token;
  for (const kind of ["visitor", "viewer"]) {
    const S = await session(kind);
    try {
      for (const route of [`/museum/${PUB}/guest`, `/museum/share/${pubTok}`]) {
        const p = await readPage(S, route, 8000);
        const t = p.text;
        const hiddenOk = /Hidden Item/.test(t) && !t.includes("QA Album 8 - ");
        const items6 = [6, 7, 9, 10, 11].every((n) => t.includes(`QA Album ${n} - `));
        const leaks = [/7,?777/, /\bPaid\b/i].filter((re) => re.test(t));
        const shot = await S.jshot(`exh-access-public-${kind}-${route.includes("share") ? "share" : "guest"}`);
        R.check(hiddenOk, { page: `${route.includes("share") ? "/museum/share/[token]" : "/museum/[id]/guest"} | ${kind} | ${base}`, control: "Hidden item (owner hid 'QA Album 8')", expected: "Shows a 'Hidden Item' placeholder and never the real title", actual: `placeholder shown: ${/Hidden Item/.test(t)}; real title visible: ${t.includes("QA Album 8 - ")}`, evidence: shot, impact: "privacy/data loss", repro: "Open the public exhibition containing a hidden item" });
        R.check(items6 && leaks.length === 0, { page: `${route.includes("share") ? "/museum/share/[token]" : "/museum/[id]/guest"} | ${kind} | ${base}`, control: "Guest View content: public and private pieces, private cost", expected: "Titles of the other 5 pieces show; no purchase cost (7,777.77) and no 'Paid' anywhere on the page", actual: `titles ok ${items6}; leaks ${leaks.map(String).join(",") || "none"}`, evidence: shot, impact: "privacy/data loss", repro: "Open the public exhibition, search the page for the cost" });
        // count shown
        const cnt = (t.match(/(\d+) items?/) || [])[1];
        R.check(cnt === "6", { page: `${route.includes("share") ? "/museum/share/[token]" : "/museum/[id]/guest"} | ${kind} | ${base}`, control: "Item count line on the exhibition page", expected: "6 items", actual: String(cnt) + " items", impact: "misleading result", repro: "Open the exhibition; read '… items · 1 exhibit'" });
        // what the network carried
        const wire = S.reqs.filter((r) => /rest\/v1\/(galleries|vault_items|public_vault_items|gallery_items)|rpc\//.test(r.url));
        const asked = wire.filter((r) => /purchase_price|purchase|cost/i.test(decodeURIComponent(r.url)));
        R.check(asked.length === 0, { page: `${route.includes("share") ? "/museum/share/[token]" : "/museum/[id]/guest"} | ${kind}`, control: "Network: the page never asks for purchase cost columns", expected: "No request names purchase/cost columns", actual: asked.length ? asked.map((r) => r.url.slice(0, 120)).join(" ; ") : `${wire.length} data requests, none for cost`, impact: "privacy/data loss", repro: "Open the exhibition; inspect requests" });
      }
    } finally { await S.close(); }
  }
  // columns reachable directly with the public key
  const colView = await sbAnon.from("public_vault_items").select("id,purchase_price").eq("id", id(6));
  const colTab = await sbAnon.from("vault_items").select("id,purchase_price,current_value").eq("id", id(6));
  const colPriv = await sbAnon.from("vault_items").select("id,title").eq("id", id(9));
  R.check(!(colTab.data || []).some((r) => r.purchase_price != null) && !(colView.data || []).some((r) => r.purchase_price != null), { page: "database | public key (signed out)", control: "Direct read of a PUBLIC item's purchase price (vault_items / public_vault_items)", expected: "Refused or null: the owner's cost is never readable by the public", actual: `vault_items: ${colTab.error ? colTab.error.message : JSON.stringify(colTab.data)}; public_vault_items: ${colView.error ? colView.error.message : JSON.stringify(colView.data)}`, impact: "privacy/data loss", repro: "Select purchase_price for a public item with the public key" });
  R.check((colPriv.data || []).length === 0, { page: "database | public key (signed out)", control: "Direct read of a PRIVATE item (is_public false) that sits in a public exhibition", expected: "Nothing returned", actual: JSON.stringify(colPriv.error ? colPriv.error.message : colPriv.data), impact: "privacy/data loss", repro: "Select a private item by id with the public key" });
  const snap = (await sbAnon.from("galleries").select("layout").eq("id", PUB)).data;
  const snapTxt = JSON.stringify(snap || "");
  R.check(!/purchase|7777|cost/i.test(snapTxt), { page: "database | public key", control: "Public exhibition row (layout.publicItemSnapshots) contents", expected: "No cost fields in what the public can download", actual: /purchase|7777|cost/i.test(snapTxt) ? "cost data present" : "none (" + snapTxt.length + " chars)", impact: "privacy/data loss", repro: "Select the public exhibition's layout" });
  const keys = (await sbAnon.from("galleries").select("analytics_unique_view_keys").eq("id", PUB)).data;
  R.check(!keys || keys.length === 0 || !(keys[0].analytics_unique_view_keys || []).length, { page: "database | public key", control: "Direct read of a public exhibition's visitor identifiers (analytics_unique_view_keys)", expected: "Not readable by the public (the 20261018 migration removes it from link lookups)", actual: JSON.stringify(keys).slice(0, 160), impact: "privacy/data loss", repro: "Select analytics_unique_view_keys for a public exhibition with the public key" });

  // ---------- Alias exhibition: real identity must not be handed out
  await admin.from("profiles").update({ is_public: true }).eq("id", m.personalId);
  await admin.from("galleries").update({ alias_enabled: true, alias_name: "QA Alias Curator" }).eq("id", PUB);
  const aliasRow = (await sbAnon.from("galleries").select("profile_id,alias_enabled,alias_name").eq("id", PUB)).data || [];
  const aliasRpc = await sbAnon.rpc("get_gallery_by_share_token", { p_token: pubTok });
  const pp = aliasRow[0] && aliasRow[0].profile_id ? (await sbAnon.from("public_profiles").select("display_name").eq("profile_id", aliasRow[0].profile_id)).data : [];
  const rpcLeak = ((aliasRpc.data || [])[0] || {}).profile_id;
  {
    const S = await session("visitor");
    try {
      const p = await readPage(S, `/museum/share/${pubTok}`, 8000);
      const shownName = /QA Alias Curator/.test(p.text), realName = /QA Visual Collection/.test(p.text);
      R.check(shownName && !realName, { page: "/museum/share/[token] | visitor | alias exhibition (alias 'QA Alias Curator')", control: "Curator name on an alias exhibition", expected: "Shows the alias, never the real display name", actual: `alias shown ${shownName}; real name shown ${realName}`, evidence: await S.jshot("exh-access-alias-share"), impact: "privacy/data loss", repro: "Turn on alias; open the share link signed out" });
    } finally { await S.close(); }
  }
  R.check(!rpcLeak, { page: "database | share-link lookup | alias exhibition", control: "Share-link lookup on an alias exhibition (profile_id)", expected: "profile_id is blanked so the real account is not named", actual: rpcLeak ? "profile_id returned" : "blank", impact: "privacy/data loss", repro: "Call get_gallery_by_share_token on an alias exhibition" });
  R.check(!(aliasRow[0] && aliasRow[0].profile_id), { page: "database | public key | alias exhibition", control: "Direct read of an alias exhibition's row: profile_id", expected: "The real account id is not given to the public (it resolves to the real public profile name)", actual: aliasRow[0] ? `profile_id ${aliasRow[0].profile_id ? "returned" : "blank"}; public_profiles lookup with it: ${JSON.stringify(pp)}` : "no row", evidence: "", impact: "privacy/data loss", repro: "As a visitor select profile_id from galleries for a Public alias exhibition, then select public_profiles with it" });
  await admin.from("galleries").update({ alias_enabled: false, alias_name: null }).eq("id", PUB);
  await admin.from("profiles").update({ is_public: false }).eq("id", m.personalId);

  // ---------- view counter
  await admin.from("galleries").update({ analytics_views: 0, analytics_unique_view_keys: [] }).eq("id", PUB);
  const views = async () => (await gdb(PUB)).analytics_views;
  let V1 = await session("visitor");
  try {
    await V1.visit(`/museum/${PUB}/guest`); await sleep(6000);
    const v1 = await views();
    await V1.visit(`/museum/${PUB}/guest`); await sleep(5000);
    const v1b = await views();
    R.check(v1 === 1, { page: "/museum/[id]/guest | visitor | Public exhibition, views 0", control: "View counter after one visit", expected: "1", actual: String(v1), impact: "misleading result", repro: "Open the guest page once signed out; read the exhibition's views" });
    R.check(v1b === 1, { page: "/museum/[id]/guest | same visitor again", control: "View counter after reloading in the same browser", expected: "Still 1 (counts unique viewers)", actual: String(v1b), impact: "misleading result", repro: "Reload the page" });
  } finally { await V1.close(); }
  const V2 = await session("visitor");
  try { await V2.visit(`/museum/share/${pubTok}`); await sleep(6000); const v2 = await views(); R.check(v2 === 2, { page: "/museum/share/[token] | a different visitor browser", control: "View counter after a second, different visitor", expected: "2", actual: String(v2), impact: "misleading result", repro: "Open the share link in a clean browser" }); } finally { await V2.close(); }
  const O = await session("owner");
  try { await O.visit(`/museum/${PUB}/guest`); await sleep(6000); const vo = await views(); R.check(vo === 2, { page: "/museum/[id]/guest | owner", control: "Owner visiting their own exhibition", expected: "Not counted as an audience view (stays 2)", actual: String(vo), impact: "misleading result", repro: "Open your own guest page" }); } finally { await O.close(); }

  { // signed-in unrelated viewer, and the owner after the Exhibitions page has filled the browser's own copy
    const SV = await session("viewer");
    try { await SV.visit(`/museum/${PUB}/guest`); await sleep(6000); const vv = await views(); R.check(vv === 3, { page: "/museum/[id]/guest | unrelated signed-in viewer | Public exhibition", control: "View counter after a signed-in viewer's visit", expected: "3 (one more unique viewer)", actual: String(vv), impact: "misleading result", repro: "Open the guest page signed in as another user" }); } finally { await SV.close(); }
    const OW = await session("owner");
    try { await OW.visit("/museum"); await sleep(5000); const before = await views(); await OW.visit(`/museum/${PUB}/guest`); await sleep(6000); const after = await views(); R.nt({ page: "/museum/[id]/guest | owner after opening Exhibitions first", control: "Owner's own visit and the audience counter", expected: "Improvement candidate: the owner's own visits should not count as audience views", actual: `views ${before} -> ${after}. The counter is only written by a browser that already holds its own copy of the exhibition (the owner's, after /museum has loaded), which is why visitors above never increase it.`, impact: "improvement" }); } finally { await OW.close(); }
  }
  // ---------- /gallery/[id] redirect
  for (const kind of ["visitor", "owner"]) {
    const S = await session(kind);
    try { const p = await readPage(S, `/gallery/${PUB}`, 6000); R.check(p.path === `/museum/${PUB}/guest`, { page: `/gallery/[galleryId] | ${kind} | Public exhibition`, control: "Old /gallery/<id> link", expected: `Redirects to /museum/${PUB}/guest`, actual: p.path, evidence: "", impact: "usability", repro: "Open /gallery/<id>" }); } finally { await S.close(); }
  }
  { const S = await session("visitor"); try { const p = await readPage(S, `/gallery/${A}`, 6000); R.check(p.path === `/museum/${A}/guest` && /Exhibition not found/.test(p.text), { page: "/gallery/[galleryId] | visitor | Private-ish exhibition", control: "Old /gallery/<id> link for a non-public exhibition", expected: "Redirects, then 'Exhibition not found' (nothing leaks)", actual: p.path + " | " + classify(p.text, titleA), impact: "privacy/data loss", repro: "Open /gallery/<non-public id> signed out" }); const p2 = await readPage(S, `/gallery/00000000-0000-0000-0000-000000000000`, 5000); R.check(/Exhibition not found/.test(p2.text), { page: "/gallery/[galleryId] | visitor | unknown id", control: "Unknown exhibition id", expected: "Exhibition not found page with a way back", actual: classify(p2.text, "zzz"), evidence: await S.jshot("exh-access-unknown-id"), impact: "usability", repro: "Open /gallery/0000..." }); } finally { await S.close(); } }

  console.log("DONE access");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
