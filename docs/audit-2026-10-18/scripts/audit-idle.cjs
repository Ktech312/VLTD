// Why do some owner pages never "settle"? List the requests a page keeps making after it has loaded.
const { session, sleep, AUD, fs } = require("./audit-lib.cjs");
(async () => {
  const S = await session("owner");
  const out = {};
  for (const p of ["/dashboard", "/community-board", "/clubs", "/vault"]) {
    await S.go(p); await sleep(15000);
    const n0 = S.reqs.length; await sleep(20000);
    const late = S.reqs.slice(n0).filter((r) => !/\.(png|jpe?g|webp|svg|css|woff2?)(\?|$)/.test(r.url));
    const by = {}; for (const r of late) { const k = r.method + " " + r.url.split("?")[0].slice(0, 70); by[k] = (by[k] || 0) + 1; }
    out[p] = { inflightNow: S.inflight, requestsIn20sAfterLoad: late.length, top: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6) };
    console.log(p, JSON.stringify(out[p]));
  }
  fs.writeFileSync(AUD + "/idle-requests.json", JSON.stringify(out, null, 1));
  await S.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
