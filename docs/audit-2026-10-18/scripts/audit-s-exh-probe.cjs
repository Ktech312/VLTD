// Probe: what do the Exhibitions pages look like for the owner (list, builder) - control inventory and text.
const { session, controls, sleep, man, admin, fs } = require("./audit-lib.cjs");
(async () => {
  const m = man();
  const S = await session("owner");
  try {
    const target = process.argv[2] || "/museum";
    await S.visit(target);
    await sleep(Number(process.argv[3]||2500));
    console.log("PATH", await S.path());
    const t = (await S.text()).replace(/\s+/g, " ");
    console.log("TEXT", t.slice(0, 2500));
    const cs = await controls(S);
    for (const c of cs) console.log(c.id, c.kind, c.region, c.visible ? "V" : "-", c.disabled ? "D" : "", JSON.stringify(c.label), c.href || "");
    console.log("errors", S.consoleErrors.slice(0, 5), "bad", S.badResponses.slice(0, 8));
    await S.jshot("exh-probe-" + target.replace(/[^a-z0-9]+/gi, "_").slice(0, 40));
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(1); });
