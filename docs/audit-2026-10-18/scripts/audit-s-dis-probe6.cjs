const C = require("./audit-s-dis-common.cjs");
(async () => {
  const S = await C.session("owner");
  await S.visit("/watchlist"); await C.sleep(3500);
  const expr = C.byText("^Dismiss$", "aside");
  console.log(expr.slice(0, 400));
  console.log("found", await S.evaluate(`!!${expr}`));
  console.log("centre", JSON.stringify(await C.centre(S, expr)));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
