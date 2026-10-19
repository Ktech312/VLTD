process.env.CHROME_EXTRA = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, click, rectOf } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/quick"); await sleep(4500);
    const lab = () => S.evaluate("[...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || '').filter((x) => /scan/i.test(x)).join(',') + ' | ' + ((document.body.innerText.match(/(No code|not found|Scanning|Hold|Point|try again|couldn.t)[^\\n]{0,40}/i) || [''])[0])");
    console.log("before:", await lab());
    const r = await rectOf(S, "document.querySelector('button[aria-label=\"Scan a barcode or QR code\"]')"); console.log("btn", JSON.stringify(r));
    console.log("top element:", await S.evaluate("(() => { const e = document.elementFromPoint(" + r.x + "," + r.y + "); return e.tagName + '|' + (e.getAttribute('aria-label') || '') ; })()"));
    await click(S, "document.querySelector('button[aria-label=\"Scan a barcode or QR code\"]')");
    for (let i = 0; i < 14; i++) { await sleep(1000); console.log((i + 1) + "s:", await lab()); }
    await S.jshot("probe-quick-scan");
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
