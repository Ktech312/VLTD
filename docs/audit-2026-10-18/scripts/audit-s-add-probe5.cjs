process.env.CHROME_EXTRA = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, controls } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/quick"); await sleep(3500);
    for (let i = 0; i < 2; i++) { await T.click(S, "document.querySelector('button[aria-label=\"Take picture\"]')"); await sleep(1500); }
    await T.click(S, "document.querySelector('button[aria-label=\"Review captured items\"]')"); await sleep(1500);
    console.log((await T.text(S)).slice(0, 200).replace(/\n/g, " "));
    const e = T.btnExpr("^Add \\d+ item");
    console.log(e.slice(0, 260));
    const r = await T.rectOf(S, e); console.log("rect", JSON.stringify(r));
    const e2 = "[...document.querySelectorAll('button')].find((b) => /^Add \\d+ item/.test(b.textContent.trim()))";
    const r2 = await T.rectOf(S, e2); console.log("rect2", JSON.stringify(r2));
    if (r2) console.log("elementFromPoint", await S.evaluate("(() => { const x = document.elementFromPoint(" + r2.x + ", " + r2.y + "); return x.tagName + '|' + x.textContent.trim().slice(0, 40); })()"));
    await T.click(S, e2); await sleep(3500);
    console.log((await T.text(S)).slice(0, 300).replace(/\n/g, " "));
    console.log(JSON.stringify((await controls(S)).filter((c) => c.visible).map((c) => c.kind + ":" + c.label)));
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
