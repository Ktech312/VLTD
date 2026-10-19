// re-check of GIN-173 (the first run's screenshot/text came from an interleaved run): /portfolio/insurance in a clean browser
const L = require("./audit-s-gin-lib.cjs"); const { R, sleep } = L;
(async () => {
  const S = await L.session("owner");
  try {
    await S.visit("/portfolio/insurance"); await sleep(8000);
    const t = L.squash(await S.evaluate("document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText"));
    const rows = await S.evaluate("document.querySelectorAll('table tbody tr').length");
    const ok = rows > 5;
    R.check(ok, { page: "/portfolio/insurance | owner, Personal, 26 owned + 5 sold, clean browser (nothing cached) | re-check of GIN-173", control: "Inventory schedule: direct URL / refresh on a new browser or device", expected: "Shows the account's 26 owned items", actual: ok ? `${rows} rows` : `Shows: "${t.slice(0, 40)}...${t.match(/Stated value.{0,120}/)?.[0]} ... ${t.match(/No items found.{0,50}/)?.[0]}": the page only reads this browser's saved copy and never asks the account, so a new browser/device sees an empty schedule`, evidence: await L.SHOT(S, "clean-inventory-schedule-2"), impact: "misleading result", repro: "Sign in on a new browser, open /portfolio/insurance directly." });
  } finally { await S.close(); }
})();
