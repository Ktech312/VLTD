const X = require("./audit-s-vlt-vlib.cjs");
const { sleep, squash } = X;
(async () => {
  const S = await X.session("owner");
  try { await S.visit(process.argv[2] || "/portfolio"); console.log(squash(await S.text())); await S.jshot("vlt-insights-full", { full: true }); } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
