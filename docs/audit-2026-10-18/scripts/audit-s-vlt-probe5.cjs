const V = require("./audit-s-vlt-lib.cjs");
const { sleep, squash } = V;
(async () => {
  const F = await V.session("owner");
  try {
    await F.visit("/dashboard");
    await V.blockRest(F, true);
    F.intercepted.length = 0;
    await F.go("/dashboard");
    for (let i = 0; i < 40; i++) { await sleep(1000); const n = await F.evaluate("!!document.querySelector('[data-testid=stale-notice]')"); if (n) { console.log("notice at", i); break; } }
    console.log(squash(await F.text()).slice(0, 400));
    console.log("intercepted", F.intercepted.length, [...new Set(F.intercepted.map((x) => x.method + " " + x.url.slice(0, 70)))].join("
"));
    console.log(await F.evaluate("JSON.stringify({ ls: Object.keys(localStorage).filter((k) => /vltd/.test(k)).slice(0, 30) })"));
    await F.jshot("vlt-probe-stale");
  } finally { await F.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
