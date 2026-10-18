process.env.CHROME_PROFILE_ROOT = "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, sleep } = require("./journey-lib.cjs");
(async () => {
  const S = await browser(process.argv[2] || "http://localhost:3000", { width: 1669, height: 900 });
  await S.go("/dashboard"); await S.waitFor("/COLLECTION OVERVIEW/.test(document.body.innerText)", 240000, "home"); await sleep(9000);
  await S.send("Emulation.setDeviceMetricsOverride", { width: 1669, height: 1500, deviceScaleFactor: 1, mobile: false }); await sleep(5000);
  console.log(JSON.stringify(await S.evaluate("(() => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll('img')].map((i) => { const r = i.getBoundingClientRect(); return { src: (i.currentSrc || i.getAttribute('src') || '').slice(-50), ok: i.complete && i.naturalWidth > 0, nat: i.naturalWidth, x: Math.round(r.left), w: Math.round(r.width), lazy: i.loading, inView: r.right > 0 && r.left < vw - 1 && r.width > 8 }; }).filter((i) => i.inView && !i.ok); })()"), null, 1));
  await S.close();
})();
