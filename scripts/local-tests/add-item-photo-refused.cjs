// Add Item: photo upload is refused by storage with a message the screen does not recognise. The person must still be told.
const L = require("./lib.cjs"); const { sleep, NL, check, sim } = L;
(async () => { const s = await L.open({ width: 1280, height: 1500 });
  try { await s.go("/vault/add", 9000); await s.dismiss();
    const doc = await s.send("DOM.getDocument", { depth: 0 }); const multi = await s.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][multiple]" }); await s.send("DOM.setFileInputFiles", { nodeId: multi.nodeId, files: [require("path").join(__dirname, "../../public/collectibles/guitar.png")] }); await sleep(2200);
    await s.setField("input[placeholder*='Name this item']", "LT visible item");
    await sim("/__sim/fail?storage=1&msg=" + encodeURIComponent("new row violates row-level security policy")); await s.mclick("Save", true); await sleep(3000);
    const vis = JSON.parse(await s.evaluate(`JSON.stringify([...document.querySelectorAll("[role=alert],[role=status]")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.innerText.trim()))`));
    console.log("visible messages:", JSON.stringify(vis));
    check("failed save shows a visible message", vis.length > 0, vis);
    check("nothing saved", (await L.dump("vault_items")).filter((r) => /LT visible/.test(r.title || "")).length === 0, 0);
    check("typed title kept", (await s.evaluate(`document.querySelector("input[placeholder*='Name this item']")?.value`)) === "LT visible item", 0);
    check("photo still attached", /Active/.test(await s.text()), 0);
    await sim("/__sim/fail?storage=0");
    await s.mclick("Save", true); await sleep(4000);
    check("retry saves exactly one item with the photo", (await L.dump("vault_items")).filter((r) => /LT visible/.test(r.title || "") && r.image_front_storage_path).length === 1, 0);
  } finally { await s.close(); }
  console.log(JSON.stringify(L.results())); process.exit(0); })();
