const T = require("./audit-s-add-lib.cjs");
const { session, sleep, controls } = T;
const labels = async (S) => JSON.stringify((await controls(S)).filter((c) => c.visible && c.kind === "button" && !/Unlocked|Locked/.test(c.label)).map((c) => c.label + (c.disabled ? "(d)" : "")));
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const png = T.mkPng(T.tmp("v1.png"), 640, 480, [30, 160, 90]);
    await S.visit("/vault/add"); await sleep(1500);
    await T.chooseViaButton(S, T.btnExpr("Upload a photo from a file"), png); await sleep(3000);
    console.log("crop:", await labels(S)); await S.jshot("probe-crop-1");
    console.log("Cancel clicked:", JSON.stringify(await T.clickText(S, "^Cancel$"))); await sleep(2000);
    console.log("after cancel:", await labels(S)); await S.jshot("probe-crop-2");
    await T.chooseViaButton(S, T.btnExpr("Upload a photo from a file"), png); await sleep(3000);
    console.log("UseFull clicked:", JSON.stringify(await T.clickText(S, "Use Full Photo"))); await sleep(3000);
    console.log("after use full:", await labels(S)); await S.jshot("probe-crop-3");
    console.log("Identify clicked:", JSON.stringify(await T.clickText(S, "^Identify with AI$"))); await sleep(8000);
    console.log("after identify:", (await T.text(S)).slice(0, 400).replace(/\n/g, " "), "| intercepted:", JSON.stringify(S.intercepted.slice(-3)));
    await S.jshot("probe-crop-4");
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
