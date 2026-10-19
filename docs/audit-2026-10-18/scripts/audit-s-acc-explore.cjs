// Exploration only: node audit-s-acc-explore.cjs <kind> <width> <path...>
const { session, controls, jshotName } = require("./audit-s-acc-lib.cjs");
const L = require("./audit-s-acc-lib.cjs");
(async () => {
  const kind = process.argv[2] || "visitor"; const w = Number(process.argv[3] || 1440);
  const paths = process.argv.slice(4);
  const S = await session(kind, { width: w, height: w < 500 ? 844 : 900, mobile: w < 500 });
  try {
    for (const p of paths) {
      const ok = await S.visit(p);
      const cs = await controls(S);
      console.log("=====", p, "->", await S.path(), "settled", ok);
      console.log((await L.bodyText(S)).slice(0, 1500));
      console.log(JSON.stringify(cs.filter((c) => c.visible).map((c) => `${c.kind}:${c.label}${c.disabled ? "(disabled)" : ""}${c.href ? "->" + c.href : ""}@${c.region}`)));
      await S.jshot("acc-explore-" + kind + w + "-" + p.replace(/\W+/g, "_"));
      console.log("intercepted", JSON.stringify(S.intercepted), "bad", JSON.stringify(S.badResponses), "ce", JSON.stringify(S.consoleErrors));
    }
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
