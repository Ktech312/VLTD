const V = require("./audit-s-vlt-lib.cjs");
(async () => {
  const m = V.man();
  const all = await V.rows(m.personalId); const e = V.expected(all);
  console.log("EXPECTED", JSON.stringify({ ...e, owned: undefined, soldRows: undefined }));
  const S = await V.session("owner");
  try {
    await S.visit("/dashboard");
    console.log((await S.text()).replace(/\n+/g, " | ").slice(0, 2500));
    const c = await V.controls(S);
    console.log(c.filter((x) => x.visible).length, "visible controls");
    await S.jshot("vlt-probe-home");
    console.log("errors", S.consoleErrors.slice(0, 5), "bad", S.badResponses.slice(0, 5), "intercepted", S.intercepted.slice(0, 5));
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
