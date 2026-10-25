// Screenshots of Marketplace and Upcoming Comics with their new labelled links (desktop and phone), install prompt dismissed. Evidence for RB73.
const path = require("path");
const T = require(path.join(__dirname, "..", "..", "scripts", "audit-s-add-lib.cjs"));
const { sleep, session } = T;
(async () => {
  for (const dev of [{ n: "desktop", width: 1440, height: 900, mobile: false }, { n: "phone", width: 390, height: 844, mobile: true }]) {
    const S = await session("owner", dev);
    for (const p of ["/market", "/upcoming"]) {
      await S.visit(p); await sleep(5000);
      await S.evaluate(`(() => { const box = [...document.querySelectorAll('div')].find((d) => /Add to Home Screen/.test(d.textContent || '') && d.getBoundingClientRect().height < 120); const x = box && [...box.querySelectorAll('button')].find((b) => /^[×✕x]$/i.test(b.textContent.trim())); if (x) x.click(); return true; })()`);
      await sleep(500);
      console.log(await S.jshot(`rb73-final-${dev.n}-${p.slice(1)}`));
    }
    await S.close();
  }
  process.exit(0);
})();
