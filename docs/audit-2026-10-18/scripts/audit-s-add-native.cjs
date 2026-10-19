// ADD audit, suite 2c: /capture 'Take Real Photo' (native camera input + crop step), thumbnail press-and-drag to make a photo the cover, accordion sections, Bulk upload link.
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, rec, click, clickText, typeInto, text, rowsByTitle, removeItems, mine, rectOf, mouseAt, chooseViaButton, mkPng, tmp, poll, controls } = T;
const PG = "/capture | owner, Personal, 26 items";
const PREFIX = "AUD ADD X ";
const created = [];
const labels = async (S) => (await controls(S)).filter((c) => c.visible && c.kind === "button" && !/Unlocked|Locked/.test(c.label)).map((c) => c.label);
const nameSel = "document.getElementById('capture-item-name')";
(async () => {
  const P = man().personalId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    // ---- Take Real Photo ----
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(800);
    const r = await chooseViaButton(S, T.btnExpr("^Take Real Photo$"), mkPng(tmp("x1-" + Date.now() + ".png"), 700, 500, [200, 120, 40])); await sleep(3000);
    const l = await labels(S);
    console.log("buttons after Take Real Photo:", JSON.stringify(l.slice(0, 40)));
    await S.jshot("add-capture-realphoto-crop");
    await rec(S, r.dialog, { page: PG, control: "Take Real Photo (opens the device camera app / file chooser)", expected: "Opens the native chooser, and the chosen photo goes to a crop step", actual: `chooser opened=${r.dialog}; buttons: ${l.filter((x) => /Use|Apply|Crop|Cancel|Close|Save|Done/i.test(x)).join(", ") || "(none)"}`, impact: "blocked workflow", repro: "Press Take Real Photo, choose an image" });
    const apply = l.find((x) => /^(Use This Picture|Use photo|Apply|Use|Done|Save photo|Apply crop)/i.test(x));
    if (apply) { await clickText(S, "^" + apply.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"); await sleep(2500); }
    const tiles = await S.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"]').length");
    await rec(S, tiles === 1, { page: PG, control: "Take Real Photo -> confirm the crop step", expected: "The photo is attached", actual: `apply button used: '${apply || "none found"}'; photo tiles now: ${tiles}`, impact: "blocked workflow", repro: "Take Real Photo, choose an image, confirm" });
    const tk = PREFIX + "Real " + Date.now().toString(36);
    await typeInto(S, nameSel, tk); await click(S, T.btnExpr("^Save to Vault$"));
    const rk = await poll(async () => { const x = await rowsByTitle(P, tk); return x.length ? x : null; }, 45000, 2500) || []; created.push(...rk);
    await rec(S, rk.length === 1 && Array.isArray(rk[0].images_json) && rk[0].images_json.length === 1 && /^https:/.test(rk[0].image_front_url || ""), { page: PG, control: "Save to Vault with a Take Real Photo photo", expected: "Row with the photo stored in the cloud", actual: JSON.stringify({ rows: rk.length, images: rk[0] && (rk[0].images_json || []).length, cover: !!(rk[0] && rk[0].image_front_url) }), impact: "data loss", repro: "Take Real Photo, confirm, name, Save" });

    // ---- Cancel on the real-photo crop step ----
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(800);
    await chooseViaButton(S, T.btnExpr("^Take Real Photo$"), mkPng(tmp("x2-" + Date.now() + ".png"), 600, 450, [40, 120, 200])); await sleep(3000);
    const l2 = await labels(S); const cancel = l2.find((x) => /^(Cancel|Close|Discard|Retake)/i.test(x));
    if (cancel) { await clickText(S, "^" + cancel + "$"); await sleep(1500); }
    const tiles2 = await S.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"]').length");
    await rec(S, !!cancel && tiles2 === 0, { page: PG, control: "Cancel on the Take Real Photo crop step", expected: "No photo is added", actual: `cancel control: '${cancel || "none"}'; photo tiles after: ${tiles2}`, impact: "data loss", repro: "Take Real Photo, choose an image, cancel" });

    // ---- press-and-drag a thumbnail onto the first slot ----
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(800);
    const a = mkPng(tmp("x3a-" + Date.now() + ".png"), 800, 600, [200, 60, 60]); const b = mkPng(tmp("x3b-" + Date.now() + ".png"), 640, 480, [60, 200, 60]);
    await T.uploadFiles(S, "input[type=file]", a, 0); await sleep(2000);
    await T.uploadFiles(S, "input[type=file]", b, 0); await sleep(2000);
    const w0 = () => S.evaluate("(() => { const i = [...document.querySelectorAll('img')].filter((x) => /^blob:/.test(x.src) && x.getBoundingClientRect().width > 200)[0]; return i ? i.naturalWidth : null; })()");
    const before = await w0();
    const t1 = await rectOf(S, "document.querySelector('[aria-label=\"Cover photo\"]')"); const t2 = await rectOf(S, "document.querySelector('[aria-label=\"Photo 2\"]')");
    await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: t2.x, y: t2.y });
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: t2.x, y: t2.y, button: "left", clickCount: 1 });
    await sleep(900);
    for (let i = 1; i <= 10; i++) { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: t2.x + (t1.x - t2.x) * i / 10, y: t2.y + (t1.y - t2.y) * i / 10, button: "left", buttons: 1 }); await sleep(60); }
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: t1.x, y: t1.y, button: "left", clickCount: 1 });
    await sleep(1500);
    // after a reorder the cover (first) thumbnail should be the 640 wide one: select the first thumbnail and read the preview
    await click(S, "document.querySelector('[aria-label=\"Cover photo\"]')"); await sleep(600);
    const after = await w0();
    await S.jshot("add-capture-drag-reorder");
    await rec(S, before === 800 && after === 640, { page: PG, control: "Thumbnail press-and-hold then drag onto the first slot (make it the cover)", expected: "The dragged photo becomes the cover (the cover preview changes from the 800-wide photo to the 640-wide one)", actual: `cover preview width before=${before}, after the drag=${after}`, impact: "usability", repro: "Add two photos, press and hold the second thumbnail, drag it onto the first" });

    // ---- accordion sections + bulk link ----
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(800);
    const unvis = () => S.evaluate("[...document.querySelectorAll('select')].filter((s) => s.getBoundingClientRect().height > 0 && /Pop Culture/.test(s.textContent)).length");
    const u0 = await unvis();
    await click(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('2'))"); await sleep(500); const u1 = await unvis();
    await click(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('2'))"); await sleep(500); const u2 = await unvis();
    await rec(S, u0 === 0 && u1 === 1 && u2 === 0, { page: PG, control: "2 CATEGORY section header", expected: "Opens on the first press and closes on the second", actual: `Universe box visible: before=${u0}, after 1st press=${u1}, after 2nd press=${u2}`, impact: "usability", repro: "Press the Category header twice" });
    await click(S, "[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/vault/bulk')"); await sleep(3500);
    await rec(S, (await S.path()) === "/vault/bulk", { page: PG, control: "+ Adding a lot? Bulk upload", expected: "Opens /vault/bulk", actual: "landed on " + (await S.path()), impact: "blocked workflow", repro: "Press the link" });
    await S.visit("/vault/bulk"); await S.waitFor("document.querySelectorAll('select').length >= 1", 60000); await sleep(800);
    await click(S, "[...document.querySelectorAll('a')].find((a) => /Add one item instead/.test(a.textContent))"); await sleep(3500);
    await rec(S, (await S.path()) === "/capture", { page: "/vault/bulk | owner", control: "← Add one item instead", expected: "Opens /capture", actual: "landed on " + (await S.path()), impact: "blocked workflow", repro: "Press the link on /vault/bulk" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-native-error"); } catch {} }
  finally { await S.close(); await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean)); for (const p of mine()) console.log("leftover AUD ADD X rows", (await rowsByTitle(p, PREFIX)).length); }
})();
