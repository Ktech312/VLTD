// A photo that exists only on this device must be CLEARLY labelled as not saved to the account, on the screen where it was added, in the shared status pill, and after a reload; and the label must go
// away once the account has it. Also: a photo that did reach the account still says "Images saved." (no false warning). Found by this test: the item page used to replace its own "saved on this device"
// message with "Images saved." / "Edited photo saved." right after a failed upload.
const L = require("./lib.cjs"); const { sleep, NL, check, sim } = L; const path = require("path");
const PHOTO = path.join(__dirname, "../../public/collectibles/guitar.png");
const ITEM = "sim_item_1"; const norm = (t) => t.split(NL).map((x) => x.trim()).filter(Boolean).join(" | ");
const media = (s) => s.evaluate(`(document.querySelector("#media") || { innerText: "" }).innerText`).then(norm);
const pill = (s) => s.evaluate(`[...document.querySelectorAll("*")].some((e) => e.children.length === 0 && /Saved on this device — not in your account yet/.test(e.innerText || "") && e.getBoundingClientRect().height > 0)`);
async function addTwo(s) { const doc = await s.send("DOM.getDocument", { depth: 0 }); const q = await s.send("DOM.querySelectorAll", { nodeId: doc.root.nodeId, selector: "input[type=file][multiple]" });
  for (const nid of q.nodeIds) { const a = (await s.send("DOM.getAttributes", { nodeId: nid })).attributes.join(" "); if (/\.pdf/.test(a)) continue; await s.send("DOM.setFileInputFiles", { nodeId: nid, files: [PHOTO, PHOTO] }); return true; } return false; }
(async () => {
  await sim("/__sim/reset"); let s = await L.open({ width: 1280, height: 1800 });
  try {
    // 1. photos reach the account: normal message, no warning
    await s.go("/vault/item/" + ITEM, 10000); await s.dismiss(); await addTwo(s); await sleep(7000); let m = await media(s);
    check("photos that reach the account: 'Images saved.' and no device-only warning", /Images saved\./.test(m) && !/on this device only/.test(m) && !(await pill(s)), m.slice(-160));
    // 2. storage refuses: the screen says so
    await sim("/__sim/fail?storage=1&msg=" + encodeURIComponent("simulated storage refusal")); await s.go("/vault/item/" + ITEM, 10000); await s.dismiss(); await addTwo(s); await sleep(7000); m = await media(s);
    check("storage refuses: the media section says the photo is on this device only, not in the account yet (and not 'Images saved.')", /on this device only — not in your account yet/.test(m) && !/Images saved\./.test(m.split("MEDIA").pop().slice(-200)), m.slice(-260));
    check("storage refuses: the shared status pill also says 'Saved on this device — not in your account yet'", await pill(s), 0);
    // 3. reload while the account is unreachable: still labelled
    await sim("/__sim/fail?rest=1&write=1"); await s.go("/vault/item/" + ITEM, 11000); await s.dismiss();
    check("after a reload with the account unreachable the status pill still says not in your account yet", await pill(s), 0);
    // 4. the account is reachable again: the photos upload and the label goes away
    await sim("/__sim/fail?rest=0&write=0&storage=0"); await s.go("/vault/item/" + ITEM, 9000); await sleep(40000);
    check("once the account can take them, the label goes away", !(await pill(s)), 0);
  } finally { await s.close(); await sim("/__sim/fail?rest=0&write=0&storage=0"); }
  // 5. Add Item saved offline with a photo: labelled on the form, then in the Vault list while the account is unreachable
  await sim("/__sim/reset"); s = await L.open({ width: 1280, height: 1500 });
  try { await s.go("/vault/add", 9000); await s.dismiss(); const doc = await s.send("DOM.getDocument", { depth: 0 }); const multi = await s.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][multiple]" });
    await s.send("DOM.setFileInputFiles", { nodeId: multi.nodeId, files: [PHOTO] }); await sleep(2200); await s.setField("input[placeholder*='Name this item']", "Offline photo item");
    await s.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }); await s.evaluate(`Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }); window.dispatchEvent(new Event("offline")); true`);
    await s.mclick("Save", true); await sleep(3000); let t = norm(await s.text());
    check("Add Item saved offline with a photo: the form says it is saved on this device and uploads when back online", /Saved on this device — you are offline/.test(t), t.slice(0, 200));
    await s.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); await sim("/__sim/fail?rest=1&storage=1"); await s.go("/vault", 11000); await s.dismiss(); t = norm(await s.text());
    check("the Vault list shows the item with 'Saved on this device — not in your account yet' while the account is unreachable", /Offline photo item/.test(t) && /Saved on this device — not in your account yet/.test(t), t.slice(0, 200));
    await sim("/__sim/fail?rest=0&storage=0"); await s.go("/vault", 9000); await sleep(40000); const rows = (await L.dump("vault_items")).filter((r) => r.title === "Offline photo item");
    check("when the account is reachable again the item and its photo reach it once, and the label goes away", rows.length === 1 && !!rows[0].image_front_storage_path && !(await pill(s)), rows.map((r) => [r.id, r.image_front_storage_path]));
  } finally { await s.close(); await sim("/__sim/fail?rest=0&write=0&storage=0"); }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
