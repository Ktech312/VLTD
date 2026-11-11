// Leftover-photo cleanup must ask the ACCOUNT, not only this device, before it removes a storage file; and when the account cannot be asked, it removes nothing.
// Two browsers are signed in to the same account. Browser 1 has written-down leftover paths (aged 10 minutes) and runs the cleanup (20 s after it loads). Browser 2 stands for "the other browser or phone":
// the records it saved to the account (an item front photo, a photo-list entry, an item back photo, an exhibition snapshot) are seeded into the simulated account AFTER browser 1 has loaded, so browser 1's
// own device copy does not know them. Every file that either browser's records refer to must survive; only the truly unreferenced file is removed; an unreachable account defers everything.
const L = require("./lib.cjs"); const { sleep, check, sim, seed, P, U } = L;
const KEY = "vltd_timed_out_uploads_v1"; const OLD = () => Date.now() - 10 * 60 * 1000;
const PATH = { front: "items/sim_two/front-ref.jpg", list: "items/sim_two/list-ref.jpg", back: "items/sim_two/back-ref.jpg", gallery: "items/sim_two/gallery-ref.jpg", device: "items/sim_two/device-only-ref.jpg", free: "items/sim_two/unreferenced.jpg", free2: "items/sim_two/unreferenced-after-outage.jpg" };
const setList = (s, paths) => s.evaluate(`localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(${JSON.stringify(paths)}.map((p) => ({ path: p, userId: ${JSON.stringify(U)}, at: ${OLD()} })))); true`);
const list = (s) => s.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) || "[]").map((e) => e.path)`);
const deleted = async () => (await sim("/__sim/deletes")).map((d) => d.replace(/^vault-images\//, ""));
const base = (id, extra) => ({ id, profile_id: P, title: "Two-browser item " + id, universe: "MISC", category: "Collectors Choice", status: "COLLECTION", created_at: 1790000000000, ...extra });
(async () => {
  await sim("/__sim/reset");
  const b1 = await L.open({ width: 1280, height: 900 }); const b2 = await L.open({ width: 1280, height: 900 });
  try {
    await b1.go("/dashboard", 9000); await b1.dismiss(); await b2.go("/dashboard", 9000); await b2.dismiss();
    // browser 2 saves four records that refer to files (one per kind of reference); browser 1 has not downloaded them
    await seed({ vault_items: [...(await L.dump("vault_items")), base("two_front", { image_front_storage_path: PATH.front }), base("two_list", { images_json: [{ id: "i", storageKey: PATH.list, url: "x", order: 0 }] }), base("two_back", { image_back_url: "http://localhost:54321/storage/v1/object/public/vault-images/" + PATH.back })],
      galleries: [...(await L.dump("galleries")), { id: "00000000-0000-4000-8000-0000000077aa", profile_id: P, title: "Two-browser exhibition", visibility: "LOCKED", state: "ACTIVE", public_token: "pub_two", layout: { itemIds: [], publicItemSnapshots: [{ id: "x", imageFrontStoragePath: PATH.gallery }] }, exhibition_layout: { itemIds: [], publicItemSnapshots: [] }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] });
    await b2.go("/vault", 10000); await b2.setField("[aria-label='Search the vault']", "Two-browser item two_front"); await sleep(2500); const t2 = await b2.text(); check("setup: browser 2 shows the records it saved to the account", /Two-browser item two_front/.test(t2), t2.slice(0, 120));
    await setList(b1, [PATH.front, PATH.list, PATH.back, PATH.gallery, PATH.free]);
    check("setup: browser 1 does not know those records on its own device", true, 0);
    await b1.go("/dashboard", 9000); await sleep(30000); // the cleanup runs 20 s after the page loads
    let dels = await deleted(); let left = await list(b1);
    check("a file referenced by the OTHER browser's item (front photo, photo list entry, back photo) or exhibition snapshot is NOT removed", ![PATH.front, PATH.list, PATH.back, PATH.gallery].some((p) => dels.includes(p)), dels);
    check("only the genuinely unreferenced leftover is removed", dels.length === 1 && dels[0] === PATH.free, dels);
    check("the referenced paths are taken off the list (nothing will ever try them again) and the removed one too", left.length === 0, left);
    // a photo referenced only on THIS device (saved there, not yet in the account) is protected by the device check
    await sim("/__sim/fail?write=1"); await b1.go("/vault/add", 9000); await b1.dismiss();
    const path = require("path"); const doc = await b1.send("DOM.getDocument", { depth: 0 }); const multi = await b1.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][multiple]" });
    await b1.send("DOM.setFileInputFiles", { nodeId: multi.nodeId, files: [path.join(__dirname, "../../public/collectibles/guitar.png")] }); await sleep(2200);
    await b1.setField("input[placeholder*='Name this item']", "Device-only photo item"); await b1.mclick("Save", true); await sleep(6000); await sim("/__sim/fail?write=0");
    const devPath = await b1.evaluate(`(() => { const raw = Object.entries(localStorage).find(([k]) => k === "vltd_vault_items_v1"); return raw ? raw[1].length : 0; })()`);
    const ups = (await sim("/__sim/uploads")).filter((u) => /items\//.test(u.path)); const devFile = ups.length ? ups[ups.length - 1].path.replace(/^vault-images\//, "") : "";
    check("setup: an item with an uploaded photo exists on browser 1 only (its save to the account was refused)", !!devFile && !(await L.dump("vault_items")).some((r) => r.title === "Device-only photo item"), { devFile, devPath });
    const before = (await deleted()).length; await setList(b1, [devFile]); await b1.go("/dashboard", 9000); await sleep(30000); dels = await deleted();
    check("a file referenced only by an item on THIS device is NOT removed either (device check), and is taken off the list", dels.length === before && !(await list(b1)).includes(devFile), { dels, list: await list(b1) });
    // the account cannot be asked: keep the file, keep the entry, remove nothing; later it works
    await setList(b1, [PATH.free2]); await sim("/__sim/fail?rest=1"); await b1.go("/dashboard", 6000); await sleep(32000); const during = await deleted();
    check("when the account cannot be asked, nothing is removed and the path stays written down (cleanup deferred)", during.length === before && (await list(b1)).includes(PATH.free2), { during, list: await list(b1) });
    await sim("/__sim/fail?rest=0"); await b1.go("/dashboard", 9000); await sleep(32000); const after = await deleted();
    check("when the account can be asked again the unreferenced file is removed and the list is clear", after.includes(PATH.free2) && !(await list(b1)).includes(PATH.free2), { after, list: await list(b1) });
  } finally { await b1.close(); await b2.close(); await sim("/__sim/fail?rest=0&write=0"); }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
