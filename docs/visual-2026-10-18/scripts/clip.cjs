process.env.CHROME_PROFILE_ROOT = "C:/Users/EK/AppData/Local/Temp/qa-c";
const fs = require("fs"); const { browser, sleep } = require("./journey-lib.cjs");
const [base, path, w, y0, h, out, theme] = process.argv.slice(2);
(async () => {
  const S = await browser(base, { width: Number(w), height: 900, mobile: Number(w) < 500 });
  await S.evaluate(`localStorage.setItem('vltd-theme', '${theme || "deep-vault"}'); true`);
  await S.go(path); await sleep(14000);
  await S.send("Emulation.setDeviceMetricsOverride", { width: Number(w), height: 2400, deviceScaleFactor: 1, mobile: Number(w) < 500 }); await sleep(2500);
  const r = await S.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: Number(y0), width: Number(w), height: Number(h), scale: 1 } });
  fs.writeFileSync(out, Buffer.from(r.data, "base64")); await S.close();
})();
