// Interaction + layout checks for the correction set (synthetic account). Pointer events go through the browser input pipeline (CDP Input.*),
// touch is browser-EMULATED touch, not a physical device.
//   node corr-test.cjs --base=http://localhost:3000
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const STRIP = "document.querySelector('[aria-label^=\"Recently added items.\"]')";
const sl = (S) => S.evaluate(`Math.round(${STRIP}.scrollLeft)`);
async function mouseDrag(S, x0, y, x1, steps = 12) {
  await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y, button: "none" });
  await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= steps; i++) { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x1 - x0) * i) / steps, y, button: "left", buttons: 1 }); await sleep(16); }
  await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y, button: "left", buttons: 0, clickCount: 1 });
}
async function touchSwipe(S, x0, y0, x1, y1, steps = 12) {
  const tp = (type, x, y) => S.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await tp("touchStart", x0, y0); for (let i = 1; i <= steps; i++) { await tp("touchMove", x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps); await sleep(16); } await tp("touchEnd", x1, y1);
}
const box = (S, sel) => S.evaluate(`(() => { const e = ${sel}; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width }; })()`);

(async () => {
  const m = man();
  // ---------- 5. Recently added: mouse drag ----------
  let S = await browser(BASE, { width: 1669, height: 900 });
  try {
    await S.go("/dashboard"); await S.waitFor("document.querySelectorAll('[data-recent-item] img').length > 3", 240000, "home"); await sleep(3000);
    const card = await box(S, "document.querySelector('[data-recent-item]')");
    const img = await S.evaluate("(() => { const i = document.querySelector('[data-recent-item] img'); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, draggable: i.draggable }; })()");
    const before = await sl(S);
    await mouseDrag(S, img.x + 40, img.y, img.x - 160);   // press ON a card photo and drag left
    await sleep(700);
    const after = await sl(S); const path1 = await S.path();
    check("[5] mouse drag started on a card PHOTO moves the strip", after > before + 60, { before, after });
    check("[5] releasing a drag over a card does NOT open the item", path1 === "/dashboard", path1);
    check("[5] photos are not natively draggable (no ghost image)", img.draggable === false, img);
    const sb = await S.evaluate(`(() => { const r = ${STRIP}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await mouseDrag(S, sb.x - 60, sb.y, sb.x + 80); await sleep(700);
    check("[5] dragging back moves it back", (await sl(S)) < after - 30, { after, now: await sl(S) });
    // plain click opens
    const c2 = await S.evaluate("(() => { const a = document.querySelector('[data-recent-item]'); a.scrollIntoView({ block: 'center' }); const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40, id: a.getAttribute('data-recent-item') }; })()");
    await S.evaluate(`${STRIP}.scrollLeft = 0; true`); await sleep(400);
    const c3 = await S.evaluate("(() => { const a = document.querySelector('[data-recent-item]'); const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40, id: a.getAttribute('data-recent-item') }; })()");
    await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c3.x, y: c3.y, button: "none" });
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c3.x, y: c3.y, button: "left", buttons: 1, clickCount: 1 });
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c3.x, y: c3.y, button: "left", buttons: 0, clickCount: 1 });
    await S.waitFor("location.pathname.startsWith('/vault/item/')", 60000, "click opens").then(() => check("[5] a plain click on a card still opens that item", true)).catch(async () => check("[5] a plain click on a card still opens that item", false, await S.path()));
    // keyboard + arrows still work
    await S.go("/dashboard"); await S.waitFor("document.querySelectorAll('[data-recent-item] img').length > 3", 240000, "home2"); await sleep(2500);
    await S.evaluate(`${STRIP}.focus(); true`);
    const k0 = await sl(S); await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await sleep(900);
    check("[5] keyboard ArrowRight still works", (await sl(S)) > k0, { k0, now: await sl(S) });
    const a0 = await sl(S); await S.evaluate("document.querySelector('button[aria-label=\"Next items\"]').click(); true"); await sleep(900);
    check("[5] the Next arrow still works", (await sl(S)) > a0);
  } catch (e) { console.log("STOPPED desktop", e.message); fail++; } finally { await S.close(); }

  // ---------- 5. phone: emulated touch swipe over a card photo; vertical scroll still scrolls the page ----------
  S = await browser(BASE, { width: 390, height: 844, mobile: true });
  try {
    await S.go("/dashboard"); await S.waitFor("document.querySelectorAll('[data-recent-item] img').length > 2", 240000, "home phone"); await sleep(3000);
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    const imgb = await S.evaluate("(() => { const i = document.querySelector('[data-recent-item] img'); i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await sleep(500);
    const b0 = await sl(S); await touchSwipe(S, imgb.x + 90, imgb.y, imgb.x - 90, imgb.y + 2); await sleep(1000);
    const b1 = await sl(S);
    check("[5 phone, EMULATED touch] a finger swipe that starts on a card photo moves the strip", b1 > b0 + 40, { b0, b1 });
    check("[5 phone] the swipe did not open an item", (await S.path()) === "/dashboard", await S.path());
    await S.evaluate("window.__sc = document.querySelector('.vltd-content-wrap'); window.__sc.scrollTop = 0; true"); await sleep(300);
    const ypos = await S.evaluate("(() => { const i = document.querySelector('[data-recent-item] img'); i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()"); await sleep(500);
    const t0 = await S.evaluate("window.__sc.scrollTop");
    await touchSwipe(S, ypos.x, ypos.y + 100, ypos.x + 2, ypos.y - 200); await sleep(900);
    const t1 = await S.evaluate("window.__sc.scrollTop");
    check("[5 phone, EMULATED touch] a vertical swipe that starts on a card photo still scrolls the page", t1 > t0 + 100, { t0, t1 });
    check("[5 phone] still no sideways page scroll", await S.evaluate("document.documentElement.scrollWidth <= innerWidth"));
  } catch (e) { console.log("STOPPED phone", e.message); fail++; } finally { await S.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
