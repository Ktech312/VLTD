const X = require("./audit-s-itm-lib.cjs");
(async () => {
  const S = await X.S_("owner");
  try {
    const kind = process.argv[2] || "valued";
    const id = X.ID[kind] || process.argv[2];
    await X.openItem(S, id);
    console.log(await S.path());
    const t = await X.text(S);
    console.log(t.slice(0, 3500));
    const cs = await X.controls(S);
    console.log(cs.filter((c) => c.visible).map((c) => `${c.kind}|${c.label}|${c.href}|${c.region}${c.disabled ? "|DIS" : ""}`).join("\n"));
    console.log("shot", await S.jshot("probe-item", { full: true }));
    console.log("errs", S.consoleErrors, S.badResponses);
  } finally { await S.close(); process.exit(0); }
})().catch((e) => { console.error(e); process.exit(1); });
