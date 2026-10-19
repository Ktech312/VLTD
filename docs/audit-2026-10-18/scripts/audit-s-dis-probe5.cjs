const C = require("./audit-s-dis-common.cjs");
(async () => {
  const S = await C.session("visitor", { width: 390, height: 844, mobile: true });
  await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await S.visit("/discover"); await C.sleep(3000);
  const idx = () => S.evaluate("document.querySelector('[data-testid=featured-carousel]') ? Number(document.querySelector('[data-testid=featured-carousel]').dataset.index) : 'none:' + location.pathname");
  const tap = async (expr) => { const c = await C.centre(S, expr); console.log("centre", JSON.stringify(c)); await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y, id: 1 }] }); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await C.sleep(800); };
  await tap(`document.querySelector('[aria-label="Next featured room"]')`);
  console.log("after tap next", await idx(), await S.path());
  await tap(`document.querySelector('[aria-label="Next featured room"]')`);
  console.log("after tap next 2", await idx(), await S.path());
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
