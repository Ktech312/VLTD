// ADD audit, suite 10: camera success paths with Chrome's synthetic camera (browser-emulated, not a real device): /capture Take photo, /vault/add Take a new picture,
// Quick Add barcode scan button with a camera that shows no barcode.
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, admin, rec, click, clickText, typeInto, text, rowsByTitle, removeItems, mine, rectOf, poll } = T;
const PREFIX = "AUD ADD K ";
process.env.CHROME_EXTRA = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
const created = [];
(async () => {
  const P = man().personalId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    // ---- /capture ----
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(800);
    await clickText(S, "^Take photo$"); await sleep(4000);
    const shutter = await rectOf(S, T.btnExpr("Capture photo"));
    await rec(S, shutter && !shutter.disabled, { page: "/capture | owner (synthetic camera)", control: "Take photo (camera available)", expected: "Camera opens with an enabled shutter", actual: `shutter present=${!!shutter}, disabled=${shutter && shutter.disabled}`, impact: "blocked workflow", repro: "Open /capture, press Take photo" });
    await click(S, T.btnExpr("Capture photo")); await sleep(3000);
    const tiles = await S.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"]').length");
    await rec(S, tiles === 1, { page: "/capture | owner (synthetic camera)", control: "Capture photo (shutter)", expected: "The camera closes and the photo is attached", actual: `photo tiles=${tiles}; overlay closed=${!(await rectOf(S, T.btnExpr("Capture photo")).then((r) => r && r.vis).catch(() => false))}`, impact: "blocked workflow", repro: "Take photo, press the shutter" });
    const tk = PREFIX + "Cap " + Date.now().toString(36);
    await typeInto(S, "document.getElementById('capture-item-name')", tk); await click(S, T.btnExpr("^Save to Vault$"));
    const rk = await poll(async () => { const r = await rowsByTitle(P, tk); return r.length ? r : null; }, 45000, 2500) || []; created.push(...rk);
    const imgs = rk[0] && Array.isArray(rk[0].images_json) ? rk[0].images_json : [];
    await rec(S, rk.length === 1 && imgs.length === 1 && /^https:/.test(rk[0].image_front_url || ""), { page: "/capture | owner (synthetic camera)", control: "Save to Vault with a camera photo", expected: "Row with the camera photo stored in the cloud", actual: JSON.stringify({ rows: rk.length, images: imgs.length, cover: !!(rk[0] && rk[0].image_front_url) }), impact: "data loss", repro: "Take photo, shutter, name, Save" });
    // ---- /vault/add ----
    await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000); await sleep(800);
    await clickText(S, "Take a new picture"); await sleep(4000);
    const sh2 = await rectOf(S, T.btnExpr("Capture photo"));
    await rec(S, sh2 && !sh2.disabled, { page: "/vault/add | owner (synthetic camera)", control: "Take a new picture (camera available)", expected: "Camera opens with an enabled shutter", actual: `shutter present=${!!sh2}, disabled=${sh2 && sh2.disabled}`, impact: "blocked workflow", repro: "Open /vault/add, press Take a new picture" });
    await click(S, T.btnExpr("Capture photo")); await sleep(3500);
    const l = (await T.controls(S)).filter((c) => c.visible && c.kind === "button").map((c) => c.label);
    await rec(S, l.includes("Identify with AI") || l.includes("Take another picture"), { page: "/vault/add | owner (synthetic camera)", control: "Capture photo (shutter)", expected: "Photo attached (Identify with AI / Take another picture offered)", actual: "buttons: " + l.filter((x) => /Identify|Take|Use|Crop top left|Cancel/.test(x)).join(", "), impact: "blocked workflow", repro: "Take a new picture, press the shutter" });
    if (l.includes("Use This Picture")) { await clickText(S, "^Use This Picture$"); await sleep(2000); }
    const tv = PREFIX + "Add " + Date.now().toString(36);
    await typeInto(S, "document.getElementById('scan-title')", tv); await click(S, T.btnExpr("^Save$|^Saving"));
    const rv = await poll(async () => { const r = await rowsByTitle(P, tv); return r.length ? r : null; }, 45000, 2500) || []; created.push(...rv);
    const iv = rv[0] && Array.isArray(rv[0].images_json) ? rv[0].images_json : [];
    await rec(S, rv.length === 1 && iv.length >= 1 && /^https:/.test(rv[0].image_front_url || ""), { page: "/vault/add | owner (synthetic camera)", control: "Save with a camera photo", expected: "Row with the photo stored in the cloud", actual: JSON.stringify({ rows: rv.length, images: iv.length, cover: !!(rv[0] && rv[0].image_front_url) }), impact: "data loss", repro: "Take a new picture, shutter, title, Save" });
    // ---- Quick Add barcode button with a camera that sees no barcode ----
    await S.visit("/vault/quick"); await sleep(4000);
    await click(S, "document.querySelector('button[aria-label=\"Scan a barcode or QR code\"]')"); await sleep(1500);
    const scanning = await S.evaluate("!!document.querySelector('button[aria-label=\"Cancel scan\"]')");
    await sleep(10500);
    const after = await text(S);
    const idle = await S.evaluate("!!document.querySelector('button[aria-label=\"Scan a barcode or QR code\"]')");
    await rec(S, scanning && idle && /no code|not found|try again|couldn.t|nothing/i.test(after), { page: "/vault/quick | owner (synthetic camera)", control: "Scan a barcode or QR code (camera sees no barcode)", expected: "Shows a scanning state, then after the timeout says no code was found and is ready to scan again", actual: `scanning state shown=${scanning}; back to idle after 12 s=${idle}; message: '${(after.match(/[^\n]*(no code|not found|try again|couldn.t)[^\n]*/i) || ["(none)"])[0].slice(0, 80)}'`, impact: "usability", repro: "Quick Add, press the barcode button, point at nothing, wait 10 s" });
    await click(S, "document.querySelector('button[aria-label=\"Scan a barcode or QR code\"]')"); await sleep(1000);
    await click(S, "document.querySelector('button[aria-label=\"Cancel scan\"]')"); await sleep(800);
    await rec(S, await S.evaluate("!!document.querySelector('button[aria-label=\"Scan a barcode or QR code\"]')"), { page: "/vault/quick | owner (synthetic camera)", control: "Cancel scan", expected: "Stops scanning and returns to the idle button", actual: "idle button back: " + (await S.evaluate("!!document.querySelector('button[aria-label=\"Scan a barcode or QR code\"]')")), impact: "usability", repro: "Start a scan, press Cancel scan" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-camera-error"); } catch {} }
  finally { await S.close(); await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean)); for (const p of mine()) console.log("leftover AUD ADD K rows", (await rowsByTitle(p, PREFIX)).length); }
})();
