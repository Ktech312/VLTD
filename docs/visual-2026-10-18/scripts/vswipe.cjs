process.env.CHROME_PROFILE_ROOT = "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, sleep } = require("./journey-lib.cjs");
const BASE = process.argv[2] || "http://localhost:3000";
(async () => {
  const S = await browser(BASE, { width: 390, height: 844, mobile: true });
  await S.go("/dashboard"); await S.waitFor("document.querySelectorAll('[data-recent-item] img').length > 2", 240000, "home"); await sleep(3000);
  await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const tp = (type, x, y) => S.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  const swipe = async (x, y0, y1) => { await tp("touchStart", x, y0); for (let i = 1; i <= 12; i++) { await tp("touchMove", x, y0 + ((y1 - y0) * i) / 12); await sleep(16); } await tp("touchEnd", x, y1); await sleep(900); };
  const snap = () => S.evaluate("(() => { const out = {}; for (const e of [document.scrollingElement, ...document.querySelectorAll('*')]) if (e && e.scrollTop > 0) out[(e.tagName + '.' + String(e.className).slice(0, 25))] = Math.round(e.scrollTop); return out; })()");
  await S.evaluate("window.scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); true"); await sleep(300);
  console.log("start", JSON.stringify(await snap()));
  await swipe(30, 700, 300); console.log("swipe up on empty left margin (x=30)", JSON.stringify(await snap()));
  await S.evaluate("document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); window.scrollTo(0,0); true"); await sleep(300);
  const p = await S.evaluate("(() => { const i = document.querySelector('[data-recent-item] img'); i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()"); await sleep(500);
  const before = await snap(); await swipe(p.x, p.y + 100, p.y - 200); console.log("swipe up over the strip photo", JSON.stringify(before), "->", JSON.stringify(await snap()));
  await S.close();
})();
