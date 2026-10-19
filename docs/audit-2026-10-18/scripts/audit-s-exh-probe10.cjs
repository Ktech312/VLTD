const X = require("./audit-s-exh-lib.cjs");
const { session, sleep } = X; const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
(async () => {
  const S = await session("visitor", { width: 390, height: 844, mobile: true });
  try {
    await S.visit(`/museum/${ex.D}/guest`); await sleep(7000);
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    const info = async (tag) => console.log(tag, await S.path(), JSON.stringify(await S.evaluate(`({ dlg: !!document.querySelector('[role=dialog]'), wall1: [12,13].filter(n => document.body.innerText.includes('QA Album ' + n + ' - ')).length, wall2: [14,15].filter(n => document.body.innerText.includes('QA Album ' + n + ' - ')).length, y: Math.round(scrollY), arrows: document.querySelectorAll('[aria-label="Next exhibit"]').length })`)));
    await info("start");
    const box = await S.evaluate(`(() => { const b = document.querySelector('[aria-label="Next exhibit"]').parentElement; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`);
    console.log("box", JSON.stringify(box));
    const swipe = async (x0, x1, y) => { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y, id: 1 }] }); for (let k = 1; k <= 8; k++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * k) / 8, y, id: 1 }] }); await sleep(30); } await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(900); };
    await swipe(box.x + box.w * 0.85, box.x + box.w * 0.15, box.y); await info("after left swipe");
    await S.jshot("exh-probe10-after-left");
    const box2 = await S.evaluate(`(() => { const b = document.querySelector('[aria-label="Next exhibit"]'); if (!b) return null; const p = b.parentElement; const r = p.getBoundingClientRect(); return { x: r.x, y: r.y + Math.min(r.height / 2, 300), w: r.width, h: r.height, top: r.top }; })()`);
    console.log("box2", JSON.stringify(box2));
    if (box2) { await swipe(box2.x + box2.w * 0.15, box2.x + box2.w * 0.85, Math.max(60, Math.min(800, box2.y))); await info("after right swipe"); await S.jshot("exh-probe10-after-right"); }
  } finally { await S.close(); }
})();
