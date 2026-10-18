// Photo deletion on the item page: a secondary photo, then the primary photo; the edit dialog's cancel; failure feedback (account refuses
// the save / the picture file cannot be removed); saved order; reload from a clean browser; the item itself stays intact.
//   node ui-photo-delete.cjs <label> --base=https://vltd.app
// Photos are real uploads (three images added through the page's own upload, so real storage files exist). Every upload is removed at the end.
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/qa-chrome";
const fs = require("fs");
const path = require("path");
const { session, qa, admin, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const LABEL = process.argv[2] || "photodel";
const OUT = path.join(__dirname, "shots-" + LABEL); fs.mkdirSync(OUT, { recursive: true });
const ASSETS = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/public/collectibles/";
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 600)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 500));
const ID = (n) => `qa_ui_${qa.stamp}_${n}`;
const TARGET = ID(3);
const row = async () => (await admin.from("vault_items").select("*").eq("id", TARGET).maybeSingle()).data;
const urlsOf = (r) => (Array.isArray(r.images_json) ? [...r.images_json].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : []).map((x) => x.url);
const poll = async (fn, ms = 45000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(1500); } return null; };
const storagePath = (url) => { const m = /\/object\/public\/([^/]+)\/(.+)$/.exec(String(url || "")); return m ? { bucket: m[1], p: decodeURIComponent(m[2]) } : null; };
const fileExists = async (url) => { try { const r = await fetch(url, { method: "HEAD" }); return r.ok; } catch { return false; } };
const msg = (S) => S.evaluate("(() => { const t = document.body.innerText; const m = t.match(/(Image deleted\\.|Image removed on this device[^\\n]*|[^\\n]*picture file is still stored[^\\n]*)/); return m ? m[0] : ''; })()");
const thumbs = (S) => S.evaluate("document.querySelectorAll('[aria-label=\"Delete image\"]').length");

(async () => {
  const orig = await row();
  const uploaded = [];
  const S = await session(BASE, { width: 1440, height: 900 });
  const net = { failWrites: false, failStorageDelete: false, writesFailed: 0, storageFailed: 0 };
  try {
    await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/vault_items*", requestStage: "Request" }, { urlPattern: "*/storage/v1/object/*", requestStage: "Request" }] });
    S.c.on(async (m) => {
      if (m.method !== "Fetch.requestPaused") return;
      const { requestId, request } = m.params;
      try {
        const isWrite = request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS";
        if (net.failWrites && isWrite && /\/rest\/v1\/vault_items/.test(request.url)) { net.writesFailed++; await S.send("Fetch.fulfillRequest", { requestId, responseCode: 500, responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" }], body: Buffer.from(JSON.stringify({ message: "QA: refused" })).toString("base64") }); }
        else if (net.failStorageDelete && request.method === "DELETE" && /\/storage\/v1\/object\//.test(request.url)) { net.storageFailed++; await S.send("Fetch.fulfillRequest", { requestId, responseCode: 500, responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" }], body: Buffer.from(JSON.stringify({ message: "QA: storage refused" })).toString("base64") }); }
        else await S.send("Fetch.continueRequest", { requestId });
      } catch { /* gone */ }
    });

    // ---- set up: three real uploads on the item (several files at once are added straight away) ----
    await S.go("/vault/item/" + TARGET); await S.waitFor("document.querySelector('[aria-label=\"Upload photo from device\"]')", 120000); await sleep(2500);
    await S.send("DOM.enable");
    const doc = await S.send("DOM.getDocument", { depth: 1 });
    const q = await S.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][accept=\"image/*\"][multiple]" });
    await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [ASSETS + "guitar.png", ASSETS + "comic-slab.png", ASSETS + "vinyl-record.png"] });
    const four = await poll(async () => { const r = await row(); return urlsOf(r).length === 4 ? r : null; }, 90000);
    check("[setup] three uploaded photos are added to the item (4 photos in all, 3 of them real stored files)", !!four, urlsOf(await row()));
    if (!four) throw new Error("setup failed");
    for (const x of four.images_json) { const s = storagePath(x.url); if (s) uploaded.push(s); }
    const set0 = urlsOf(four);
    const before = four;
    await S.go("/vault/item/" + TARGET); await S.waitFor("document.querySelectorAll('[aria-label=\"Delete image\"]').length === 4", 60000); await sleep(1500);
    check("[setup] the page lists all four photos", (await thumbs(S)) === 4);
    await S.shot(OUT + "/four-photos.png");

    // ---- cancellation: the edit dialog's Cancel changes nothing; delete itself has no confirmation step ----
    await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit Photo').click(); true");
    await S.waitFor("document.querySelector('[role=dialog][aria-label=\"Edit saved photo\"]')", 30000); await sleep(1500);
    await S.evaluate("[...document.querySelectorAll('[role=dialog] button')].find((b) => /^Cancel$/i.test(b.textContent.trim())).click(); true"); await sleep(2500);
    const afterCancel = await row();
    check("[cancel] opening Edit Photo and pressing Cancel changes nothing in the account", JSON.stringify(urlsOf(afterCancel)) === JSON.stringify(set0) && !(await S.evaluate("!!document.querySelector('[role=dialog][aria-label=\"Edit saved photo\"]')")), urlsOf(afterCancel));
    info("[cancel] a photo's Delete button asks no 'are you sure': it deletes at once (see HANDOFF; not changed)", true);

    // ---- delete a SECONDARY photo (the 3rd of 4) ----
    const victim = set0[2];
    await S.evaluate("document.querySelectorAll('[aria-label=\"Delete image\"]')[2].click(); true"); await sleep(1500);
    const m1 = await msg(S);
    const after1 = await poll(async () => { const r = await row(); return urlsOf(r).length === 3 ? r : null; }, 60000);
    check("[secondary] the page says 'Image deleted.'", /Image deleted/.test(m1), m1);
    check("[secondary] the account has 3 photos, the other three in the SAME order", !!after1 && JSON.stringify(urlsOf(after1)) === JSON.stringify([set0[0], set0[1], set0[3]]), after1 && urlsOf(after1));
    const gone = await poll(async () => (await fileExists(victim)) === false, 40000);
    check("[secondary] the deleted photo's stored file is removed too", !!gone || !storagePath(victim));
    const keep = ["title", "purchase_price", "purchase_tax", "purchase_shipping", "purchase_fees", "current_value", "status", "category", "category_label", "universe", "notes", "storage_location", "is_public", "subcategory_label"];
    check("[secondary] the item itself is intact (title, costs, value, status, classification, notes, flags)", !!after1 && keep.every((k) => JSON.stringify(after1[k]) === JSON.stringify(before[k])), keep.filter((k) => after1 && JSON.stringify(after1[k]) !== JSON.stringify(before[k])));
    const C1 = await session(BASE, { width: 1440, height: 900 });
    try {
      await C1.go("/vault/item/" + TARGET); await C1.waitFor("document.querySelectorAll('[aria-label=\"Delete image\"]').length >= 1", 90000); await sleep(1500);
      const n = await thumbs(C1);
      const order = await C1.evaluate("[...document.querySelectorAll('img')].map((i) => i.getAttribute('src') || '').filter((s) => /collectibles|storage/.test(s)).slice(0, 8)");
      check("[secondary] a clean second browser shows 3 photos after reload", n === 3, { n, order });
    } finally { await C1.close(); }

    // ---- failure feedback: the account refuses the save ----
    await S.go("/vault/item/" + TARGET); await S.waitFor("document.querySelectorAll('[aria-label=\"Delete image\"]').length === 3", 60000); await sleep(1500);
    net.failWrites = true;
    const victim2 = urlsOf(after1)[2];
    await S.evaluate("document.querySelectorAll('[aria-label=\"Delete image\"]')[2].click(); true"); await sleep(8000);
    const m2 = await msg(S);
    const stillThree = await row();
    check("[failure: account refuses] the page does NOT claim success: it says the removal is only on this device and will keep trying", /not in your account yet|only on this device|removed on this device/i.test(m2), m2);
    check("[failure: account refuses] the account still has the photo, and the stored file is not deleted", urlsOf(stillThree).length === 3 && (await fileExists(victim2)), { n: urlsOf(stillThree).length });
    await S.shot(OUT + "/failure-message.png");
    net.failWrites = false;
    const retried = await poll(async () => { const r = await row(); return urlsOf(r).length === 2 ? r : null; }, 90000);
    info("[failure: account refuses] once the account accepts again (the page keeps trying), the account has", retried ? "2 photos" : "still 3 photos after 90 s");
    check("[failure: account refuses] once it accepts again, the removal reaches the account by itself", !!retried, urlsOf(await row()));

    // ---- failure feedback: the picture file cannot be removed ----
    const rNow = await row();
    if (urlsOf(rNow).length >= 2) {
      await S.go("/vault/item/" + TARGET); await S.waitFor("document.querySelectorAll('[aria-label=\"Delete image\"]').length === " + urlsOf(rNow).length, 60000); await sleep(1500);
      net.failStorageDelete = true;
      const lastIdx = urlsOf(rNow).length - 1;
      const stored = storagePath(urlsOf(rNow)[lastIdx]);
      await S.evaluate("document.querySelectorAll('[aria-label=\"Delete image\"]')[" + lastIdx + "].click(); true"); await sleep(9000);
      const m3 = await msg(S);
      net.failStorageDelete = false;
      if (stored) check("[failure: file not removable] the page says the picture file is still stored (it does not claim a clean delete)", /still stored/i.test(m3) && net.storageFailed > 0, { m3, storageFailed: net.storageFailed });
      else info("[failure: file not removable] last photo was not a stored file", urlsOf(rNow)[lastIdx]);
    }

    // ---- delete the PRIMARY photo: upload three more so there are several photos again ----
    await S.go("/vault/item/" + TARGET); await S.waitFor("document.querySelector('[aria-label=\"Upload photo from device\"]')", 120000); await sleep(2500);
    await S.send("DOM.enable");
    const doc2 = await S.send("DOM.getDocument", { depth: 1 });
    const q2 = await S.send("DOM.querySelector", { nodeId: doc2.root.nodeId, selector: "input[type=file][accept=\"image/*\"][multiple]" });
    const nBase = urlsOf(await row()).length;
    await S.send("DOM.setFileInputFiles", { nodeId: q2.nodeId, files: [ASSETS + "guitar.png", ASSETS + "comic-slab.png", ASSETS + "vinyl-record.png"] });
    const again = await poll(async () => { const r = await row(); return urlsOf(r).length === nBase + 3 ? r : null; }, 90000);
    check("[primary: setup] three more uploads are added (several photos again)", !!again, urlsOf(await row()));
    if (again) {
      for (const x of again.images_json) { const s = storagePath(x.url); if (s && !uploaded.some((u) => u.p === s.p)) uploaded.push(s); }
      const list = urlsOf(again);
      const beforeP = again;
      await S.go("/vault/item/" + TARGET); await S.waitFor("document.querySelectorAll('[aria-label=\"Delete image\"]').length === " + list.length, 60000); await sleep(1500);
      const primaryUrl = list[0];
      await S.evaluate("document.querySelectorAll('[aria-label=\"Delete image\"]')[0].click(); true"); await sleep(3000);
      const afterP = await poll(async () => { const r = await row(); return urlsOf(r).length === list.length - 1 ? r : null; }, 60000);
      check("[primary] deleting the first (primary) photo leaves the others in the same order", !!afterP && JSON.stringify(urlsOf(afterP)) === JSON.stringify(list.slice(1)), afterP && urlsOf(afterP));
      const ordered = afterP ? afterP.images_json.slice().sort((x, y) => (x.order ?? 0) - (y.order ?? 0)) : [];
      // (Photo roles are not stored in the account at all; the first photo is the Primary one by position. So the checks are the cover and what is shown.)
      check("[primary] the next photo becomes the cover (image_front_url and primary_image_key) and the old one is gone", !!afterP && afterP.image_front_url === list[1] && !urlsOf(afterP).includes(primaryUrl) && String(afterP.primary_image_key || "") === String((ordered[0] || {}).storageKey || ""), afterP && { cover: afterP.image_front_url, want: list[1], key: afterP.primary_image_key });
      check("[primary] the item itself is intact (title, costs, value, status, classification, notes, flags)", !!afterP && keep.every((k) => JSON.stringify(afterP[k]) === JSON.stringify(beforeP[k])), keep.filter((k) => afterP && JSON.stringify(afterP[k]) !== JSON.stringify(beforeP[k])));
      const C2 = await session(BASE, { width: 1440, height: 900 });
      try {
        await C2.go("/vault/item/" + TARGET); await C2.waitFor("document.querySelectorAll('[aria-label=\"Delete image\"]').length >= 1", 90000); await sleep(1500);
        const n2 = await thumbs(C2);
        const first = await C2.evaluate("(() => { const b = document.querySelector('[aria-label=\"Show photo 1\"]'); const s = b && b.querySelector('img'); return { label: b ? (b.innerText || '').replace(/\\s+/g, ' ').trim() : '', src: s ? s.getAttribute('src') : '' }; })()");
        check("[primary] a clean second browser shows the remaining photos after reload, and photo 1 is labelled Primary and is the new cover", n2 === list.length - 1 && /Primary/.test(first.label) && (!first.src || first.src === list[1] || first.src.includes(list[1].split("/").pop())), { n2, first, want: list[1] });
      } finally { await C2.close(); }
    }
  } finally {
    await S.close();
    // restore the item's photos and remove every file this test uploaded
    await admin.from("vault_items").update({ images_json: orig.images_json, image_front_url: orig.image_front_url, image_front_storage_path: orig.image_front_storage_path, primary_image_key: orig.primary_image_key }).eq("id", TARGET);
    let removed = 0; for (const s of uploaded) { const r = await admin.storage.from(s.bucket).remove([s.p]); if (!r.error) removed++; }
    info("[cleanup] uploaded files removed", removed + " of " + uploaded.length);
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
