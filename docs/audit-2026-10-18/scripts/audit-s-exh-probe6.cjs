const X = require("./audit-s-exh-lib.cjs");
const { session, sleep, mclick, byLabel, gdb } = X;
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
(async () => {
  const S = await session("owner", { width: 390, height: 844, mobile: true });
  try {
    await S.visit("/museum/" + ex.A); await sleep(7000);
    const secs0 = (await gdb(ex.A)).exhibition_layout.sections;
    console.log("sections", secs0.length, JSON.stringify(secs0[0] && secs0[0].itemIds.map((x) => x.slice(-2))));
    console.log("org", await mclick(S, byLabel("Organize"), { wait: 800 }));
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await S.evaluate(`window.__ev = []; ['touchstart','touchmove','touchend','pointerdown','pointermove','pointerup','dragstart'].forEach(t => document.addEventListener(t, e => window.__ev.push(t + ':' + ((e.target.closest && e.target.closest('[data-slot-idx]')||{getAttribute(){return '-'}}).getAttribute('data-slot-idx'))), true)); true`);
    const rect = (i) => S.evaluate(`(() => { const e = document.querySelector('[data-slot-idx="${i}"]'); e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`);
    const a = await rect(0); const b = await rect(1);
    console.log("a", a, "b", b);
    await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
    for (let k = 1; k <= 8; k++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x + ((b.x - a.x) * k) / 8, y: a.y + ((b.y - a.y) * k) / 8, id: 1 }] }); await sleep(40); }
    await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(2500);
    console.log("events", JSON.stringify(await S.evaluate("window.__ev")));
    const secs1 = (await gdb(ex.A)).exhibition_layout.sections;
    console.log("after", JSON.stringify(secs1[0].itemIds.map((x) => x.slice(-2))));
    await S.jshot("exh-probe6-touch");
  } finally { await S.close(); }
})();
