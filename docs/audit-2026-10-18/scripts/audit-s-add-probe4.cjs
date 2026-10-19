process.env.CHROME_EXTRA = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, controls } = T;
const dump = async (S, tag) => { console.log("=== " + tag); console.log((await T.text(S)).slice(0, 900)); console.log(JSON.stringify((await controls(S)).filter((c) => c.visible && !/^(Home|Vault|Exhibitions|Lounge|Discover|Messages|Alerts|Search|Help|Account menu|Report a bug|Install|Dismiss|VLTD Home)$/.test(c.label)).map((c) => c.kind + ":" + c.label + (c.disabled ? "(d)" : "")))); };
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/quick"); await sleep(3500);
    await S.jshot("probe-quick-d1");
    for (let i = 0; i < 3; i++) { await T.click(S, "document.querySelector('button[aria-label=\"Take picture\"]')"); await sleep(1500); }
    await dump(S, "after 3 pictures");
    await T.click(S, "document.querySelector('button[aria-label=\"Review captured items\"]')"); await sleep(2000);
    await dump(S, "after Review");
    await S.jshot("probe-quick-d2");
    await T.clickText(S, "^Add \d+ item"); await sleep(2500);
    await dump(S, "after Add N");
    await S.jshot("probe-quick-d3");
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
