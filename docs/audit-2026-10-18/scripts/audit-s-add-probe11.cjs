const T = require("./audit-s-add-lib.cjs");
const { session, sleep } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const png = T.mkPng(T.tmp("pr11-" + Date.now() + ".png"), 640, 480, [30, 160, 90]);
    await S.visit("/vault/add"); await sleep(1500);
    await T.chooseViaButton(S, T.btnExpr("Upload a photo from a file"), png); await sleep(3000);
    const open = () => S.evaluate("!![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Use Full Photo')");
    console.log("crop open:", await open());
    console.log("click Use Full Photo (real mouse):", JSON.stringify(await T.clickText(S, "^Use Full Photo$"))); await sleep(2000);
    console.log("crop open after 2 s:", await open()); await sleep(6000); console.log("after 8 s:", await open());
    console.log("console errors:", JSON.stringify(S.consoleErrors.slice(-5)));
    // DOM click
    if (await open()) { await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Use Full Photo').click(); true"); await sleep(3000); console.log("crop open after el.click():", await open()); }
    console.log("errors:", JSON.stringify(S.consoleErrors.slice(-5)));
    if (await open()) { console.log("click Use This Picture:", JSON.stringify(await T.clickText(S, "^Use This Picture$"))); await sleep(3000); console.log("crop open after Use This Picture:", await open()); }
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
