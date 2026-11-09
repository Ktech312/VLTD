// OPS-08: a photo added while the device reports "offline", then reload with storage still failing, then storage back.
const L = require("./lib.cjs"); const { sleep, NL, check, sim } = L;
const rowsOf = async () => (await L.dump("vault_items")).filter((r) => /^LT offline/.test(r.title || ""));
(async () => { const s = await L.open({ width: 1280, height: 1500 });
  try { await sim("/__sim/fail?storage=0");
    await s.go("/vault/add", 9000); await s.dismiss();
    const doc = await s.send("DOM.getDocument", { depth: 0 }); const multi = await s.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][multiple]" }); await s.send("DOM.setFileInputFiles", { nodeId: multi.nodeId, files: [require("path").join(__dirname, "../../public/collectibles/guitar.png")] }); await sleep(2200);
    await s.setField("input[placeholder*='Name this item']", "LT offline item");
    await s.evaluate(`Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }); window.dispatchEvent(new Event("offline")); true`);
    await s.mclick("Save", true); await sleep(3500);
    console.log("1. after offline save: path", await s.evaluate("location.pathname"), "| server rows:", (await rowsOf()).length);
    const local = await s.evaluate(`(async () => { const keys = Object.keys(localStorage).filter((k) => /vault/i.test(k)); let hit = 0; for (const k of keys) { try { if (/LT offline/.test(localStorage.getItem(k) || "")) hit++; } catch {} } const dbs = indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : []; return JSON.stringify({ keysWithItem: hit, dbs }); })()`);
    console.log("   local copy:", local);
    // 2. back online but storage still failing: reload the app
    await sim("/__sim/fail?storage=1&msg=" + encodeURIComponent("temporarily unavailable"));
    await s.go("/vault", 11000); let t = await s.text();
    let rows = await rowsOf(); console.log("2. reload with storage down: server rows", rows.length, "| photo path:", rows[0] && rows[0].image_front_storage_path, "| item visible:", /LT offline item/.test(t));
    console.log("   sync text:", t.split(NL).filter((x) => /sync|waiting|pending|upload|photo/i.test(x)).slice(0, 5).join(" | "));
    check("item still visible while its photo cannot upload", /LT offline item/.test(t), t.slice(0, 200));
    check("no duplicate row yet", rows.length <= 1, rows.length);
    // 3. storage back: another reload
    await sim("/__sim/fail?storage=0"); await s.go("/vault", 11000); await sleep(4000); t = await s.text(); rows = await rowsOf();
    console.log("3. storage restored: server rows", rows.length, "| photo path:", rows[0] && rows[0].image_front_storage_path);
    check("exactly one row after recovery", rows.length === 1, rows.length);
    check("photo reached storage after recovery", !!(rows[0] && rows[0].image_front_storage_path && !/^blob:|^data:/.test(rows[0].image_front_storage_path)), rows[0] && rows[0].image_front_storage_path);
    await s.go("/vault", 9000); rows = await rowsOf(); check("a further reload adds nothing", rows.length === 1, rows.length);
  } finally { await s.close(); await sim("/__sim/fail?storage=0"); }
  console.log(JSON.stringify(L.results())); process.exit(0); })();
