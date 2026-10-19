process.env.CHROME_EXTRA = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, rectOf, click, controls } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(800);
    await T.clickText(S, "^Take photo$"); await sleep(5000);
    await S.jshot("probe-cap-cam-open");
    console.log("video:", JSON.stringify(await S.evaluate("[...document.querySelectorAll('video')].map((v) => ({ rs: v.readyState, w: v.videoWidth, h: v.videoHeight, hasSrc: !!v.srcObject, vis: v.getBoundingClientRect().width }))")));
    const r = await rectOf(S, T.btnExpr("Capture photo")); console.log("shutter", JSON.stringify(r));
    console.log("elementFromPoint:", await S.evaluate("(() => { const e = document.elementFromPoint(" + r.x + "," + r.y + "); return e.tagName + '|' + (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 30)); })()"));
    await click(S, T.btnExpr("Capture photo")); await sleep(3500);
    await S.jshot("probe-cap-cam-after");
    console.log("after: thumbs", await S.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"]').length"), "| overlay still:", !!(await rectOf(S, T.btnExpr("Capture photo")).then((x) => x && x.vis).catch(() => false)));
    console.log("labels:", JSON.stringify((await controls(S)).filter((c) => c.visible && c.kind === "button" && !/Unlocked|Locked/.test(c.label)).map((c) => c.label).slice(0, 30)));
    console.log("errors:", JSON.stringify(S.consoleErrors.slice(-4)));
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
