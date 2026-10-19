// ADD audit, suite 2d: /capture 'Take Real Photo' with the crop step's real confirm button ('Save'), the 'Use Full Photo' label, and thumbnail drag (mouse vs browser-emulated touch).
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, rec, click, clickText, typeInto, text, rowsByTitle, removeItems, mine, rectOf, chooseViaButton, mkPng, tmp, poll, controls } = T;
const PG = "/capture | owner, Personal";
const PREFIX = "AUD ADD Y ";
const created = [];
const nameSel = "document.getElementById('capture-item-name')";
const labels = async (S) => (await controls(S)).filter((c) => c.visible && c.kind === "button" && !/Unlocked|Locked/.test(c.label)).map((c) => c.label);
(async () => {
  const P = man().personalId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(800);
    await chooseViaButton(S, T.btnExpr("^Take Real Photo$"), mkPng(tmp("y1-" + Date.now() + ".png"), 700, 500, [200, 120, 40])); await sleep(3000);
    await clickText(S, "^Use Full Photo$"); await sleep(1500);
    const stillOpen = (await labels(S)).includes("Use Full Photo");
    await rec(S, !stillOpen, { page: PG, control: "Use Full Photo (crop step after Take Real Photo)", expected: "Accepts the whole photo and closes the crop step", actual: stillOpen ? "the crop step stays open, nothing is attached; the button only resets the crop frame, 'Save' is what attaches the photo" : "closed", impact: "misleading result", repro: "Take Real Photo, choose an image, press Use Full Photo" });
    await clickText(S, "^Save$"); await sleep(2500);
    const tiles = await S.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"]').length");
    await rec(S, tiles === 1, { page: PG, control: "Save (crop step after Take Real Photo)", expected: "The photo is attached", actual: "photo tiles: " + tiles, impact: "blocked workflow", repro: "Take Real Photo, choose an image, press Save in the crop step" });
    const tk = PREFIX + "Real " + Date.now().toString(36);
    await typeInto(S, nameSel, tk); await click(S, T.btnExpr("^Save to Vault$"));
    const rk = await poll(async () => { const x = await rowsByTitle(P, tk); return x.length ? x : null; }, 45000, 2500) || []; created.push(...rk);
    await rec(S, rk.length === 1 && Array.isArray(rk[0].images_json) && rk[0].images_json.length === 1 && /^https:/.test(rk[0].image_front_url || ""), { page: PG, control: "Save to Vault with a Take Real Photo photo", expected: "Row with the photo stored in the cloud", actual: JSON.stringify({ rows: rk.length, images: rk[0] && (rk[0].images_json || []).length, cover: !!(rk[0] && rk[0].image_front_url) }), impact: "data loss", repro: "Take Real Photo, Save in the crop step, name, Save to Vault" });
  } catch (e) { console.error("SUITE ERROR", e); } finally { await S.close(); }
  // drag with browser-emulated touch
  const M = await session("owner", { width: 390, height: 844, mobile: true });
  try {
    await M.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await M.visit("/capture"); await M.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(800);
    await T.uploadFiles(M, "input[type=file]", mkPng(tmp("y2a-" + Date.now() + ".png"), 800, 600, [200, 60, 60]), 0); await sleep(2000);
    await T.uploadFiles(M, "input[type=file]", mkPng(tmp("y2b-" + Date.now() + ".png"), 640, 480, [60, 200, 60]), 0); await sleep(2000);
    const order = () => M.evaluate("[...document.querySelectorAll('[data-thumb-index]')].map((t) => { const i = t.querySelector('img'); return i ? i.naturalWidth : 0; })");
    await rectOf(M, "document.querySelector('[data-thumb-index=\"1\"]')");
    const [t1, t2] = await M.evaluate("[0, 1].map((i) => { const r = document.querySelector('[data-thumb-index=\"' + i + '\"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })");
    const before = await order();
    await M.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: t2.x, y: t2.y }] }); await sleep(600);
    for (let i = 1; i <= 12; i++) { await M.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: t2.x + (t1.x - t2.x) * i / 12, y: t2.y }] }); await sleep(50); }
    await M.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(1000);
    const after = await order();
    await rec(M, before[0] === 800 && after[0] === 640 && after[1] === 800, { page: PG + " at 390x844 (browser-emulated touch)", control: "Thumbnail press-and-drag onto the first slot", expected: "The dragged photo becomes the cover", actual: `thumbnail widths before ${JSON.stringify(before)} after ${JSON.stringify(after)}`, impact: "usability", repro: "Add two photos, press and drag the second thumbnail onto the first" });
  } catch (e) { console.error("TOUCH ERROR", e); } finally { await M.close(); }
  await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean));
  for (const p of mine()) console.log("leftover AUD ADD Y rows", (await rowsByTitle(p, PREFIX)).length);
})();
