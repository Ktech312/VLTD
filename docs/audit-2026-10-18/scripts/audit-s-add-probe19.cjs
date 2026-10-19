const T = require("./audit-s-add-lib.cjs");
const { session, sleep, rectOf } = T;
const mode = process.argv[2] || "mouse";
(async () => {
  const S = await session("owner", mode === "touch" ? { width: 390, height: 844, mobile: true } : { width: 1440, height: 900 });
  try {
    if (mode === "touch") await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(800);
    const a = T.mkPng(T.tmp("p19a-" + Date.now() + ".png"), 800, 600, [200, 60, 60]); const b = T.mkPng(T.tmp("p19b-" + Date.now() + ".png"), 640, 480, [60, 200, 60]);
    await T.uploadFiles(S, "input[type=file]", a, 0); await sleep(2000); await T.uploadFiles(S, "input[type=file]", b, 0); await sleep(2000);
    const order = () => S.evaluate("[...document.querySelectorAll('[data-thumb-index]')].map((t) => { const i = t.querySelector('img'); return (i ? i.naturalWidth : '?'); }).join(' , ')");
    console.log("order before:", await order()); await S.evaluate("window.__ev = []; for (const t of ['pointerdown','pointermove','pointerup','pointercancel','dragstart','mousedown']) window.addEventListener(t, (e) => { if (window.__ev.length < 60) window.__ev.push(t + ':' + (e.target && e.target.tagName)); }, true); true");
    // scroll the rail into view ONCE, then read both rects
    await rectOf(S, "document.querySelector('[data-thumb-index=\"1\"]')");
    const rects = await S.evaluate("[0, 1].map((i) => { const r = document.querySelector('[data-thumb-index=\"' + i + '\"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })");
    const [t1, t2] = rects; console.log("rects", JSON.stringify(rects));
    if (mode === "touch") {
      await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: t2.x, y: t2.y }] }); await sleep(700);
      for (let i = 1; i <= 12; i++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: t2.x + (t1.x - t2.x) * i / 12, y: t2.y }] }); await sleep(50); }
      await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: t2.x, y: t2.y });
      await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: t2.x, y: t2.y, button: "left", buttons: 1, clickCount: 1 });
      for (let i = 1; i <= 12; i++) { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: t2.x + (t1.x - t2.x) * i / 12, y: t2.y, button: "left", buttons: 1 }); await sleep(50); }
      await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: t1.x, y: t2.y, button: "left", buttons: 0, clickCount: 1 });
    }
    await sleep(1200);
    console.log("order after:", await order()); console.log("events:", JSON.stringify(await S.evaluate("(() => { const c = {}; window.__ev.forEach((x) => c[x] = (c[x] || 0) + 1); return c; })()")));
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
