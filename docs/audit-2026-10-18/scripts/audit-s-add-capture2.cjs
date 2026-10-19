// ADD audit, suite 2: /capture photos (single upload, several, wrong type, oversize, corrupt), camera controls with no camera,
// AI identify (intercepted), interrupted connection (blocked vault_items requests), offline save, phone width (browser-emulated touch).
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, A, click, clickText, typeInto, pickSelect, text, rowsByTitle, allCount, poll, removeItems, mine, mouseAt, rectOf, mkPng, tmp, uploadFiles, block, offline } = T;
const PG = "/capture | owner, Personal, 26 items";
const PREFIX = "AUD ADD ";
const created = [];
const nameSel = "document.getElementById('capture-item-name')";
const saveBtn = T.btnExpr("^(?:.*\\|)?(Save to Vault|Saving…)$");
async function fresh(S, p = "/capture") { await S.visit(p); await S.waitFor("document.getElementById('capture-item-name')", 60000, "capture form"); await sleep(400); }
const save = (S) => click(S, saveBtn);
async function waitSaved(S, ms = 45000) { try { await S.waitFor("location.pathname === '/vault'", ms, "redirect"); return true; } catch { return false; } }
async function dbRow(title, profile = man().personalId, ms = 30000) { return (await poll(async () => { const x = await rowsByTitle(profile, title); return x.length ? x : null; }, ms, 1500)) || []; }
const scansLogged = async (P) => (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
const thumbCount = (S) => S.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"]').length");

(async () => {
  const m = man(); const P = m.personalId, B = m.businessId;
  await T.removeByPrefix(PREFIX);
  const png1 = mkPng(tmp("a1.png"), 800, 600, [200, 60, 60]);
  const png2 = mkPng(tmp("a2.png"), 640, 480, [60, 200, 60]);
  const png3 = mkPng(tmp("a3.png"), 1024, 768, [60, 60, 200]);
  fs.writeFileSync(tmp("notes.txt"), "this is not an image\n");
  fs.writeFileSync(tmp("fake.pdf"), "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  fs.writeFileSync(tmp("corrupt.png"), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from("not really a png at all, just garbage bytes")]));
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    if (!process.env.SKIP_EARLY) {
    // ---------------- camera with no camera ----------------
    await fresh(S);
    await clickText(S, "^(?:.*\\|)?Take photo$"); await sleep(2500);
    const camTxt = await text(S);
    await rec(S, /camera access is blocked|no camera|not available|allow camera|couldn't (start|open) the camera|permission/i.test(camTxt), { page: PG, control: "Take photo (no camera available)", expected: "A clear message that the camera is unavailable, with a way out", actual: (camTxt.match(/Camera access[^.]*\./) || ["no camera message found"])[0] + " | Close button present: " + !!(await rectOf(S, T.btnExpr("^(?:.*\\|)?Close$"))), impact: "usability", repro: "Open /capture, click Take photo in a browser without a camera" });
    const capBtn = await rectOf(S, T.btnExpr("Capture photo"));
    const nBefore = await thumbCount(S);
    if (capBtn) await mouseAt(S, capBtn.x, capBtn.y); await sleep(1200);
    await rec(S, (await thumbCount(S)) === nBefore, { page: PG, control: "Capture photo (no camera stream)", expected: "No phantom photo is added; button disabled or explains", actual: `capture button disabled=${capBtn && capBtn.disabled}; photos before/after click ${nBefore}->${await thumbCount(S)}`, impact: "misleading result", repro: "Take photo with no camera, click the shutter" });
    await click(S, T.btnExpr("^(?:.*\\|)?Close$")); await sleep(800);
    const closed = !(await rectOf(S, T.btnExpr("Capture photo")).then((r) => r && r.vis).catch(() => false));
    await rec(S, closed && (await S.path()) === "/capture", { page: PG, control: "Close (camera overlay)", expected: "Overlay closes and the form is intact", actual: closed ? "overlay closed; form still at /capture" : "overlay still open", impact: "blocked workflow", repro: "Take photo, then Close" });
    // 'Upload from file' inside the camera overlay
    await clickText(S, "^(?:.*\\|)?Take photo$"); await sleep(1500);
    const ufRect = await rectOf(S, T.btnExpr("Upload from file"));
    await rec(S, !!ufRect && !ufRect.disabled, { page: PG, control: "Upload from file (inside the camera overlay)", expected: "Present and enabled as the fallback when there is no camera", actual: ufRect ? `present, disabled=${ufRect.disabled}` : "missing", impact: "usability", repro: "Take photo, look for Upload from file" });
    await click(S, T.btnExpr("^(?:.*\\|)?Close$")); await sleep(600);

    // ---------------- single upload, save, stored, shown ----------------
    await fresh(S);
    const t1 = PREFIX + "Photo1 " + Date.now().toString(36);
    await uploadFiles(S, "input[type=file]", png1, 0); await sleep(2500);
    const prevShown = await S.evaluate("(() => { const i = [...document.querySelectorAll('img')].find((x) => /^blob:/.test(x.src)); return i ? { nw: i.naturalWidth, nh: i.naturalHeight } : null; })()");
    await rec(S, prevShown && prevShown.nw === 800, { page: PG, control: "Upload (one 800x600 PNG)", expected: "The photo appears as a preview at its real size", actual: JSON.stringify(prevShown), impact: "blocked workflow", repro: "Click Upload, choose an image" });
    await typeInto(S, nameSel, t1); await save(S);
    const ok1 = await waitSaved(S, 60000);
    const r1 = await dbRow(t1); created.push(...r1); const x1 = r1[0] || {};
    const imgs = Array.isArray(x1.images_json) ? x1.images_json : [];
    await rec(S, imgs.length === 1 && !!x1.image_front_url && /^https:/.test(x1.image_front_url), { page: PG, control: "Save to Vault with one uploaded photo", expected: "Row has one image, uploaded to cloud storage, and a cover URL", actual: JSON.stringify({ redirected: ok1, images: imgs.length, cover: (x1.image_front_url || "").replace(/^https:\/\/[^/]+/, "").slice(0, 80), localOnly: imgs[0] && imgs[0].localOnly }), impact: "data loss", repro: "Upload a photo, name the item, Save; read images_json" });
    if (x1.image_front_url) {
      const resp = await S.evaluate(`fetch(${JSON.stringify(x1.image_front_url)}).then(async (r) => ({ ok: r.ok, ct: r.headers.get('content-type'), size: (await r.blob()).size }))`);
      await rec(S, resp.ok && /image\//.test(resp.ct) && resp.size > 1000, { page: PG, control: "Stored photo is retrievable", expected: "Public URL returns an image", actual: JSON.stringify(resp), impact: "data loss", repro: "Open the cover URL of the saved row" });
    }
    await S.visit("/vault/item/" + x1.id); await sleep(2500);
    const shown1 = await S.evaluate("[...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 60 && /supabase\\.co\\/storage/.test(i.src)).map((i) => ({ w: i.naturalWidth, complete: i.complete }))");
    await rec(S, shown1.length > 0 && shown1.every((i) => i.complete && i.w > 0), { page: `/vault/item/${(x1.id || "").slice(0, 8)} | owner`, control: "Item page photo", expected: "The uploaded photo shows (decoded)", actual: JSON.stringify(shown1), impact: "misleading result", repro: "Open the saved item" });
    const S2 = await session("owner", { width: 1440, height: 900 });
    try {
      await S2.visit("/vault/item/" + x1.id); await sleep(2500);
      const sh2 = await S2.evaluate("[...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 60 && /supabase\\.co\\/storage/.test(i.src)).map((i) => ({ w: i.naturalWidth, complete: i.complete }))");
      await rec(S2, sh2.length > 0 && sh2.every((i) => i.complete && i.w > 0), { page: `/vault/item/${(x1.id || "").slice(0, 8)} | clean second browser`, control: "Item photo in a clean second browser", expected: "The photo shows from the cloud", actual: JSON.stringify(sh2), impact: "data loss", repro: "Save with photo, open the item in a second browser" });
    } finally { await S2.close(); }

    }
    // ---------------- several photos: order, cover, remove, retake ----------------
    await fresh(S);
    const t6 = PREFIX + "Multi " + Date.now().toString(36);
    await uploadFiles(S, "input[type=file]", png1, 0); await sleep(1800);
    await uploadFiles(S, "input[type=file]", [png2], 0); await sleep(1800);
    await clickText(S, "Add photos or video"); await sleep(500);
    const c2 = await thumbCount(S);
    await rec(S, c2 === 2, { page: PG, control: "+ Add photos or video (second photo)", expected: "Two photo thumbnails, each with a Remove button", actual: "remove buttons: " + c2, impact: "blocked workflow", repro: "Upload a photo, then add another" });
    // add a third through the '+ Add photos or video' input (the file input of that tile)
    const inputs = await S.evaluate("[...document.querySelectorAll('input[type=file]')].map((e) => ({ accept: e.accept, multiple: e.multiple, cap: e.getAttribute('capture') }))");
    await uploadFiles(S, "input[type=file]", [png3], inputs.findIndex((i) => i.multiple) >= 0 ? inputs.findIndex((i) => i.multiple) : 0); await sleep(1800);
    await rec(S, (await thumbCount(S)) === 3, { page: PG, control: "+ Add photos or video (third photo)", expected: "Three thumbnails", actual: "remove buttons: " + (await thumbCount(S)) + "; inputs " + JSON.stringify(inputs), impact: "blocked workflow", repro: "Add three photos" });
    // select photo 2 and make it the cover, then remove the third
    await click(S, "document.querySelector('[aria-label=\"Photo 2\"]')"); await sleep(600);
    const mc = await clickText(S, "^Make Cover$"); await sleep(800);
    await rec(S, !!mc, { page: PG, control: "Photo 2 thumbnail then Make Cover", expected: "Selecting the second photo offers Make Cover, and it becomes the COVER", actual: "Make Cover button present: " + !!mc + "; first thumbnail label now: " + (await S.evaluate("(document.querySelector('[aria-label=\"Cover photo\"]') || {}).textContent")), impact: "usability", repro: "Add 3 photos, click the second thumbnail, click Make Cover" });
    await click(S, "document.querySelectorAll('[aria-label=\"Remove photo\"]')[2]"); await sleep(700);
    await rec(S, (await thumbCount(S)) === 2, { page: PG, control: "Remove photo (x on the third thumbnail)", expected: "That photo goes; two remain", actual: "remaining: " + (await thumbCount(S)), impact: "usability", repro: "Add 3 photos, click the x on the third" });
    await typeInto(S, nameSel, t6); await save(S); await waitSaved(S, 80000);
    const r6 = await dbRow(t6, P, 40000); created.push(...r6); const x6 = r6[0] || {}; const im6 = Array.isArray(x6.images_json) ? x6.images_json : [];
    await rec(S, im6.length === 2 && im6.every((i) => !i.localOnly), { page: PG, control: "Save with 3 photos added, 1 removed", expected: "Exactly the 2 remaining photos are stored, both in the cloud", actual: JSON.stringify(im6.map((i) => ({ role: i.role, order: i.order, localOnly: i.localOnly }))), impact: "data loss", repro: "Add 3, remove 1, Save, read images_json" });
    const coverDims = x6.image_front_url ? await S.evaluate("fetch(" + JSON.stringify(x6.image_front_url) + ").then(async (r) => { const bm = await createImageBitmap(await r.blob()); return { w: bm.width, h: bm.height }; })").catch(() => null) : null;
    await rec(S, !!coverDims && coverDims.w === 640 && coverDims.h === 480, { page: PG, control: "Make Cover result after Save", expected: "The photo made cover (640x480) is the saved cover image", actual: "saved cover dimensions: " + JSON.stringify(coverDims) + "; images order roles: " + JSON.stringify(im6.map((i) => i.role)), impact: "misleading result", repro: "Make photo 2 the cover, Save, open the cover URL" });

    // ---------------- wrong file types / corrupt / oversize ----------------
    for (const [label, file] of [["a .txt text file", tmp("notes.txt")], ["a .pdf file", tmp("fake.pdf")], ["a corrupt .png (garbage bytes)", tmp("corrupt.png")]]) {
      await fresh(S);
      await uploadFiles(S, "input[type=file]", file, 0); await sleep(2500);
      const n = await thumbCount(S); const body = await text(S); const al = await alertText(S);
      const t = PREFIX + "Wrong " + label.slice(2, 6);
      await typeInto(S, nameSel, t); await save(S); const okw = await waitSaved(S, 40000);
      const rw = await dbRow(t, P, okw ? 20000 : 5000); created.push(...rw);
      const imgsW = rw[0] && Array.isArray(rw[0].images_json) ? rw[0].images_json.length : 0;
      const handled = (n === 0 && /not an image|unsupported|image file|invalid|couldn.t|choose an image|only images/i.test(body + al)) || (n === 0) || (okw && imgsW === 0 && /unsupported|invalid|couldn.t|not an image/i.test(body + al));
      await rec(S, n === 0 || imgsW === 0, { page: PG, control: `Upload (${label})`, expected: "Refused or ignored with a clear message; no broken photo is stored on the item", actual: `thumbnails after choosing: ${n}; message: '${(al || "none").slice(0, 100)}'; after Save: redirected=${okw}, stored images=${imgsW}, imageMessageShown=${/not an image|unsupported|invalid|couldn.t|only images/i.test(body)}`, impact: "misleading result", repro: `Upload ${label}, name the item, Save` });
    }
    // oversize (about 26 MB of incompressible PNG)
    await fresh(S);
    const big = mkPng(tmp("big.png"), 3000, 3000, [0, 0, 0], true); const bigSize = fs.statSync(big).size;
    const t0 = Date.now();
    await uploadFiles(S, "input[type=file]", big, 0); await sleep(6000);
    const nbig = await thumbCount(S);
    const tbig = PREFIX + "Big " + Date.now().toString(36);
    await typeInto(S, nameSel, tbig); await save(S); const okb = await waitSaved(S, 120000);
    const rb = await dbRow(tbig, P, 60000); created.push(...rb); const xb = rb[0] || {};
    let bigStored = null;
    if (xb.image_front_url) bigStored = await S.evaluate(`fetch(${JSON.stringify(xb.image_front_url)}).then(async (r) => { const b = await r.blob(); const bm = await createImageBitmap(b); return { size: b.size, w: bm.width, h: bm.height }; })`).catch((e) => ({ err: String(e).slice(0, 80) }));
    await rec(S, nbig === 1 && okb && !!xb.image_front_url && bigStored && bigStored.size < bigSize, { page: PG, control: `Upload (${(bigSize / 1048576).toFixed(0)} MB, 3000x3000 PNG)`, expected: "Accepted and stored at a sensible size, or refused with a message", actual: JSON.stringify({ chosenFileMB: +(bigSize / 1048576).toFixed(1), thumbnails: nbig, redirected: okb, stored: bigStored, seconds: Math.round((Date.now() - t0) / 1000), msg: await alertText(S) }), impact: "blocked workflow", repro: "Upload a 26 MB image, name the item, Save" });

    // ---------------- Identify with AI (intercepted) ----------------
    await fresh(S);
    const logBefore = await scansLogged(P); const itemsBefore = await allCount(P);
    const interceptedBefore = S.intercepted.length;
    await uploadFiles(S, "input[type=file]", png1, 0); await sleep(2000);
    await typeInto(S, nameSel, PREFIX + "Identify keep");
    await clickText(S, "Identify with AI"); await sleep(9000);
    const idBody = await text(S); const idAlert = await alertText(S);
    const aiCalls = S.intercepted.slice(interceptedBefore).filter((x) => /api\/ai/.test(x.url));
    const nameKept = await S.evaluate("document.getElementById('capture-item-name').value");
    const idBtn = await rectOf(S, T.btnExpr("Identify with AI|Identifying"));
    await rec(S, /Could not identify|fill (it )?in|manually|try again|unavailable|couldn.t/i.test(idBody), { page: PG, control: "Identify with AI (INTERCEPTED, not a successful AI result)", expected: "A clear message that identification failed and the form can be filled by hand", actual: `AI requests refused by the audit: ${aiCalls.length}; visible message: '${(idBody.match(/Could not identify[^.]*\./) || [idAlert || "none"])[0]}'`, impact: "misleading result", repro: "Upload a photo, click Identify with AI (AI is answered 503)" });
    await rec(S, nameKept === PREFIX + "Identify keep" && idBtn && !idBtn.disabled && (await allCount(P)) === itemsBefore, { page: PG, control: "Identify with AI refusal: data kept, button usable, no phantom item", expected: "Typed name kept, the button works again, no item created", actual: `name kept=${nameKept === PREFIX + "Identify keep"}; identify button disabled=${idBtn && idBtn.disabled}; items ${itemsBefore}->${await allCount(P)}`, impact: "data loss", repro: "As above, then check the name field and the item count" });
    await rec(S, (await scansLogged(P)) === logBefore, { page: PG, control: "Identify with AI refusal: AI quota", expected: "No scan is consumed when the AI call fails", actual: `ai_usage_log rows ${logBefore}->${await scansLogged(P)}`, impact: "misleading result", repro: "Click Identify with AI while AI is refused; compare usage rows" });

    // ---------------- interrupted connection ----------------
    await fresh(S);
    const t8 = PREFIX + "Interrupted " + Date.now().toString(36);
    await typeInto(S, nameSel, t8);
    await block(S, true);
    await save(S); await sleep(9000);
    const here = await S.path(); const bodyI = await text(S); const alI = await alertText(S);
    const rowDuring = await rowsByTitle(P, t8);
    await S.jshot("add-capture-interrupted");
    const tellsFailure = /not saved|couldn.t save|could not save|failed|offline|waiting to sync|will sync|pending|retry|isn't backed up|not backed up|saved on this device/i.test(bodyI + " " + alI);
    await rec(S, rowDuring.length === 0 && tellsFailure, { page: PG, control: "Save to Vault (connection to the database refused)", expected: "The page says the cloud save did not happen (and keeps the item safe on this device); not a plain success", actual: `database rows=${rowDuring.length}; now at ${here}; page says: '${(bodyI.match(/.{0,60}(not saved|couldn.t save|could not save|failed|offline|waiting to sync|will sync|pending|retry|backed up|on this device).{0,80}/i) || ["(no failure notice found)"])[0]}'`, impact: "data loss", repro: "Block requests to the vault_items table, fill a name, Save" });
    // is the item still there locally and queued?
    await S.visit("/vault/sync"); await sleep(2500);
    const syncTxt = await text(S);
    await rec(S, /\b1\b[^.]{0,40}(queued|pending)|Queued Changes\s*1|1 queued/i.test(syncTxt), { page: "/vault/sync | owner, after a refused save", control: "Offline capture queue after a refused save", expected: "The unsaved item is listed as queued", actual: (syncTxt.match(/STATUS.{0,200}/) || [syncTxt.slice(0, 200)])[0], impact: "data loss", repro: "Refuse the save, open /vault/sync" });
    await block(S, false);
    await clickText(S, "^(?:.*\\|)?Retry Sync$"); await sleep(9000);
    const rowAfter = await dbRow(t8, P, 30000); created.push(...rowAfter);
    await rec(S, rowAfter.length === 1, { page: "/vault/sync | owner", control: "Retry Sync (after the connection is back)", expected: "The queued item is saved once", actual: `database rows with that name: ${rowAfter.length}`, impact: "data loss", repro: "After a refused save, restore the connection and click Retry Sync" });
    await S.visit("/vault"); await sleep(1500); const dupe = await rowsByTitle(P, t8);
    await rec(S, dupe.length === 1, { page: "/vault | owner", control: "No duplicate after retry", expected: "One row", actual: "rows: " + dupe.length, impact: "data loss", repro: "Retry once connection is back and count" });

    // ---------------- offline with a photo ----------------
    await fresh(S);
    const t9 = PREFIX + "OfflinePhoto " + Date.now().toString(36);
    await uploadFiles(S, "input[type=file]", png1, 0); await sleep(1500);
    await typeInto(S, nameSel, t9);
    await offline(S, true); await sleep(500);
    await save(S); await sleep(7000);
    const offBody = await text(S); const rowOff = await rowsByTitle(P, t9);
    await S.jshot("add-capture-offline");
    await rec(S, rowOff.length === 0 && /offline|not saved|on this device|will sync|pending|waiting/i.test(offBody), { page: PG, control: "Save to Vault with a photo while offline", expected: "States the item is only on this device until the connection returns", actual: `database rows=${rowOff.length}; at ${await S.path()}; says: '${(offBody.match(/.{0,50}(offline|on this device|will sync|pending|waiting).{0,70}/i) || ["(no offline notice found)"])[0]}'`, impact: "data loss", repro: "Go offline, add a photo, name the item, Save" });
    await offline(S, false); await sleep(1500);
    await S.visit("/vault/sync"); await sleep(2000); await clickText(S, "^(?:.*\\|)?Retry Sync$"); await sleep(12000);
    const rowOn = await dbRow(t9, P, 40000); created.push(...rowOn); const xo = rowOn[0] || {}; const imo = Array.isArray(xo.images_json) ? xo.images_json : [];
    await rec(S, rowOn.length === 1 && imo.length === 1 && !!xo.image_front_url, { page: "/vault/sync | owner", control: "Retry Sync after an offline save with a photo", expected: "Item and its photo reach the cloud once", actual: `rows=${rowOn.length}; images=${imo.length}; cover url set=${!!xo.image_front_url}; localOnly=${imo[0] && imo[0].localOnly}`, impact: "data loss", repro: "Offline save with photo, back online, Retry Sync" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-capture2-error"); } catch {} }
  finally {
    try { await block(S, false); await offline(S, false); } catch {}
    await S.close();
    await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean));
    for (const p of mine()) console.log("leftover AUD ADD rows", (await rowsByTitle(p, PREFIX)).length);
  }
})();
