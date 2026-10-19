const T = require("./audit-s-add-lib.cjs");
const { session, sleep, click, rectOf } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/ingest"); await sleep(1500);
    const expr = "[...document.querySelectorAll('a')].find((a) => a.textContent.trim().startsWith('Quick Add One-step'))";
    const r = await rectOf(S, expr); console.log("card rect", JSON.stringify(r));
    console.log("element at point:", await S.evaluate("(() => { const e = document.elementFromPoint(" + r.x + "," + r.y + "); return e.tagName + '|' + e.textContent.trim().slice(0, 40) + '|' + (e.closest('a') && e.closest('a').getAttribute('href')); })()"));
    await click(S, expr);
    for (let i = 0; i < 8; i++) { await sleep(1000); console.log(i + 1, "s:", await S.path()); if ((await S.path()) !== "/ingest") break; }
    await S.visit("/ingest"); await sleep(1500);
    const r2 = await rectOf(S, "[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/vault/import')");
    await T.mouseAt(S, r2.x, r2.y); await sleep(5000); console.log("import card ->", await S.path());
    await S.jshot("probe-ingest");
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
