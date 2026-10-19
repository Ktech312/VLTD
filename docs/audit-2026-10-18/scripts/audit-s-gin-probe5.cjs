const L = require("./audit-s-gin-lib.cjs"); const { sleep, man } = L;
(async () => {
  const m = man(); const S = await L.session("owner");
  try {
    for (const p of ["/insurance", "/insurance/item?id=qa_vz_" + m.stamp + "_1", "/insurance/packet", "/insurance/packet/print?page=0&images=0", "/reports/insurance", "/portfolio/insurance", "/reports/weekly"]) {
      await S.visit(p); await sleep(3000);
      const t = (await S.text()).replace(/\s+/g, " ");
      console.log("\n=== " + p + " -> " + (await S.path()) + " len " + t.length + "\n" + t.slice(0, 1500));
    }
  } finally { await S.close(); }
})();
