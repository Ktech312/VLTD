// Pending photos: kept across reload and a full browser restart, finished once when the account/storage are back, replaced or removed before sync,
// and never attached to (or uploaded by) another account that signs in on the same browser.
const L = require("./lib.cjs"); const { sleep, NL, check, sim, SECOND } = L; const path = require("path"); const os = require("os");
const PHOTO = path.join(__dirname, "../../public/collectibles/guitar.png"), PHOTO2 = path.join(__dirname, "../../public/collectibles/vinyl-record.png");
const rows = async (prefix) => (await L.dump("vault_items")).filter((r) => (r.title || "").startsWith(prefix));
const uploads = () => sim("/__sim/uploads");
const setOffline = (s) => s.evaluate(`Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }); window.dispatchEvent(new Event("offline")); true`);
async function attach(s, file, sel) { const doc = await s.send("DOM.getDocument", { depth: 0 }); const n = await s.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: sel || "input[type=file][multiple]" }); await s.send("DOM.setFileInputFiles", { nodeId: n.nodeId, files: [file] }); await sleep(2200); }
async function addOffline(s, title) { await s.go("/vault/add", 9000); await s.dismiss(); await attach(s, PHOTO); await s.setField("input[placeholder*='Name this item']", title); await setOffline(s); await s.mclick("Save", true); await sleep(3500); }
const zlib = require("zlib");
// The device copy of the vault is stored compressed ("z64:" + base64 zlib); read it here, not in the page.
const localItem = async (s, title) => { const raw = await s.evaluate(`localStorage.getItem("vltd_vault_items_v1") || ""`); let txt = raw; if (raw.startsWith("z64:")) { try { txt = zlib.inflateSync(Buffer.from(raw.slice(4), "base64")).toString("utf8"); } catch { txt = ""; } } let all = []; try { all = JSON.parse(txt || "[]"); } catch {} const it = all.find((x) => (x.title || "").startsWith(title)); return it ? { id: it.id, profile_id: it.profile_id, images: (it.images || []).map((i) => ({ localOnly: !!i.localOnly, key: i.storageKey })) } : null; };
(async () => {
  await sim("/__sim/reset"); await L.registerSecond();
  const dir = path.join(os.tmpdir(), "vltd-pending-" + Date.now());
  // 1. save offline, close the browser completely, start a new one on the same profile: the photo is still pending, then finishes once
  let s = await L.open({ width: 1280, height: 1400, userDir: dir }); let it;
  try { await addOffline(s, "PEND restart"); it = await localItem(s, "PEND restart"); check("offline save keeps the item and its photo on the device (photo pending)", it && it.images.some((i) => i.localOnly), it); check("nothing reached the account yet", (await rows("PEND restart")).length === 0 && (await uploads()).length === 0);
    await sleep(500); } finally { await s.close(); }
  await sleep(1500);
  await sim("/__sim/fail?storage=1&msg=" + encodeURIComponent("temporarily unavailable"));
  s = await L.open({ width: 1280, height: 1400, userDir: dir, keepStorage: true });
  try { await s.go("/vault", 11000); let t = await s.text(); const rr = await rows("PEND restart"); console.log("restart, storage down: listed", /PEND restart/.test(t), "| server rows", rr.length, rr.map((x) => x.image_front_storage_path), "| local", JSON.stringify(await localItem(s, "PEND restart")), "| uploads", JSON.stringify(await uploads()));
    check("after a browser restart with storage still down: the item is still listed and no photo-less duplicate/row was made", /PEND restart/.test(t) && rr.every((x) => !!x.image_front_storage_path), [rr.length, t.slice(0, 80)]);
    await sim("/__sim/fail?storage=0"); await s.go("/vault", 11000); await sleep(4000); const r = await rows("PEND restart"); check("storage back: exactly one row with the photo in storage", r.length === 1 && !!r[0].image_front_storage_path && r[0].profile_id === L.P, r.map((x) => [x.profile_id, x.image_front_storage_path]));
    check("the uploaded file belongs to this item", r[0] && (r[0].image_front_storage_path || "").includes(it.id), r[0] && r[0].image_front_storage_path);
    await s.go("/vault", 9000); await s.go("/vault", 9000); check("two more reloads add nothing (still one row, one successful upload)", (await rows("PEND restart")).length === 1 && (await uploads()).filter((u) => u.ok).length === 1, (await uploads()).length);
  } finally { await s.close(); await sim("/__sim/fail?storage=0"); }
  // 2. remove a pending photo before it syncs (in-app navigation keeps the device "offline"): the account gets the item with no photo and no upload ever happens
  await sim("/__sim/reset"); await L.registerSecond();
  s = await L.open({ width: 1280, height: 1600, accept: true });
  try { await addOffline(s, "PEND remove"); it = await localItem(s, "PEND remove"); await s.mclick("Vault", true); await sleep(3000); await s.mclick("PEND remove", false); await sleep(3500);
    check("stayed on the item page while still offline", (await s.evaluate("location.pathname")).includes("/vault/item/") && (await s.evaluate("navigator.onLine")) === false);
    await s.evaluate(`(() => { const b = [...document.querySelectorAll('button[aria-label="Delete image"]')]; if (b.length) b[b.length - 1].click(); return b.length; })()`); await sleep(2500);
    const after = await localItem(s, "PEND remove"); check("the pending photo is removed from the item on the device (confirmation was asked first)", after && after.images.length === 0 && (s.opts.dialogs || []).some((d) => /Delete this photo/.test(d)), [after, s.opts.dialogs]);
    await s.go("/vault", 11000); await sleep(4000); const r = await rows("PEND remove"); const up = (await uploads()).filter((u) => u.ok);
    check("back online: the item reaches the account once with no photo, and the removed photo was never uploaded", r.length === 1 && !r[0].image_front_storage_path && up.length === 0, [r.map((x) => x.image_front_storage_path), up.length]);
  } finally { await s.close(); }
  // 3. another account on the same browser never sends or receives this account's pending item/photo
  await sim("/__sim/reset"); await L.registerSecond();
  s = await L.open({ width: 1280, height: 1600 });
  try { await addOffline(s, "PEND owner-A"); it = await localItem(s, "PEND owner-A");
    await s.switchTo(SECOND); await s.go("/vault", 12000); let t = await s.text();
    check("second account signed in on the same browser does not see the first account's pending item", !/PEND owner-A/.test(t), t.slice(0, 160));
    await sleep(8000); check("while the second account is signed in nothing of the first account's is uploaded or saved", (await rows("PEND owner-A")).length === 0 && (await uploads()).length === 0, [(await rows("PEND owner-A")).length, (await uploads()).length]);
    // the second account adds its own item with a photo
    await s.go("/vault/add", 9000); await s.dismiss(); await attach(s, PHOTO2); await s.setField("input[placeholder*='Name this item']", "PEND second own"); await s.mclick("Save", true); await sleep(5000);
    const own = await rows("PEND second own"); check("the second account's own item is saved under its own profile with its own photo", own.length === 1 && own[0].profile_id === SECOND.profileId && /items\//.test(own[0].image_front_storage_path || "") && !(own[0].image_front_storage_path || "").includes(it.id), own.map((x) => [x.profile_id, x.image_front_storage_path]));
    check("no upload under the first account's item id happened for the second account", (await uploads()).every((u) => !u.path.includes(it.id)), (await uploads()).map((u) => u.path));
    await s.switchTo({ userId: L.U, profileId: L.P, email: "sim@example.com" }); await s.go("/vault", 12000); await sleep(4000);
    const a = await rows("PEND owner-A"); check("back on the first account its pending item finishes once, under its own profile, with its own photo", a.length === 1 && a[0].profile_id === L.P && (a[0].image_front_storage_path || "").includes(it.id), a.map((x) => [x.profile_id, x.image_front_storage_path]));
    check("the second account's item was not changed or duplicated by the switch back", (await rows("PEND second own")).length === 1);
  } finally { await s.close(); }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
