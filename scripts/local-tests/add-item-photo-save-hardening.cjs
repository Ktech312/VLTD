// Add Item with a photo: storage refusal, slow storage (timeout), reconnect, retry creating exactly one item, repeated Save taps. Name and alternate name (Subtitle / Set) must survive every failure.
const L = require("./lib.cjs"); const { sleep, NL, check, sim } = L; const path = require("path");
const PHOTO = path.join(__dirname, "../../public/collectibles/guitar.png");
const mine = async (t) => (await L.dump("vault_items")).filter((r) => (r.title || "").startsWith(t));
const visible = (s) => s.evaluate(`JSON.stringify([...document.querySelectorAll("[role=alert],[role=status]")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.innerText.trim()))`).then(JSON.parse);
async function prepare(s, title) {
  await s.go("/vault/add", 9000); await s.dismiss();
  const doc = await s.send("DOM.getDocument", { depth: 0 }); const multi = await s.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][multiple]" });
  await s.send("DOM.setFileInputFiles", { nodeId: multi.nodeId, files: [PHOTO] }); await sleep(2200);
  await s.setField("input[placeholder*='Name this item']", title); await s.setField("input[placeholder*='Series / set / run']", "Alt name for " + title);
}
const kept = async (s, title) => ({ title: await s.evaluate(`document.querySelector("input[placeholder*='Name this item']")?.value`), alt: await s.evaluate(`document.querySelector("input[placeholder*='Series / set / run']")?.value`), photo: /Active/.test(await s.text()) });
(async () => {
  // 1. refusal, then reconnect and retry
  let s = await L.open({ width: 1280, height: 1500 });
  try { await prepare(s, "HARD refusal item");
    await sim("/__sim/fail?storage=1&msg=" + encodeURIComponent("new row violates row-level security policy")); await s.mclick("Save", true); await sleep(3000);
    check("refusal: a visible message is shown", (await visible(s)).some((t) => /Couldn.t save this item/.test(t)), await visible(s));
    let k = await kept(s, ""); check("refusal: name, alternate name and photo are still on the page", k.title === "HARD refusal item" && k.alt === "Alt name for HARD refusal item" && k.photo, k);
    check("refusal: nothing was saved", (await mine("HARD refusal")).length === 0);
    check("refusal: the Save button works again (not stuck on Saving)", /^Save$/.test(await s.evaluate(`[...document.querySelectorAll("button")].map((b) => b.innerText.trim()).find((t) => /^(Save|Saving)/.test(t)) || ""`)));
    await sim("/__sim/fail?storage=0"); await s.mclick("Save", true); await sleep(4000);
    let rows = await mine("HARD refusal"); check("reconnect + retry: exactly one item, with its photo and alternate name", rows.length === 1 && !!rows[0].image_front_storage_path && rows[0].subtitle === "Alt name for HARD refusal item", rows.map((r) => [r.id, r.image_front_storage_path, r.subtitle]));
  } finally { await s.close(); await sim("/__sim/fail?storage=0"); }
  // 2. repeated Save taps while storage is slow (8 s): one item only
  s = await L.open({ width: 1280, height: 1500 });
  try { await prepare(s, "HARD tap item"); await sim("/__sim/fail?delay=8000");
    await s.mclick("Save", true); await sleep(300); await s.mclick("Save", true); await sleep(300);
    await s.evaluate(`(() => { const b = [...document.querySelectorAll("button")].find((x) => /^(Save|Saving)/.test(x.innerText.trim())); b.click(); b.click(); b.click(); return true; })()`);
    await s.evaluate(`document.querySelector("input[placeholder*='Name this item']")?.focus()`); await s.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }); await s.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    check("slow storage: the button shows Saving while the upload runs", /Saving/.test(await s.text()));
    await sleep(14000); const rows = await mine("HARD tap"); check("repeated Save taps (3 mouse, 3 same-tick clicks, Enter) create exactly one item", rows.length === 1, rows.map((r) => r.id));
  } finally { await s.close(); await sim("/__sim/fail?delay=0"); }
  // 3. storage that never answers in a reasonable time: the person must get the button back with a message
  s = await L.open({ width: 1280, height: 1500 });
  try { await prepare(s, "HARD hang item"); await sim("/__sim/fail?delay=100000"); await s.mclick("Save", true); await sleep(70000);
    const label = await s.evaluate(`[...document.querySelectorAll("button")].map((b) => b.innerText.trim()).find((t) => /^(Save|Saving)/.test(t)) || ""`); const msgs = await visible(s);
    check("hung upload: after 70 s the Save button is back and a message says what happened", /^Save$/.test(label) && msgs.some((t) => /timed out|too long|couldn.t save/i.test(t)), [label, msgs]);
    const k = await kept(s, ""); check("hung upload: name, alternate name and photo still on the page", k.title === "HARD hang item" && k.alt === "Alt name for HARD hang item" && k.photo, k);
    await sim("/__sim/fail?delay=0"); await s.mclick("Save", true); await sleep(5000); const rows = await mine("HARD hang"); check("hung upload then retry: exactly one item", rows.length === 1, rows.length);
  } finally { await s.close(); await sim("/__sim/fail?delay=0"); }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
