const X = require("./audit-s-itm-lib.cjs");
(async () => {
  const S = await X.S_("owner");
  try {
    const id = await X.mkItem("probe", { purchase_price: 40, current_value: 100 });
    await X.openItem(S, id);
    await X.mclick(S, X.byText("^More details"));
    await X.sleep(500);
    const info = await S.evaluate(`(() => { const d = document.querySelector('[data-testid=item-details]'); return d.innerText; })()`);
    console.log("DETAILS:\n", info);
    await X.mclick(S, X.byText("^Details$"));
    await X.sleep(600);
    const t = await X.text(S);
    console.log("PRICING:", t.match(/PRICING MVP.{0,900}/)?.[0]);
    const cs = (await X.controls(S)).filter((c) => c.visible && c.region === "main");
    console.log(cs.map((c) => `${c.kind}|${c.label}`).join("\n"));
  } finally { await S.close(); process.exit(0); }
})().catch((e) => { console.error(e); process.exit(1); });
