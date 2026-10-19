// RC-01 reproduction on a SYNTHETIC fixture only. Two triggers of the same code path (the exhibition page's "dead item" self-heal):
//   A: Business profile active, open a Personal exhibition (already seen in EXH-433 / CRW-012)
//   B: Personal profile active, the cloud read of vault items is blocked (an interrupted connection)
// Also captures the write that empties the exhibition. The exhibition is restored from a saved copy between runs.
const { session, sleep, admin, man, fs, AUD } = require("./audit-lib.cjs");
(async () => {
  const m = man();
  const g = (await admin.from("galleries").select("*").eq("profile_id", m.personalId).eq("title", "Vinyl Wall").single()).data;
  const links = (await admin.from("gallery_items").select("*").eq("gallery_id", g.id)).data;
  const state = async () => { const x = (await admin.from("galleries").select("layout,exhibition_layout,updated_at").eq("id", g.id).single()).data; const l = (await admin.from("gallery_items").select("artifact_id", { count: "exact", head: true }).eq("gallery_id", g.id)).count; return { layoutIds: (x.layout?.itemIds || []).length, exIds: (x.exhibition_layout?.itemIds || []).length, snapshots: (x.layout?.publicItemSnapshots || []).length, links: l, updated: x.updated_at }; };
  const restore = async () => { await admin.from("galleries").update({ layout: g.layout, exhibition_layout: g.exhibition_layout }).eq("id", g.id); await admin.from("gallery_items").delete().eq("gallery_id", g.id); if (links.length) await admin.from("gallery_items").insert(links); };
  const out = { fixtureOnly: true, before: await state(), runs: [] };
  const run = async (name, kind, blockItems) => {
    const S = await session(kind, { width: 1440, height: 900 });
    const writes = [];
    S.c.on((e) => { if (e.method === "Network.requestWillBeSent") { const rq = e.params.request; if (/\/rest\/v1\/(galleries|gallery_items)/.test(rq.url) && /POST|PATCH|PUT|DELETE/.test(rq.method)) { let n = null; try { const b = JSON.parse(rq.postData || "null"); const o = Array.isArray(b) ? b[0] : b; n = o && o.layout ? (o.layout.itemIds || []).length : o && "artifact_id" in (o || {}) ? "link row" : null; } catch {} let gid=null; try { const b = JSON.parse(rq.postData || "null"); const o = Array.isArray(b) ? b[0] : b; gid = o && (o.id || o.gallery_id) ? String(o.id || o.gallery_id).slice(0,8) : null; } catch {} writes.push({ method: rq.method, table: rq.url.split("/rest/v1/")[1].split("?")[0], layoutItemIdsInBody: n, galleryIdPrefix: gid, thisGallery: gid === g.id.slice(0,8), requestId: e.params.requestId }); } } });
    S.c.on((e) => { if (e.method === "Network.responseReceived") { const w = writes.find((x) => x.requestId === e.params.requestId); if (w) w.status = e.params.response.status; } });
    if (blockItems) await S.send("Network.setBlockedURLs", { urls: ["*supabase.co/rest/v1/vault_items*"] });
    await S.visit(`/museum/${g.id}`); await sleep(12000);
    const text = await S.evaluate("document.body.innerText.replace(/\\s+/g,' ').slice(0,160)");
    const after = await state(); await S.jshot("rc01-repro-" + name);
    await S.close();
    out.runs.push({ name, activeProfile: kind === "business" ? "Business" : "Personal", itemReadBlocked: !!blockItems, pageText: text.replace(/^Home Vault.*?Level \d /, ""), after, writesSeen: writes.slice(0, 8).map(({ requestId, ...r }) => r) });
    await restore();
  };
  await run("A-business-active-opens-personal-exhibition", "business", false);
  await run("B-personal-active-item-read-blocked", "owner", true);
  await run("C-control-personal-active-normal", "owner", false);
  out.restoredTo = await state();
  fs.writeFileSync(AUD + "/rc01-repro-result.json", JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1).slice(0, 3000));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
