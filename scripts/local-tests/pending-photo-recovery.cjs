// Pending photos: kept across reload and a full browser restart, finished once when the account/storage are back, replaced or removed before sync,
// and never attached to (or uploaded by) another account that signs in on the same browser.
const L = require("./lib.cjs"); const { sleep, NL, check, sim, SECOND } = L; const path = require("path"); const os = require("os");
const PHOTO = path.join(__dirname, "../../public/collectibles/guitar.png"), PHOTO2 = path.join(__dirname, "../../public/collectibles/vinyl-record.png");
const rows = async (prefix) => (await L.dump("vault_items")).filter((r) => (r.title || "").startsWith(prefix));
const uploads = () => sim("/__sim/uploads");
const setOffline = (s) => s.evaluate(`Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }); window.dispatchEvent(new Event("offline")); true`);
async function attach(s, file, sel) { const doc = await s.send("DOM.getDocument", { depth: 0 }); const n = await s.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: sel || "input[type=file][multiple]" }); await s.send("DOM.setFileInputFiles", { nodeId: n.nodeId, files: [file] }); await sleep(2200); }
async function addOffline(s, title) { await s.go("/vault/add", 9000); await s.dismiss(); await attach(s, PHOTO); await s.setField("input[placeholder*='Name this item']", title); await setOffline(s); await s.mclick("Save", true); await sleep(3500); }
const localItem = (s, title) => s.evaluate(`(() => { try { const all = JSON.parse(localStorage.getItem("vltd_vault_items_v1") || "[]"); const it = all.find((x) => (x.title || "").startsWith(${JSON.stringify(title)})); return it ? JSON.stringify({ id: it.id, profile_id: it.profile_id, images: (it.images || []).map((i) => ({ localOnly: !!i.localOnly, key: i.storageKey })) }) : ""; } catch (e) { return ""; } })()`).then((x) => (x ? JSON.parse(x) : null));
(async () => {
  await sim("/__sim/reset"); await L.registerSecond();
  const dir = path.join(os.tmpdir(), "vltd-pending-" + Date.now());
  // 1. save offline, close the browser completely, start a new one on the same profile: the photo is still pending, then finishes once
  let s = await L.open({ width: 1280, height: 1400, userDir: dir }); let it;
  try { await addOffline(s, "PEND restart"); it = await localItem(s, "PEND restart"); check("offline save keeps the item and its photo on the device (photo pending)", it && it.images.some((i) => i.localOnly), it); check("nothing reached the account yet", (await rows("PEND restart")).length === 0 && (await uploads()).length === 0); } finally { await s.close(); }
  await sleep(1500);
  await sim("/__sim/fail?storage=1&msg=" + encodeURIComponent("temporarily unavailable"));
  s = await L.open({ width: 1280, height: 1400, userDir: dir, keepStorage: true });
  try { await s.go("/vault", 11000); let t = await s.text(); check("after a browser restart with storage still down: the item is still listed and no duplicate row exists", /PEND restart/.test(t) && (await rows("PEND restart")).length === 0, t.slice(0, 120));
    await sim("/__sim/fail?storage=0"); await s.go("/vault", 11000); await sleep(4000); const r = await rows("PEND restart"); check("storage back: exactly one row with the photo in storage", r.length === 1 && !!r[0].image_front_storage_path && r[0].profile_id === L.P, r.map((x) => [x.profile_id, x.image_front_storage_path]));
    check("the uploaded file belongs to this item", r[0] && (r[0].image_front_storage_path || "").includes(it.id), r[0] && r[0].image_front_storage_path);
    await s.go("/vault", 9000); await s.go("/vault", 9000); check("two more reloads add nothing (still one row, one successful upload)", (await rows("PEND restart")).length === 1 && (await uploads()).filter((u) => u.ok).length === 1, (await uploads()).length);
  } finally { await s.close(); await sim("/__sim/fail?storage=0"); }
  // 2. replace a pending photo before it syncs: the account gets only the replacement
  await sim("/__sim/reset"); await L.registerSecond();
  s = await L.open({ width: 1280, height: 1600 });
  try { await addOffline(s, "PEND replace"); it = await localItem(s, "PEND replace"); await s.go("/vault/item/" + it.id, 9000); await s.dismiss();
    const before = await localItem(s, "PEND replace"); await attach(s, PHOTO2, "input[type=file][accept^='image']:not([capture])").catch(() => {}); await s.mclick("Delete image", false); await sleep(1500);
    const after = await localItem(s, "PEND replace"); console.log("replace: images before", before && before.images.length, "after delete", after && after.images.length);
    await s.evaluate(`window.dispatchEvent(new Event("online"))`); await sleep(500); await s.go("/vault", 11000); await sleep(4000); const r = await rows("PEND replace"); const up = (await uploads()).filter((u) => u.ok);
    check("removing the pending photo: the item syncs with no photo and no upload happened", r.length === 1 && !r[0].image_front_storage_path && up.length === 0, [r.map((x) => x.image_front_storage_path), up.length]);
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
