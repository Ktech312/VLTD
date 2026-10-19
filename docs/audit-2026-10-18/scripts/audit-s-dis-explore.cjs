// exploratory: print text + visible controls for a list of routes as a given kind. usage: node audit-s-dis-explore.cjs <kind> <route> [route...]
const C = require("./audit-s-dis-common.cjs");
(async () => {
  const kind = process.argv[2]; const routes = process.argv.slice(3);
  const S = await C.session(kind);
  for (const p of routes) {
    await S.visit(p); await C.sleep(2500);
    console.log("=====", p, "->", await S.path());
    console.log(C.clean(await S.text()).slice(0, 1800));
    const cs = (await C.controls(S)).filter((c) => c.visible && !["nav"].includes(c.region));
    console.log(cs.map((c) => `${c.kind}|${c.label}|${c.href}|${c.region}|${c.pressed}|${c.disabled ? "DISABLED" : ""}`).slice(0, 120).join("\n"));
    console.log("errors", S.consoleErrors.slice(0, 3), "bad", JSON.stringify(S.badResponses.slice(0, 6)));
  }
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
