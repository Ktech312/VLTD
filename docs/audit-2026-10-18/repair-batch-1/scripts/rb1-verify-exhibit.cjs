// Repair batch 1 / RC-01 verification on PRODUCTION with a SYNTHETIC fixture: opening, refreshing or failing to load an exhibition must not remove item ids, links or snapshots.
//   AUDIT_MANIFEST=<manifest> node rb1-verify-exhibit.cjs <label>
// First-failure evidence is kept: every scenario's before/after state and captured writes are written to repair-batch-1/evidence/rb1-exhibit-<label>.json even when a check fails.
const { session, sleep, admin, man, fs, AUD, R } = require("./audit-lib.cjs");
const LABEL = process.argv[2] || "run";
const r = R("RB1");
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const runs = (letter) => !ONLY.length || ONLY.includes(letter);
const OUT = AUD + "/repair-batch-1/evidence"; fs.mkdirSync(OUT, { recursive: true });
const results = { label: LABEL, fixtureOnly: true, scenarios: [] };

(async () => {
  const m = man(); const P = m.personalId, B = m.businessId;
  const galleries = (await admin.from("galleries").select("*").in("profile_id", [P, B])).data;
  const gids = galleries.map((g) => g.id);
  const saved = new Map(galleries.map((g) => [g.id, g]));
  const savedLinks = (await admin.from("gallery_items").select("*").in("gallery_id", gids)).data;
  const state = async () => {
    const gs = (await admin.from("galleries").select("id,layout,exhibition_layout,updated_at").in("id", gids)).data;
    const ls = (await admin.from("gallery_items").select("gallery_id,artifact_id").in("gallery_id", gids)).data;
    const o = {};
    for (const g of gs) o[g.id] = { layout: JSON.stringify([...(g.layout?.itemIds || [])].sort()), ex: JSON.stringify([...(g.exhibition_layout?.itemIds || [])].sort()), snaps: (g.layout?.publicItemSnapshots || []).length, links: ls.filter((l) => l.gallery_id === g.id).length, updated: g.updated_at };
    const items = (await admin.from("vault_items").select("id", { count: "exact", head: true }).in("profile_id", [P, B])).count;
    return { galleries: o, items };
  };
  const diff = (a, b) => { const d = []; for (const id of Object.keys(a.galleries)) { const x = a.galleries[id], y = b.galleries[id]; if (!y) d.push(id.slice(0, 8) + ": gone"); else { for (const k of ["layout", "ex", "links"]) if (x[k] !== y[k]) d.push(`${id.slice(0, 8)}: ${k} changed`); if (y.snaps < x.snaps) d.push(`${id.slice(0, 8)}: snapshots REMOVED (${x.snaps} -> ${y.snaps})`); } } if (a.items !== b.items) d.push(`items ${a.items} -> ${b.items}`); return d; };
  const snapsAdded = (a, b) => Object.keys(a.galleries).filter((id) => b.galleries[id] && b.galleries[id].snaps > a.galleries[id].snaps).map((x) => x.slice(0, 8));
  const rewrote = (a, b) => Object.keys(a.galleries).filter((id) => a.galleries[id].updated !== b.galleries[id]?.updated).map((x) => x.slice(0, 8));
  const restoreAll = async () => { for (const g of saved.values()) await admin.from("galleries").update({ layout: g.layout, exhibition_layout: g.exhibition_layout }).eq("id", g.id); await admin.from("gallery_items").delete().in("gallery_id", gids); if (savedLinks.length) await admin.from("gallery_items").insert(savedLinks); };

  const watch = (S, before, writes) => S.c.on((e) => {
    if (e.method !== "Network.requestWillBeSent") return;
    const rq = e.params.request; if (!/\/rest\/v1\/(galleries|gallery_items|vault_items)/.test(rq.url) || !/POST|PATCH|PUT|DELETE/.test(rq.method)) return;
    let ids = null, gid = null; try { const b = JSON.parse(rq.postData || "null"); const o = Array.isArray(b) ? b[0] : b; if (o && o.layout) { ids = (o.layout.itemIds || []).length; gid = String(o.id).slice(0, 8); } } catch {}
    const dbCount = gid ? (() => { const full = [...Object.keys(before.galleries)].find((k) => k.startsWith(gid)); return full ? JSON.parse(before.galleries[full].layout).length : null; })() : null;
    writes.push({ method: rq.method, table: rq.url.split("/rest/v1/")[1].split("?")[0], galleryWriteItemIds: ids, dbItemIdsBefore: dbCount, fewerIdsThanDatabase: ids !== null && dbCount !== null && ids < dbCount });
  });
  const text = (S) => S.evaluate("document.body.innerText.replace(/\\s+/g,' ').slice(0,200)");
  const mclick = async (S, js) => { const pos = await S.evaluate(`(() => { const e = (${js})(); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`); if (!pos) return false; await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pos.x, y: pos.y, button: "none" }); await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 1 }); await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 0 }); return true; };

  async function scenario(name, expectation, kind, setup, action) {
    if (!runs(name[0])) return;
    const before = await state(); const writes = [];
    const S = await session(kind, { width: 1440, height: 900 });
    watch(S, before, writes);
    let pageText = "";
    try { if (setup) await setup(S); pageText = await action(S, before); } catch (e) { pageText = "ERROR " + String(e.message).slice(0, 120); }
    const shot = await S.jshot("rb1-" + LABEL + "-" + name.replace(/\W+/g, "-").slice(0, 40));
    await S.close();
    await sleep(1500);
    const after = await state(); const d = diff(before, after);
    const destructiveWrites = writes.filter((w) => w.fewerIdsThanDatabase);
    const ok = d.length === 0 && destructiveWrites.length === 0;
    results.scenarios.push({ name, kind, ok, differences: d, galleriesRewrittenWithSameContent: rewrote(before, after), snapshotsAddedOn: snapsAdded(before, after), writes: writes.slice(0, 12), destructiveWrites: destructiveWrites.length, pageText: String(pageText).replace(/^Home Vault.*?Level \d /, "").slice(0, 160) });
    r.check(ok, { page: `/museum/<exhibition> | ${expectation.page}`, control: name, expected: "no item id, link or snapshot removed from any exhibition; no write with fewer ids than the database holds", actual: ok ? `all ${Object.keys(before.galleries).length} exhibitions unchanged (ids, links, snapshots) and no destructive write; ${writes.length} write request(s) seen${rewrote(before, after).length ? ", " + rewrote(before, after).length + " rewritten" : ""}${snapsAdded(before, after).length ? ", public snapshots ADDED on " + snapsAdded(before, after).length + " (none removed)" : ""}` : `CHANGED: ${d.join("; ") || "-"}; writes with fewer ids than the database: ${destructiveWrites.length}`, evidence: shot, impact: "privacy/data loss", repro: expectation.repro });
    if (!ok) await restoreAll();
  }
  const url = (g) => `/museum/${g.id}`;
  const list = galleries.filter((g) => g.profile_id === P);

  await scenario("A: wrong active profile (Business) opens every Personal exhibition", { page: "owner, Business profile active", repro: "Switch to Business, open each Personal exhibition address." }, "business", null, async (S) => { let t = ""; for (const g of list) { await S.visit(url(g)); await sleep(9000); t = await text(S); } return t; });
  await scenario("B: vault read refused (Personal active)", { page: "owner, Personal active, vault_items read blocked", repro: "Block the vault_items read, open exhibitions." }, "owner", async (S) => S.send("Network.setBlockedURLs", { urls: ["*supabase.co/rest/v1/vault_items*"] }), async (S) => { let t = ""; for (const g of list.slice(0, 3)) { await S.visit(url(g)); await sleep(9000); t = await text(S); } return t; });
  await scenario("C: incomplete read (cloud answers 'no items')", { page: "owner, Personal active, vault_items GET answers an empty list", repro: "Answer the vault_items GET with [] (success but empty), open exhibitions." }, "owner", async (S) => { await S.addFetchPatterns(["*supabase.co/rest/v1/vault_items*"]); S.fetchOverride = (p) => { if (/vault_items/.test(p.request.url) && p.request.method === "GET") { S.send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "content-range", value: "*/0" }, { name: "access-control-allow-origin", value: "*" }], body: Buffer.from("[]").toString("base64") }).catch(() => {}); return true; } if (/vault_items/.test(p.request.url)) { S.send("Fetch.continueRequest", { requestId: p.requestId }).catch(() => {}); return true; } return false; }; }, async (S) => { let t = ""; for (const g of list.slice(0, 3)) { await S.visit(url(g)); await sleep(9000); t = await text(S); } return t; });
  await scenario("D: delayed read (vault read held for 20 s)", { page: "owner, Personal active, vault_items GET delayed 20 s", repro: "Delay the vault_items read 20 s, open an exhibition and wait." }, "owner", async (S) => { await S.addFetchPatterns(["*supabase.co/rest/v1/vault_items*"]); S.fetchOverride = (p) => { if (/vault_items/.test(p.request.url)) { setTimeout(() => S.send("Fetch.continueRequest", { requestId: p.requestId }).catch(() => {}), p.request.method === "GET" ? 20000 : 0); return true; } return false; }; }, async (S) => { await S.visit(url(list[1])); await sleep(30000); return text(S); });
  await scenario("E: profile switching while an exhibition is open", { page: "owner, Personal -> Business -> Personal while the page is open", repro: "Open a Personal exhibition, switch profile twice from the account menu state." }, "owner", null, async (S) => { await S.visit(url(list[1])); await sleep(6000); const sw = (id) => S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(id)}); window.dispatchEvent(new Event('vltd:active-profile')); window.dispatchEvent(new Event('vltd:vault-updated')); true`); await sw(B); await sleep(12000); await sw(P); await sleep(8000); return text(S); });
  await scenario("F1: unrelated signed-in viewer opens the editor and guest addresses", { page: "unrelated viewer, signed in", repro: "Sign in as another user and open another user's exhibition addresses." }, "viewer", null, async (S) => { let t = ""; for (const g of list) { for (const suffix of ["", "/guest"]) { await S.visit(url(g) + suffix); await sleep(5000); t = await text(S); } } return t; });
  await scenario("F2: signed-out visitor opens guest and share addresses", { page: "signed-out visitor", repro: "Open guest and share links without signing in." }, "visitor", null, async (S) => { let t = ""; for (const g of list) { await S.visit(url(g) + "/guest"); await sleep(4000); t = await text(S); } const tok = saved.get(list.find((g) => g.visibility === "PUBLIC")?.id)?.public_token; if (tok) { await S.visit(`/museum/share/${tok}`); await sleep(5000); t = await text(S); } return t; });
  await scenario("G: refreshing the exhibition page three times", { page: "owner, Personal active", repro: "Open an exhibition and reload it three times." }, "owner", null, async (S) => { await S.visit(url(list[1])); await sleep(7000); for (let i = 0; i < 3; i++) { await S.visit(url(list[1])); await sleep(7000); } return text(S); });

  // the explicit, confirmed delete workflow still cleans exhibitions (this one is DESIGNED to change data)
  if (runs("H")) {
    const item = (await admin.from("gallery_items").select("artifact_id,gallery_id").in("gallery_id", gids)).data[0];
    const holders = (await admin.from("gallery_items").select("gallery_id").eq("artifact_id", item.artifact_id)).data.map((x) => x.gallery_id);
    const before = await state();
    const S = await session("owner", { width: 1440, height: 900 });
    await S.visit(`/vault/item/${item.artifact_id}`); await sleep(5000);
    S.dialogMode = "accept";
    await mclick(S, `() => document.querySelector('[aria-label="Delete item"]')`); await sleep(900);
    await mclick(S, `() => [...document.querySelectorAll('[role=dialog] button')].find((b) => /^Delete Forever$/.test(b.textContent.trim()))`); await sleep(8000);
    const shot = await S.jshot("rb1-" + LABEL + "-H-explicit-delete"); await S.close();
    const after = await state();
    const gone = !(await admin.from("vault_items").select("id").eq("id", item.artifact_id)).data.length;
    const changed = Object.keys(before.galleries).filter((id) => before.galleries[id].layout !== after.galleries[id].layout || before.galleries[id].links !== after.galleries[id].links);
    const exactlyHolders = changed.length === holders.length && changed.every((id) => holders.includes(id));
    const idStillThere = Object.values(after.galleries).some((g) => JSON.parse(g.layout).includes(item.artifact_id) || JSON.parse(g.ex).includes(item.artifact_id));
    results.scenarios.push({ name: "H: confirmed delete", item: "one synthetic item", deleted: gone, galleriesHoldingIt: holders.length, galleriesChanged: changed.length, idStillListed: idStillThere });
    r.check(gone && exactlyHolders && !idStillThere, { page: "/vault/item/<id> | owner, Personal active", control: "Delete item -> Delete Forever (the confirmed delete workflow)", expected: "the item is deleted and its id leaves exactly the exhibitions that held it; no other exhibition changes", actual: `item deleted: ${gone}; exhibitions holding it: ${holders.length}; exhibitions changed: ${changed.length}; id still listed anywhere: ${idStillThere}`, evidence: shot, impact: "privacy/data loss", repro: "Delete a synthetic item that sits in exhibitions." });
  }
  fs.writeFileSync(OUT + `/rb1-exhibit-${LABEL}.json`, JSON.stringify(results, null, 1));
  console.log("\nscenarios:", results.scenarios.map((s) => (s.ok === undefined ? "H" : s.ok ? "ok" : "FAIL") + " " + s.name.slice(0, 30)).join(" | "));
  process.exit(0);
})().catch((e) => { console.error(e); try { fs.writeFileSync(OUT + `/rb1-exhibit-${LABEL}-crashed.json`, JSON.stringify(results, null, 1)); } catch {} process.exit(1); });
