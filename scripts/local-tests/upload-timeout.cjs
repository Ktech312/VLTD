// The 45-second photo-upload limit, checked end to end on Add Item with a LATE storage answer (the simulator answers "success" after 52 s, i.e. after the app has given up):
//  A. timeout, then the late success arrives, then retry   - no item is created by the late success, no false success message replaces the failure, the form is never blocked, the retry creates exactly one
//     item that points at the NEW upload (the late file is an unreferenced leftover: the known orphan limitation), and two uploads never share a path (nothing can overwrite a newer photo).
//  B. leaving the page (in-app navigation) while the upload is still waiting - nothing is saved when the late answer arrives.
//  C. reloading the page while the upload is waiting - nothing is saved, no half item.
//  D. giving up after the timeout message (cancel = leave the page) - nothing is saved.
// Takes about 6 minutes (real 45-second waits). Run on its own: node scripts/local-tests/upload-timeout.cjs
const L = require("./lib.cjs"); const { sleep, check, sim } = L; const path = require("path");
const PHOTO = path.join(__dirname, "../../public/collectibles/guitar.png");
const mine = async (t) => (await L.dump("vault_items")).filter((r) => (r.title || "").startsWith(t));
const uploads = () => sim("/__sim/uploads");
const visible = (s) => s.evaluate(`JSON.stringify([...document.querySelectorAll("[role=alert],[role=status]")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.innerText.trim()))`).then(JSON.parse);
const saveLabel = (s) => s.evaluate(`[...document.querySelectorAll("button")].map((b) => b.innerText.trim()).find((t) => /^(Save|Saving)/.test(t)) || ""`);
async function prepare(s, title) {
  await s.go("/vault/add", 9000); await s.dismiss();
  const doc = await s.send("DOM.getDocument", { depth: 0 }); const multi = await s.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][multiple]" });
  await s.send("DOM.setFileInputFiles", { nodeId: multi.nodeId, files: [PHOTO] }); await sleep(2200);
  await s.setField("input[placeholder*='Name this item']", title); await s.setField("input[placeholder*='Series / set / run']", "Alt name for " + title);
}
const kept = async (s) => ({ title: await s.evaluate(`document.querySelector("input[placeholder*='Name this item']")?.value`), alt: await s.evaluate(`document.querySelector("input[placeholder*='Series / set / run']")?.value`), photo: /Active/.test(await s.text()) });
const clientNav = (s, href) => s.evaluate(`(() => { const a = document.querySelector('a[href="${href}"]') || document.querySelector('a[href="/dashboard"]'); if (!a) return false; a.click(); return true; })()`);
const LATE = 52000;
(async () => {
  // ---- A: timeout, late success, retry
  await sim("/__sim/reset"); let s = await L.open({ width: 1280, height: 1500 });
  try { await prepare(s, "LATE A item"); await sim("/__sim/fail?delay=" + LATE); await s.mclick("Save", true); await sleep(2500);
    check("A: while the upload waits the button says Saving", /Saving/.test(await saveLabel(s)), await saveLabel(s));
    await sleep(46500); // about 49 s after the tap: past the 45-second limit, before the late answer
    let msgs = await visible(s); check("A: after the limit the failure is shown (nothing says saved) and the button is Save again (form not blocked)", msgs.some((t) => /too long|couldn.t save/i.test(t)) && /^Save$/.test(await saveLabel(s)), [msgs, await saveLabel(s)]);
    let k = await kept(s); check("A: name, alternate name and photo are still on the page", k.title === "LATE A item" && k.alt === "Alt name for LATE A item" && k.photo, k);
    check("A: nothing was saved at the limit; one upload is still in flight at the storage", (await mine("LATE A")).length === 0 && (await uploads()).length === 1, [(await mine("LATE A")).length, (await uploads()).length]);
    await sleep(12000); // the late success has now arrived at the storage (the app no longer listens)
    msgs = await visible(s); check("A: after the late success arrives there is still no item, no success message replaced the failure, and the form still works", (await mine("LATE A")).length === 0 && !msgs.some((t) => /^(saved|item saved|added)/i.test(t)) && /^Save$/.test(await saveLabel(s)), [(await mine("LATE A")).length, msgs, await saveLabel(s)]);
    await sim("/__sim/fail?delay=0"); await s.mclick("Save", true); await sleep(5000); const rows = await mine("LATE A"); const ups = await uploads();
    check("A: retry creates exactly one item with its alternate name", rows.length === 1 && rows[0].subtitle === "Alt name for LATE A item", rows.map((r) => [r.id, r.subtitle]));
    check("A: the item points at the NEW upload, not at the late leftover, and no two uploads share a path (a late file cannot overwrite a newer photo)", ups.length === 2 && ups[0].path !== ups[1].path && !!rows[0] && String(ups[1].path).includes(String(rows[0].image_front_storage_path)) && !String(ups[0].path).includes(String(rows[0].image_front_storage_path)), { ups: ups.map((u) => u.path), saved: rows[0] && rows[0].image_front_storage_path });
    check("A: known limitation recorded - the late upload remains in storage as an unreferenced file (2 files for 1 item)", ups.length === 2, ups.length);
  } finally { await s.close(); await sim("/__sim/fail?delay=0"); }
  // ---- B: leave the page while waiting (in-app navigation)
  await sim("/__sim/reset"); s = await L.open({ width: 1280, height: 1500 });
  try { await prepare(s, "LATE B item"); await sim("/__sim/fail?delay=" + LATE); await s.mclick("Save", true); await sleep(8000); const nav = await clientNav(s, "/vault"); await sleep(3000);
    check("B: the page was left through the app's own navigation while the upload waited", nav === true, nav);
    await sleep(56000); // well past the limit and past the late answer
    check("B: nothing was saved after the person left (no item at the database)", (await mine("LATE B")).length === 0, (await mine("LATE B")).length);
    await s.go("/vault", 8000); await s.dismiss(); check("B: and none appears in the Vault on this device", !(await s.text()).includes("LATE B item"), 0);
  } finally { await s.close(); await sim("/__sim/fail?delay=0"); }
  // ---- C: reload while waiting
  await sim("/__sim/reset"); s = await L.open({ width: 1280, height: 1500 });
  try { await prepare(s, "LATE C item"); await sim("/__sim/fail?delay=" + LATE); await s.mclick("Save", true); await sleep(8000); await s.go("/vault/add", 8000); await s.dismiss(); await sleep(50000);
    check("C: after a reload during the wait and the late answer, no item was created", (await mine("LATE C")).length === 0, (await mine("LATE C")).length);
    const t = await s.text(); check("C: the reloaded form is clean (no half item, no 'saved on this device' notice for it)", !t.includes("LATE C item") && !/not in your account yet/i.test(t), t.slice(0, 160));
  } finally { await s.close(); await sim("/__sim/fail?delay=0"); }
  // ---- D: give up after the message
  await sim("/__sim/reset"); s = await L.open({ width: 1280, height: 1500 });
  try { await prepare(s, "LATE D item"); await sim("/__sim/fail?delay=" + LATE); await s.mclick("Save", true); await sleep(49000);
    const msgs = await visible(s); check("D: the failure message is showing", msgs.some((t) => /too long|couldn.t save/i.test(t)), msgs);
    await clientNav(s, "/vault"); await sleep(14000);
    check("D: leaving after the failure (and the late success) leaves nothing saved", (await mine("LATE D")).length === 0, (await mine("LATE D")).length);
  } finally { await s.close(); await sim("/__sim/fail?delay=0"); }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
