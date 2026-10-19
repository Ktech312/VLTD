// Probe 2: do the exhibition card counts/values depend on the local cache being warmed first?
const { session, controls, sleep, man, admin, fs } = require("./audit-lib.cjs");
(async () => {
  const S = await session("owner");
  const cards = () => S.evaluate(`[...document.querySelectorAll('main article')].map(a => a.innerText.replace(/\\s+/g,' ').slice(0,100))`);
  try {
    await S.visit("/museum");
    for (const w of [1000, 4000, 8000]) { await sleep(w); console.log("cold /museum after +", w, JSON.stringify(await cards())); }
    console.log("LS keys", await S.evaluate(`Object.keys(localStorage).filter(k=>/vault|gallery|item/i.test(k)).map(k=>k+':'+localStorage.getItem(k).length)`));
    await S.visit("/vault"); await sleep(6000);
    console.log("LS keys after vault", await S.evaluate(`Object.keys(localStorage).filter(k=>/vault|gallery|item/i.test(k)).map(k=>k+':'+localStorage.getItem(k).length)`));
    await S.visit("/museum"); await sleep(3000);
    console.log("warm /museum", JSON.stringify(await cards()));
    await S.jshot("exh-probe2-warm");
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(1); });
