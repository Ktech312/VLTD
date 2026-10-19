const V = require("./audit-s-vlt-lib.cjs");
const { sleep, squash } = V;
(async () => {
  const S = await V.session("owner");
  try {
    for (const h of ["cost-breakdown", "value-history", "movers"]) {
      await S.visit("/dashboard");
      await V.clickEl(S, `a[href="/portfolio#${h}"]`);
      for (const t of [500, 2000, 5000]) {
        await sleep(t === 500 ? 500 : 1500);
        console.log(h, t, await S.evaluate(`(() => { const el = document.getElementById(${JSON.stringify(h)}); const r = el && el.getBoundingClientRect(); return JSON.stringify({ path: location.pathname + location.hash, scrollY: Math.round(scrollY), top: r && Math.round(r.top), h: r && Math.round(r.height), docH: document.documentElement.scrollHeight }); })()`));
      }
    }
    await S.visit("/portfolio");
    const t = squash(await S.text());
    console.log(t.slice(0, 1800));
    console.log(await S.evaluate("[...document.querySelectorAll('[id]')].map((e) => e.id).filter((i) => !/^(radix|:r|__)/.test(i)).slice(0, 40).join(',')"));
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
