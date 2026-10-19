const L = require("./audit-s-gin-lib.cjs"); const { sleep } = L;
(async () => {
  for (const p of ["/portfolio/insurance", "/reports/weekly"]) {
    const S = await L.session("owner");
    try {
      await S.go(p);
      const seen = [];
      for (let i = 0; i < 40; i++) { await sleep(500); const u = await S.path().catch(() => "?"); if (seen[seen.length - 1] !== u) seen.push(u); }
      console.log(p, "paths over 20s:", seen.join(" -> "));
      console.log((await S.text()).replace(/\s+/g, " ").slice(0, 300));
    } finally { await S.close(); }
  }
})();
