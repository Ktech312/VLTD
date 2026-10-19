// ITM photos: select, reorder (= primary), delete, preview, upload (real file via DOM.setFileInputFiles), edit-photo dialog. QA storage objects are removed by the cleanup script.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, typeIn, ENTER, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner } = X;
const zlib = require("zlib"); const fsx = require("fs"); const pathx = require("path");
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
function png(w, h, rgb, file) {
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1] ^ (x & 31) * 4; raw[o + 2] = rgb[2] ^ (y & 31) * 4; } }
  const crc = (buf) => { let c, crcT = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } let crcv = 0xffffffff; for (const b of buf) crcv = crcT[(crcv ^ b) & 255] ^ (crcv >>> 8); return (crcv ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fsx.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
(async () => {
  const S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
  const PG = (extra = "") => `/vault/item/[id] | owner, Personal, ${dev}${extra ? ", " + extra : ""}`;
  const { ck, nt, out } = X.makeCk(() => S, {});
  const tag = (MOBILE ? "m" : "d");
  const mk3 = () => ["comic-slab", "sports-slab", "vinyl-record"].map((n, i) => ({ id: `/collectibles/${n}.png#${i}`, storageKey: `/collectibles/${n}.png`, url: `/collectibles/${n}.png`, order: i, localOnly: false, role: i === 0 ? "primary" : "detail", isPrivateStorage: false }));
  const openP = async (id) => { await X.openItem(S, id); await dismissBanner(S); await sleep(300); };
  const thumbs = () => S.evaluate(`[...document.querySelectorAll('button[aria-label^="Show photo"]')].map((b) => (b.querySelector('img')||{}).getAttribute && b.querySelector('img').getAttribute('src'))`);
  const mainSrc = () => S.evaluate(`(() => { const b = document.querySelector('button[aria-label="Open photo preview"] img'); return b ? b.getAttribute('src') : null; })()`);
  try {
    const imgs = mk3();
    const id = await mkItem("pho" + tag, { title: "QA ITM photos", images_json: imgs, image_front_url: imgs[0].url, image_front_storage_path: imgs[0].storageKey, primary_image_key: imgs[0].storageKey });
    await openP(id);
    let th = await thumbs();
    await ck(th.length === 3, { page: PG("3 photos"), control: "Photo rail thumbnails", expected: "One thumbnail per saved photo (3)", actual: `thumbnails=${th.length}: ${th.join(" | ")}`, repro: "Open an item with 3 photos" });
    // select
    await mclick(S, `document.querySelector('button[aria-label="Show photo 2"]')`); await sleep(500);
    let ms = await mainSrc();
    await ck(ms && ms.includes("sports-slab"), { page: PG(), control: "Show photo 2 (thumbnail click)", expected: "The large photo switches to photo 2", actual: `main src=${ms}`, repro: "Click the second thumbnail" });
    // boundary: first Move up disabled, last Move down disabled
    const dis = await S.evaluate(`(() => { const up=[...document.querySelectorAll('button[aria-label="Move up"]')]; const dn=[...document.querySelectorAll('button[aria-label="Move down"]')]; return { up0: up[0].disabled, upLast: up[up.length-1].disabled, dn0: dn[0].disabled, dnLast: dn[dn.length-1].disabled, n: up.length }; })()`);
    await ck(dis.up0 && !dis.upLast && !dis.dn0 && dis.dnLast, { page: PG(), control: "Move up / Move down at the ends", expected: "First photo cannot move up, last cannot move down; the others can", actual: JSON.stringify(dis), repro: "Look at the arrow buttons under each thumbnail" });
    // move photo 1 down: order becomes sports, comic, vinyl; primary should follow the first position
    await mclick(S, `document.querySelectorAll('button[aria-label="Move down"]')[0]`); await sleep(1500);
    th = await thumbs();
    let d = await dbWait(id, (r) => (r.images_json || [])[0]?.storageKey?.includes("sports-slab"), 25000);
    await ck(th[0].includes("sports-slab") && d.ok, { page: PG(), control: "Move down (photo 1)", expected: "Photo order changes on screen and saves: sports-slab is now first", actual: `screen=${th.map((u) => u.split("/").pop()).join(",")}; db order=${(d.row.images_json || []).map((i) => (i.storageKey || "").split("/").pop()).join(",")}`, repro: "Click Move down under photo 1" });
    await ck(d.ok && (d.row.image_front_url || "").includes("sports-slab"), { page: PG(), control: "Primary photo follows the first position", expected: "After reordering, the new first photo is the item's main photo (image_front_url, used on cards and Share)", actual: `image_front_url=${d.row.image_front_url}; primary_image_key=${d.row.primary_image_key}`, repro: "Move photo 2 above photo 1; read the item's main photo", impact: "misleading result" });
    const badge = await S.evaluate(`[...document.querySelectorAll('button[aria-label^="Show photo"]')].map(b=>(b.innerText||'').trim())`);
    await ck(/Primary/i.test(badge[0]) && !/Primary/i.test(badge[1] || ""), { page: PG(), control: "Primary badge on the thumbnails after a move", expected: "Only the first thumbnail carries the Primary badge", actual: JSON.stringify(badge), repro: "Move photos; read badges" });
    // reload keeps order
    await openP(id); th = await thumbs();
    await ck(th[0].includes("sports-slab"), { page: PG(), control: "Photo order after reload", expected: "Reload shows the saved order", actual: th.map((u) => u.split("/").pop()).join(","), repro: "Reload" });
    // move up the last
    await mclick(S, `[...document.querySelectorAll('button[aria-label="Move up"]')].pop()`); await sleep(1500);
    d = await dbWait(id, (r) => (r.images_json || [])[1]?.storageKey?.includes("vinyl-record"), 25000);
    await ck(d.ok, { page: PG(), control: "Move up (last photo)", expected: "Vinyl moves to position 2 and saves", actual: `db order=${(d.row.images_json || []).map((i) => (i.storageKey || "").split("/").pop()).join(",")}`, repro: "Click Move up under photo 3" });
    // preview
    await mclick(S, `document.querySelector('button[aria-label="Open photo preview"]')`); await sleep(700);
    let pv = await S.evaluate(`!!document.querySelector('button[aria-label="Close preview"]')`);
    await ck(pv, { page: PG(), control: "Open photo preview (click the large photo)", expected: "A preview panel opens with the photo and a Close button", actual: pv ? "preview open" : "no preview", repro: "Click the main photo" });
    const prevInfo = await S.evaluate(`(() => { const c = document.querySelector('button[aria-label="Close preview"]'); const p = c && c.parentElement; return { btns: [...p.querySelectorAll('button')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()), imgs: p.querySelectorAll('img').length }; })()`);
    nt({ page: PG(), control: "Photo preview zoom", expected: "Improvement note: the preview shows the photo larger but has no zoom / pinch control and no next/previous arrows (buttons: " + prevInfo.btns.join(", ") + ")", actual: "see expected", impact: "improvement", repro: "Open preview; look for zoom/next controls" });
    await S.shot && 0;
    await ESC(S); await sleep(400);
    let stillOpen = await S.evaluate(`!!document.querySelector('button[aria-label="Close preview"]')`);
    await ck(!stillOpen, { page: PG(), control: "Photo preview -> Escape", expected: "Escape closes the preview", actual: stillOpen ? "preview still open after Escape" : "closed", repro: "Open preview; press Escape", impact: "usability" });
    if (stillOpen) await mclick(S, `document.querySelector('button[aria-label="Close preview"]')`);
    await sleep(400);
    await mclick(S, `document.querySelector('button[aria-label="Open photo preview"]')`); await sleep(600);
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: WIDTH / 2, y: MOBILE ? 780 : 880, button: "left", clickCount: 1 }); await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: WIDTH / 2, y: MOBILE ? 780 : 880, button: "left", clickCount: 1 }); await sleep(500);
    stillOpen = await S.evaluate(`!!document.querySelector('button[aria-label="Close preview"]')`);
    await ck(!stillOpen, { page: PG(), control: "Photo preview -> click the dim backdrop", expected: "Clicking outside the panel closes it", actual: stillOpen ? "still open" : "closed", repro: "Open preview; click the dark area below the panel" });
    if (stillOpen) await mclick(S, `document.querySelector('button[aria-label="Close preview"]')`);
    await sleep(400);
    // delete the middle photo (one click, no confirmation)
    th = await thumbs(); const n0 = th.length;
    await mclick(S, `document.querySelectorAll('button[aria-label="Delete image"]')[1]`); await sleep(1800);
    const dialogs = S.dialogs.length;
    th = await thumbs();
    d = await dbWait(id, (r) => (r.images_json || []).length === 2, 25000);
    await ck(th.length === n0 - 1 && d.ok, { page: PG(), control: "Delete image (photo 2 of 3)", expected: "Exactly the chosen photo is removed on screen and in the account; the others stay", actual: `screen thumbs ${n0}->${th.length}; db remaining=${(d.row.images_json || []).map((i) => (i.storageKey || "").split("/").pop()).join(",")} (removed vinyl-record expected)`, repro: "Click the trash under the 2nd thumbnail" });
    nt({ page: PG(), control: "Delete image has no confirmation", expected: "Improvement note: a photo is removed by one click with no confirm and no undo (browser dialogs seen: " + dialogs + ")", actual: "photo removed immediately", impact: "improvement", repro: "Click Delete image" });
    await ck(d.ok && !(d.row.images_json || []).some((i) => (i.storageKey || "").includes("vinyl-record")), { page: PG(), control: "Delete image removes the right file reference", expected: "The deleted photo is gone from the item's list (not a different one)", actual: `db keys=${(d.row.images_json || []).map((i) => (i.storageKey || "").split("/").pop()).join(",")}`, repro: "Delete photo 2; compare which remain" });
    // delete down to zero
    await mclick(S, `document.querySelectorAll('button[aria-label="Delete image"]')[0]`); await sleep(1500);
    await mclick(S, `document.querySelectorAll('button[aria-label="Delete image"]')[0]`); await sleep(1800);
    const t0 = await text(S);
    d = await dbWait(id, (r) => (r.images_json || []).length === 0, 25000);
    await ck(d.ok && /No main collector image yet/.test(t0), { page: PG("0 photos"), control: "Delete the last photo", expected: "Item shows the no-photo state ('No main collector image yet') and the account has no photos; the item itself stays", actual: `db images=${(d.row.images_json || []).length} image_front_url=${d.row.image_front_url}; page: ${/No main collector image yet/.test(t0)}`, repro: "Delete every photo of an item" });
    await ck(d.ok && !d.row.image_front_url, { page: PG(), control: "Main photo cleared after deleting all photos", expected: "image_front_url is cleared too (no dangling link to the deleted photo)", actual: `image_front_url=${d.row.image_front_url} primary=${d.row.primary_image_key}`, repro: "Delete all photos; read image_front_url", impact: "misleading result" });

    // ---- upload a real file ----
    const f1 = pathx.join(__dirname, "itm-up-1.png"); png(96, 64, [200, 40, 40], f1);
    const f2 = pathx.join(__dirname, "itm-up-2.png"); png(64, 96, [40, 40, 200], f2);
    await openP(id);
    const fileNode = await S.send("Runtime.evaluate", { expression: `document.querySelector('input[type=file]:not([capture])')` });
    const docNode = await S.send("DOM.getDocument", {}); const q = await S.send("DOM.querySelector", { nodeId: docNode.root.nodeId, selector: "input[type=file][multiple]" });
    await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [f1] }); await sleep(1500);
    const review = await S.evaluate(`!!([...document.querySelectorAll('button')].find(b=>/^Use Photo$/.test((b.innerText||'').trim())))`);
    await ck(review, { page: PG("0 photos"), control: "Upload photo from device (one file)", expected: "Choosing one file opens the Photo Review step (Rotate / Use Photo / Retake)", actual: review ? "PHOTO REVIEW shown" : "no review step", repro: "Click upload; choose a file" });
    await mclick(S, byText("^Rotate 90", "button")); await sleep(300);
    const rot = await text(S);
    await ck(/Rotate:\s*90°/.test(rot), { page: PG(), control: "Rotate 90° (photo review)", expected: "Rotation reads 90°", actual: (rot.match(/Rotate: \S+/) || [""])[0], repro: "In Photo Review click Rotate 90°" });
    await mclick(S, byText("^Use Photo$", "button")); await sleep(500);
    d = await dbWait(id, (r) => (r.images_json || []).length === 1, 40000);
    await ck(d.ok && /^https?:/.test(d.row.image_front_url || ""), { page: PG(), control: "Use Photo (upload)", expected: "The photo uploads, is saved on the item and becomes its main photo (a real URL)", actual: `db images=${(d.row.images_json || []).length} front=${(d.row.image_front_url || "").slice(0, 90)}`, repro: "Upload a file; Use Photo" });
    let loaded = false;
    if (d.ok) { const r = await fetch(d.row.image_front_url).catch(() => null); loaded = !!(r && r.ok); }
    await ck(loaded, { page: PG(), control: "Uploaded photo is reachable", expected: "The saved photo URL serves the image (HTTP 200)", actual: `fetch ok=${loaded}`, repro: "Open the saved image URL" });
    const msg = await S.evaluate(`document.querySelector('#media')?.innerText.match(/Images saved\\.|Uploading[^\\n]*|[^\\n]*Saved locally[^\\n]*/)?.[0] || ''`);
    await ck(/Images saved/.test(msg) || msg === "", { page: PG(), control: "Upload status message", expected: "A success message ('Images saved.') or none; never a 'Saved locally' fallback while online", actual: `message="${msg}"`, repro: "Upload a photo", impact: "misleading result" });
    // two files at once (multiple -> goes straight in)
    await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [f1, f2] }); await sleep(800);
    d = await dbWait(id, (r) => (r.images_json || []).length === 3, 40000);
    await ck(d.ok, { page: PG(), control: "Upload photo from device (two files at once)", expected: "Both files are added (3 photos total)", actual: `db images=${(d.row.images_json || []).length}`, repro: "Choose two files in the upload dialog" });
    // reload keeps; thumbnails load
    await openP(id); th = await thumbs();
    const allLoaded = await S.evaluate(`[...document.querySelectorAll('button[aria-label^="Show photo"] img')].every(i => i.complete && i.naturalWidth > 0)`);
    await ck(th.length === 3 && allLoaded, { page: PG("3 uploaded photos"), control: "Uploaded photos after reload", expected: "All three thumbnails load after reload", actual: `thumbs=${th.length} all decoded=${allLoaded}`, repro: "Reload the item" });
    // Edit Photo dialog: open, rotate, cancel/close
    await mclick(S, byText("^Edit Photo$", "button")); await sleep(1200);
    const ed = await S.evaluate(`!!document.querySelector('[role=dialog][aria-label="Edit saved photo"]')`);
    await ck(ed, { page: PG(), control: "Edit Photo", expected: "Opens the Edit saved photo dialog", actual: ed ? "dialog open" : "no dialog (see screenshot)", repro: "Click Edit Photo above the large photo" });
    if (ed) {
      const edText = await S.evaluate(`document.querySelector('[role=dialog][aria-label="Edit saved photo"]').innerText.replace(/\\s+/g,' ')`);
      const btns = await S.evaluate(`[...document.querySelector('[role=dialog][aria-label="Edit saved photo"]').querySelectorAll('button')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim())`);
      nt({ page: PG(), control: "Edit Photo dialog buttons", expected: "Observation: " + btns.join(" | "), actual: edText.slice(0, 160), impact: "none", repro: "Open Edit Photo" });
      await ESC(S); await sleep(500);
      let still = await S.evaluate(`!!document.querySelector('[role=dialog][aria-label="Edit saved photo"]')`);
      if (still) { const cl = btns.find((b) => /^(Close|Cancel)$/i.test(b)); if (cl) await mclick(S, byText("^" + cl + "$", "[role=dialog] button")); await sleep(500); }
      await ck(!still, { page: PG(), control: "Edit Photo dialog -> Escape", expected: "Escape closes the editor without saving", actual: still ? "dialog stayed open after Escape" : "closed", repro: "Open Edit Photo; Escape", impact: "usability" });
    }
    // Remove BG: starts a client-side cutout model download
    nt({ page: PG(), control: "Remove BG", expected: "Not exercised: starts a background-removal model download from an external host (no AI credits are spent but it is an external download)", actual: "NOT TESTED by choice (external model download)", impact: "none", repro: "n/a" });
    nt({ page: PG(), control: "Camera / Add photo with camera", expected: "Not exercised: needs a physical camera (file input with capture); the upload path above covers the same Photo Review step", actual: "NOT TESTED (no camera in headless browser)", impact: "none", repro: "n/a" });
    // roles
    nt({ page: PG(), control: "Set as primary / detail / proof", expected: "The item page offers no role buttons (they exist in the shared photo component but this page does not enable them); the Primary badge follows the first photo (see Move down row)", actual: `role buttons present: ${await S.evaluate(`document.querySelectorAll('button[aria-label^="Set as"]').length`)}`, impact: "improvement", repro: "Look for P / D / checkmark buttons under thumbnails" });
    // delete uploaded photos so the storage objects are removed by the app itself
    const keys = (await dbItem(id)).images_json.map((i) => i.storageKey);
    for (let i = 0; i < 3; i++) { await mclick(S, `document.querySelectorAll('button[aria-label="Delete image"]')[0]`); await sleep(1800); }
    d = await dbWait(id, (r) => (r.images_json || []).length === 0, 25000);
    let left = 0; for (const k of keys) { const dir = k.split("/").slice(0, -1).join("/"); const base = k.split("/").pop(); const l = await admin.storage.from("vault-images").list(dir, { limit: 100 }); if ((l.data || []).some((o) => o.name === base)) left++; }
    await ck(d.ok && left === 0, { page: PG(), control: "Delete image removes the uploaded file from storage", expected: "After deleting an uploaded photo its file is removed from storage (no orphan)", actual: `db images=${(d.row.images_json || []).length}; storage objects still present=${left} of ${keys.length}`, repro: "Upload a photo, then Delete image; list the storage folder", impact: "misleading result" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "photos suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { console.log(JSON.stringify(X.sumRows(out))); await S.close(); process.exit(0); }
})();
